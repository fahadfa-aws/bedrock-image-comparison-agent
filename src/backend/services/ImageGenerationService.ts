import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { promises as fs } from 'fs';
import path from 'path';
import { BedrockClientFactory } from './BedrockClientFactory.js';
import { ConfigurationService } from './ConfigurationService.js';
import { ImageLibraryService } from './ImageLibraryService.js';
import { S3StorageService } from './S3StorageService.js';
import { ImageGenerationResult, ModelParameters, ImageMetadata } from '../../shared/types.js';
import { logger } from '../logger.js';

export interface ImageGenerationRequest {
  modelId: string;
  prompt: string;
  parameters: ModelParameters;
  originalPrompt?: string; // Original user prompt before optimization
}

/**
 * Service for generating images using AWS Bedrock models
 * Handles multi-region invocations, concurrent generation, and error isolation
 */
export class ImageGenerationService {
  private clientFactory: BedrockClientFactory;
  private configService: ConfigurationService;
  private imageLibraryService: ImageLibraryService | null;
  private s3StorageService: S3StorageService | null;
  private readonly GENERATION_TIMEOUT = 60000; // 60 seconds per model

  constructor(
    clientFactory: BedrockClientFactory, 
    configService: ConfigurationService,
    imageLibraryService?: ImageLibraryService,
    s3StorageService?: S3StorageService
  ) {
    this.clientFactory = clientFactory;
    this.configService = configService;
    this.imageLibraryService = imageLibraryService || null;
    this.s3StorageService = s3StorageService || null;
    logger.info('ImageGenerationService initialized', {
      galleryEnabled: !!imageLibraryService,
      s3Enabled: !!s3StorageService
    });
  }

  /**
   * Generate images concurrently for multiple models
   * Uses Promise.allSettled to ensure error isolation
   * 
   * @param requests - Array of image generation requests
   * @returns Array of results with success/failure status for each model
   */
  async generateImages(requests: ImageGenerationRequest[]): Promise<ImageGenerationResult[]> {
    logger.info('Starting concurrent image generation', { 
      modelCount: requests.length,
      models: requests.map(r => r.modelId)
    });

    // Generate all images concurrently using Promise.allSettled for error isolation
    const promises = requests.map(request => this.generateSingleImage(request));
    const results = await Promise.allSettled(promises);

    // Convert settled promises to results array
    const imageResults: ImageGenerationResult[] = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // Handle rejected promises
        const request = requests[index];
        const modelInfo = this.configService.getModelById(request.modelId);
        
        return {
          modelId: request.modelId,
          modelName: modelInfo?.modelName || request.modelId,
          provider: modelInfo?.provider || 'Unknown',
          region: modelInfo?.region || 'us-east-1',
          success: false,
          generationTime: 0,
          error: {
            code: 'GENERATION_FAILED',
            message: result.reason instanceof Error ? result.reason.message : 'Unknown error',
            retryable: false
          },
          timestamp: new Date()
        };
      }
    });

    const successCount = imageResults.filter(r => r.success).length;
    logger.info('Image generation completed', {
      total: imageResults.length,
      successful: successCount,
      failed: imageResults.length - successCount
    });

    // Upload successful images to S3 if S3StorageService is available
    if (this.s3StorageService) {
      await this.uploadImagesToS3(requests, imageResults);
    }

    return imageResults;
  }

  /**
   * Generate a single image with timeout and error handling
   * 
   * @private
   * @param request - Image generation request
   * @returns ImageGenerationResult with image data or error
   */
  private async generateSingleImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const startTime = Date.now();
    const modelInfo = this.configService.getModelById(request.modelId);

    if (!modelInfo) {
      throw new Error(`Unknown model ID: ${request.modelId}`);
    }

    logger.info('Starting image generation', {
      modelId: request.modelId,
      modelName: modelInfo.modelName,
      region: modelInfo.region
    });

    try {
      // Get the appropriate client for this model's region
      const client = this.clientFactory.getClientForModel(request.modelId);

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Image generation timeout after ${this.GENERATION_TIMEOUT}ms`));
        }, this.GENERATION_TIMEOUT);
      });

      // Race between actual generation and timeout
      const result = await Promise.race([
        this.invokeModel(client, request),
        timeoutPromise
      ]);

      const generationTime = Date.now() - startTime;
      const timestamp = new Date();

      logger.info('Image generation successful', {
        modelId: request.modelId,
        modelName: modelInfo.modelName,
        generationTime: `${generationTime}ms`
      });

      const imageResult: ImageGenerationResult = {
        ...result,
        modelId: request.modelId,
        modelName: modelInfo.modelName,
        provider: modelInfo.provider,
        region: modelInfo.region,
        success: true,
        generationTime,
        timestamp
      };

      // Save image to library if ImageLibraryService is available
      if (this.imageLibraryService && result.imageBase64) {
        try {
          await this.saveImageToLibrary(request, imageResult);
        } catch (error) {
          logger.error('Failed to save image to library', {
            modelId: request.modelId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          // Don't fail the generation if library save fails
        }
      }

      return imageResult;

    } catch (error: any) {
      const generationTime = Date.now() - startTime;
      const formattedError = this.formatError(error);

      logger.error('Image generation failed', {
        modelId: request.modelId,
        modelName: modelInfo.modelName,
        error: formattedError.message,
        errorCode: formattedError.code,
        generationTime: `${generationTime}ms`
      });

      return {
        modelId: request.modelId,
        modelName: modelInfo.modelName,
        provider: modelInfo.provider,
        region: modelInfo.region,
        success: false,
        generationTime,
        error: formattedError,
        timestamp: new Date()
      };
    }
  }

  /**
   * Invoke a specific model with the appropriate request format
   * Handles model-specific request/response formats
   * 
   * @private
   * @param client - BedrockRuntimeClient for the model's region
   * @param request - Image generation request
   * @returns Partial result with image data and resolution
   */
  private async invokeModel(
    client: BedrockRuntimeClient,
    request: ImageGenerationRequest
  ): Promise<Partial<ImageGenerationResult>> {
    const { modelId, prompt, parameters } = request;

    // Format request based on model type
    let requestBody: any;
    let responseParser: (response: any) => Partial<ImageGenerationResult>;

    if (modelId.startsWith('amazon.nova')) {
      // Nova Canvas format
      requestBody = this.formatNovaRequest(prompt, parameters);
      responseParser = (response: any) => this.parseNovaResponse(response, requestBody);
    } else if (modelId.startsWith('stability')) {
      // Stability AI format
      requestBody = this.formatStabilityRequest(prompt, parameters, modelId);
      responseParser = (response: any) => this.parseStabilityResponse(response, requestBody);
    } else {
      throw new Error(`Unsupported model type: ${modelId}`);
    }

    logger.debug('Invoking model', {
      modelId,
      requestBodySize: JSON.stringify(requestBody).length,
      requestBody: JSON.stringify(requestBody) // Log full request for debugging
    });

    // Invoke the model
    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody)
    });

    const response = await client.send(command);

    // Parse response body
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    logger.debug('Model invocation successful', {
      modelId,
      responseBodySize: JSON.stringify(responseBody).length
    });

    // Parse model-specific response
    return responseParser(responseBody);
  }

  /**
   * Format request for Nova Canvas models
   * 
   * @private
   */
  private formatNovaRequest(prompt: string, parameters: ModelParameters): any {
    // Nova Canvas requirements:
    // - Each side: 320-4096 pixels
    // - Each side must be evenly divisible by 16
    // - Aspect ratio: 1:4 to 4:1
    // - Total pixels < 4,194,304
    
    let width = parameters.width || 1024;
    let height = parameters.height || 1024;
    
    // Clamp to valid range
    width = Math.min(Math.max(width, 320), 4096);
    height = Math.min(Math.max(height, 320), 4096);
    
    // Round to nearest multiple of 16
    width = Math.round(width / 16) * 16;
    height = Math.round(height / 16) * 16;
    
    // Ensure within pixel count limit
    const maxPixels = 4194304;
    const totalPixels = width * height;
    
    if (totalPixels > maxPixels) {
      // Scale down proportionally
      const scale = Math.sqrt(maxPixels / totalPixels);
      width = Math.floor((width * scale) / 16) * 16;
      height = Math.floor((height * scale) / 16) * 16;
      
      logger.warn('Nova Canvas dimensions exceed max pixels, scaling down', {
        originalPixels: totalPixels,
        scaledWidth: width,
        scaledHeight: height,
        scaledPixels: width * height
      });
    }
    
    // Validate aspect ratio (1:4 to 4:1)
    const aspectRatio = width / height;
    if (aspectRatio < 0.25 || aspectRatio > 4) {
      // Adjust to fit within aspect ratio limits
      if (aspectRatio < 0.25) {
        // Too tall, reduce height
        height = Math.floor((width * 4) / 16) * 16;
      } else {
        // Too wide, reduce width
        width = Math.floor((height * 4) / 16) * 16;
      }
      
      logger.warn('Nova Canvas aspect ratio out of range, adjusting', {
        originalAspectRatio: aspectRatio,
        adjustedWidth: width,
        adjustedHeight: height,
        newAspectRatio: width / height
      });
    }
    
    const finalWidth = width;
    const finalHeight = height;
    
    logger.info('Nova Canvas final dimensions', {
      requestedWidth: parameters.width,
      requestedHeight: parameters.height,
      finalWidth,
      finalHeight,
      totalPixels: finalWidth * finalHeight
    });
    
    const request: any = {
      taskType: 'TEXT_IMAGE',
      textToImageParams: {
        text: prompt
      },
      imageGenerationConfig: {
        numberOfImages: 1,
        height: finalHeight,
        width: finalWidth,
        quality: parameters.quality || 'standard'
      }
    };

    // Add optional parameters
    if (parameters.seed !== undefined) {
      request.imageGenerationConfig.seed = parameters.seed;
    }

    if (parameters.cfgScale !== undefined) {
      request.imageGenerationConfig.cfgScale = parameters.cfgScale;
    }

    // Nova Canvas uses negativeText (not negativePrompt)
    if (parameters.negativeText) {
      request.textToImageParams.negativeText = parameters.negativeText;
    } else if (parameters.negativePrompt) {
      // Fallback for backwards compatibility
      request.textToImageParams.negativeText = parameters.negativePrompt;
    }
    
    // Add style if provided
    if (parameters.style) {
      request.textToImageParams.style = parameters.style;
    }

    logger.debug('Formatted Nova Canvas request', {
      width: finalWidth,
      height: finalHeight,
      quality: request.imageGenerationConfig.quality,
      hasNegativeText: !!request.textToImageParams.negativeText,
      hasStyle: !!request.textToImageParams.style
    });

    return request;
  }

  /**
   * Format request for Stability AI models
   * Different models have slightly different parameter support
   * 
   * @private
   */
  private formatStabilityRequest(
    prompt: string,
    parameters: ModelParameters,
    modelId: string
  ): any {
    // Newer Stability models (v1:1) use simpler format with "prompt" field
    // Older models (v1, xl) use "text_prompts" array
    const isNewerModel = modelId.includes('v1:1') || modelId.includes('sd3');
    
    if (isNewerModel) {
      // Format for Stable Image Core v1:1, Ultra v1:1, and SD3.5
      
      // Calculate aspect ratio from width/height
      let width = parameters.width || 1024;
      let height = parameters.height || 1024;
      
      // Apply model-specific resolution limits
      if (modelId.includes('sd3')) {
        // SD 3.5 Large: max 1 megapixel (1024x1024)
        const maxPixels = 1024 * 1024;
        if (width * height > maxPixels) {
          const scale = Math.sqrt(maxPixels / (width * height));
          width = Math.round(width * scale);
          height = Math.round(height * scale);
          logger.info('SD3.5 Large: Scaled down to 1MP limit', { width, height });
        }
      } else {
        // Stable Image Ultra/Core: 640-1536 px per side
        width = Math.min(Math.max(width, 640), 1536);
        height = Math.min(Math.max(height, 640), 1536);
      }
      
      // Calculate aspect ratio and find closest supported ratio
      const aspectRatio = width / height;
      const supportedRatios = [
        { ratio: 16/9, label: '16:9' },
        { ratio: 1/1, label: '1:1' },
        { ratio: 21/9, label: '21:9' },
        { ratio: 2/3, label: '2:3' },
        { ratio: 3/2, label: '3:2' },
        { ratio: 4/5, label: '4:5' },
        { ratio: 5/4, label: '5:4' },
        { ratio: 9/16, label: '9:16' },
        { ratio: 9/21, label: '9:21' }
      ];
      
      // Find closest aspect ratio
      let closestRatio = supportedRatios[0];
      let minDiff = Math.abs(aspectRatio - closestRatio.ratio);
      
      for (const supported of supportedRatios) {
        const diff = Math.abs(aspectRatio - supported.ratio);
        if (diff < minDiff) {
          minDiff = diff;
          closestRatio = supported;
        }
      }
      
      logger.info('Stability AI aspect ratio calculated', {
        modelId,
        requestedWidth: parameters.width,
        requestedHeight: parameters.height,
        adjustedWidth: width,
        adjustedHeight: height,
        calculatedRatio: aspectRatio.toFixed(3),
        selectedRatio: closestRatio.label
      });
      
      const request: any = {
        prompt: prompt,
        aspect_ratio: closestRatio.label,
        output_format: 'png'
      };

      // Add negative prompt if provided
      if (parameters.negativePrompt) {
        request.negative_prompt = parameters.negativePrompt;
      }

      // Add seed if provided and valid (must be >= 0)
      if (parameters.seed !== undefined && parameters.seed >= 0) {
        request.seed = parameters.seed;
      }

      return request;
    } else {
      // Format for older Stability models (SDXL, etc.)
      const request: any = {
        text_prompts: [
          {
            text: prompt,
            weight: 1.0
          }
        ],
        height: parameters.height || 1024,
        width: parameters.width || 1024,
        cfg_scale: parameters.cfgScale || 7.0,
        steps: parameters.steps || 50
      };

      // Add negative prompt if provided
      if (parameters.negativePrompt) {
        request.text_prompts.push({
          text: parameters.negativePrompt,
          weight: -1.0
        });
      }

      // Add seed if provided and valid (must be >= 0)
      if (parameters.seed !== undefined && parameters.seed >= 0) {
        request.seed = parameters.seed;
      }

      // Style preset for SDXL
      if (modelId.includes('xl') && parameters.style) {
        request.style_preset = parameters.style;
      }

      return request;
    }
  }

  /**
   * Parse Nova Canvas response
   * 
   * @private
   */
  private parseNovaResponse(responseBody: any, requestBody: any): Partial<ImageGenerationResult> {
    // Nova Canvas returns images in the 'images' array
    if (!responseBody.images || responseBody.images.length === 0) {
      throw new Error('No images in Nova Canvas response');
    }

    const imageData = responseBody.images[0];
    
    // Get actual dimensions from request since Nova doesn't return them in response
    const width = requestBody.imageGenerationConfig?.width || 1024;
    const height = requestBody.imageGenerationConfig?.height || 1024;
    
    logger.info('Nova Canvas response parsed', {
      requestedWidth: width,
      requestedHeight: height,
      imageDataLength: imageData?.length || 0
    });
    
    return {
      imageBase64: imageData,
      imageFormat: 'png',
      resolution: {
        width,
        height
      }
    };
  }

  /**
   * Parse Stability AI response
   * Handles both old format (artifacts array) and new format (images array)
   * 
   * @private
   */
  private parseStabilityResponse(responseBody: any, requestBody: any): Partial<ImageGenerationResult> {
    // Newer models (v1:1, SD3.5) return images array
    if (responseBody.images && responseBody.images.length > 0) {
      const imageData = responseBody.images[0];
      
      // Check for content filter
      if (responseBody.finish_reasons && responseBody.finish_reasons[0] === 'CONTENT_FILTERED') {
        throw new Error('Content policy violation: Image was filtered');
      }

      // Calculate resolution from aspect ratio
      // Newer models use aspect_ratio instead of explicit dimensions
      const aspectRatio = requestBody.aspect_ratio || '1:1';
      let width = 1024;
      let height = 1024;
      
      // Map aspect ratios to approximate dimensions
      const aspectRatioMap: Record<string, { width: number; height: number }> = {
        '1:1': { width: 1024, height: 1024 },
        '16:9': { width: 1024, height: 576 },
        '21:9': { width: 1024, height: 439 },
        '2:3': { width: 683, height: 1024 },
        '3:2': { width: 1024, height: 683 },
        '4:5': { width: 819, height: 1024 },
        '5:4': { width: 1024, height: 819 },
        '9:16': { width: 576, height: 1024 },
        '9:21': { width: 439, height: 1024 }
      };
      
      if (aspectRatioMap[aspectRatio]) {
        width = aspectRatioMap[aspectRatio].width;
        height = aspectRatioMap[aspectRatio].height;
      }

      logger.info('Stability AI response parsed', {
        aspectRatio,
        calculatedWidth: width,
        calculatedHeight: height,
        imageDataLength: imageData?.length || 0
      });

      return {
        imageBase64: imageData,
        imageFormat: 'png',
        resolution: {
          width,
          height
        }
      };
    }
    
    // Older models return artifacts array
    if (responseBody.artifacts && responseBody.artifacts.length > 0) {
      const artifact = responseBody.artifacts[0];
      
      // Check for content filter
      if (artifact.finishReason === 'CONTENT_FILTERED') {
        throw new Error('Content policy violation: Image was filtered');
      }

      // Older models have explicit width/height in request
      const width = requestBody.width || 1024;
      const height = requestBody.height || 1024;

      return {
        imageBase64: artifact.base64,
        imageFormat: 'png',
        resolution: {
          width,
          height
        }
      };
    }

    // No valid response format found
    throw new Error('No images or artifacts in Stability AI response');
  }

  /**
   * Format error messages for different error types
   * Marks errors as retryable based on error code
   * 
   * @private
   */
  private formatError(error: any): { code: string; message: string; retryable: boolean } {
    const errorName = error.name || '';
    const errorMessage = error.message || 'Unknown error';

    // Timeout errors
    if (errorMessage.includes('timeout')) {
      return {
        code: 'TIMEOUT_ERROR',
        message: `Image generation timed out after ${this.GENERATION_TIMEOUT / 1000} seconds. Please try again.`,
        retryable: true
      };
    }

    // Throttling errors
    if (errorName === 'ThrottlingException' || errorName === 'TooManyRequestsException') {
      return {
        code: 'THROTTLING_ERROR',
        message: 'Rate limit exceeded. Please wait a moment before retrying.',
        retryable: true
      };
    }

    // Validation errors
    if (errorName === 'ValidationException') {
      return {
        code: 'VALIDATION_ERROR',
        message: `Invalid parameters: ${errorMessage}`,
        retryable: false
      };
    }

    // Content policy violations
    if (errorMessage.includes('Content policy') || errorMessage.includes('CONTENT_FILTERED')) {
      return {
        code: 'CONTENT_POLICY_VIOLATION',
        message: 'Content policy violation: The prompt or generated image violates content policies.',
        retryable: false
      };
    }

    // Service unavailable
    if (errorName === 'ServiceUnavailableException' || errorName === 'InternalServerError') {
      return {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Bedrock service temporarily unavailable. Please try again.',
        retryable: true
      };
    }

    // Model not found
    if (errorName === 'ResourceNotFoundException') {
      return {
        code: 'MODEL_NOT_FOUND',
        message: 'Model not available in this region.',
        retryable: false
      };
    }

    // Generic error
    return {
      code: 'GENERATION_ERROR',
      message: `Image generation failed: ${errorMessage}`,
      retryable: false
    };
  }

  /**
   * Upload generated images to S3
   * Updates image results with S3 URLs and removes base64 data
   * 
   * @private
   * @param requests - Original generation requests
   * @param results - Generation results with image data
   */
  private async uploadImagesToS3(
    requests: ImageGenerationRequest[],
    results: ImageGenerationResult[]
  ): Promise<void> {
    logger.info('Uploading images to S3', {
      totalImages: results.filter(r => r.success).length
    });

    // Upload each successful image to S3
    const uploadPromises = results.map(async (result, index) => {
      if (!result.success || !result.imageBase64) {
        return;
      }

      const request = requests[index];

      try {
        // Convert base64 to buffer
        const imageBuffer = Buffer.from(result.imageBase64, 'base64');

        // Generate unique image ID
        const imageId = `${result.modelId}-${Date.now()}`;

        // Create metadata for S3
        const metadata: ImageMetadata = {
          id: imageId,
          imageUrl: '', // Will be set by S3StorageService
          modelId: result.modelId,
          modelName: result.modelName,
          region: result.region,
          originalPrompt: request.originalPrompt || request.prompt,
          optimizedPrompt: request.prompt,
          parameters: {
            width: request.parameters.width || result.resolution?.width || 1024,
            height: request.parameters.height || result.resolution?.height || 1024,
            quality: request.parameters.quality,
            seed: request.parameters.seed,
            cfgScale: request.parameters.cfgScale,
            steps: request.parameters.steps,
            negativePrompt: request.parameters.negativePrompt,
            style: request.parameters.style
          },
          generatedAt: result.timestamp,
          resolution: result.resolution || {
            width: request.parameters.width || 1024,
            height: request.parameters.height || 1024
          },
          fileSize: imageBuffer.length,
          format: result.imageFormat || 'png',
          generationTime: result.generationTime
        };

        // Upload to S3 (S3StorageService will update metadata with correct S3 URL)
        const uploadResult = await this.s3StorageService!.uploadImage(
          result.region,
          result.modelId,
          imageBuffer,
          metadata
        );

        // Generate signed URL for immediate access
        const signedUrl = await this.s3StorageService!.getSignedUrl(
          result.region,
          uploadResult.s3Key
        );

        // Update result with S3 information
        result.imageUrl = signedUrl;
        result.s3Key = uploadResult.s3Key;
        result.s3Bucket = uploadResult.bucket;

        // Remove base64 data to save bandwidth
        delete result.imageBase64;

        logger.info('Image uploaded to S3', {
          modelId: result.modelId,
          s3Key: uploadResult.s3Key,
          bucket: uploadResult.bucket,
          region: result.region
        });

      } catch (error) {
        logger.error('Failed to upload image to S3', {
          modelId: result.modelId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        // Don't fail the generation if S3 upload fails
        // Keep the base64 data as fallback
      }
    });

    await Promise.allSettled(uploadPromises);

    const uploadedCount = results.filter(r => r.success && r.imageUrl).length;
    logger.info('S3 upload completed', {
      uploaded: uploadedCount,
      total: results.filter(r => r.success).length
    });
  }

  /**
   * Save generated image to library with metadata
   * Creates unique image ID using format: {modelId}-{timestamp}
   * 
   * @private
   * @param request - Original generation request
   * @param result - Generation result with image data
   */
  private async saveImageToLibrary(
    request: ImageGenerationRequest,
    result: ImageGenerationResult
  ): Promise<void> {
    if (!this.imageLibraryService || !result.imageBase64) {
      return;
    }

    // Generate unique image ID: {modelId}-{timestamp}
    const timestamp = Date.now();
    const imageId = `${request.modelId}-${timestamp}`;

    logger.info('Saving image to library', { imageId });

    try {
      // Decode base64 image data
      const imageBuffer = Buffer.from(result.imageBase64, 'base64');
      const fileSize = imageBuffer.length;

      // Determine storage path from ImageLibraryService
      const storagePath = (this.imageLibraryService as any).imageStoragePath;
      
      // Ensure storage directory exists
      await fs.mkdir(storagePath, { recursive: true });

      // Save image file to storage directory
      const imageFilePath = path.join(storagePath, `${imageId}.png`);
      await fs.writeFile(imageFilePath, imageBuffer);

      logger.debug('Image file saved', { imageId, fileSize });

      // Create ImageMetadata object
      const metadata: ImageMetadata = {
        id: imageId,
        imageUrl: `/images/${imageId}.png`,
        modelId: request.modelId,
        modelName: result.modelName,
        region: result.region,
        originalPrompt: request.originalPrompt || request.prompt,
        optimizedPrompt: request.prompt,
        parameters: {
          width: request.parameters.width || result.resolution?.width || 1024,
          height: request.parameters.height || result.resolution?.height || 1024,
          quality: request.parameters.quality,
          seed: request.parameters.seed,
          cfgScale: request.parameters.cfgScale,
          steps: request.parameters.steps,
          negativePrompt: request.parameters.negativePrompt,
          style: request.parameters.style
        },
        generatedAt: result.timestamp,
        resolution: result.resolution || {
          width: request.parameters.width || 1024,
          height: request.parameters.height || 1024
        },
        fileSize,
        format: result.imageFormat || 'png',
        generationTime: result.generationTime
      };

      // Save metadata using ImageLibraryService
      await this.imageLibraryService.saveImageMetadata(imageId, metadata);

      logger.info('Image saved to library successfully', { 
        imageId,
        fileSize,
        modelId: request.modelId
      });

    } catch (error) {
      logger.error('Failed to save image to library', {
        imageId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}
