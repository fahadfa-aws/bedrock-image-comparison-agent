import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

// Logger
import { logger } from './logger.js';

// Services
import { ConfigurationService } from './services/ConfigurationService.js';
import { BedrockClientFactory } from './services/BedrockClientFactory.js';
import { MCPKnowledgeClient } from './services/MCPKnowledgeClient.js';
import { PromptOptimizerService } from './services/PromptOptimizerService.js';
import { ImageGenerationService } from './services/ImageGenerationService.js';
import { ImageLibraryService } from './services/ImageLibraryService.js';
import { S3StorageService } from './services/S3StorageService.js';

// Error classes
import {
  AuthenticationError,
  PermissionError,
  ModelInvocationError,
  ValidationError,
  TimeoutError,
  KnowledgeAssistantError
} from './errors.js';

// Types
import { OptimizedPrompt, ApiError, ImageMetadata, StorageStats } from '../shared/types.js';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - CORS
app.use(cors());

// Middleware - JSON body parser
app.use(express.json());

// Middleware - Rate limiting (100 requests per 15 minutes)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.use('/api/', limiter);

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip
  });
  next();
});

// Initialize services
let configService: ConfigurationService;
let clientFactory: BedrockClientFactory;
let mcpKnowledgeClient: MCPKnowledgeClient;
let promptOptimizerService: PromptOptimizerService;
let imageGenerationService: ImageGenerationService;
let imageLibraryService: ImageLibraryService;
let s3StorageService: S3StorageService | undefined;

// Async initialization function
async function initializeServices() {
  try {
    logger.info('Initializing services...');
    
    configService = new ConfigurationService();
    
    // Validate model registry against AWS Bedrock
    logger.info('Validating model registry against AWS Bedrock...');
    await configService.initializeModelValidator();
    
    clientFactory = new BedrockClientFactory(configService);
    mcpKnowledgeClient = new MCPKnowledgeClient();
    promptOptimizerService = new PromptOptimizerService(configService, mcpKnowledgeClient);
    
    // Initialize ImageLibraryService with storage path from environment or default
    const imageStoragePath = process.env.IMAGE_STORAGE_PATH || './images';
    imageLibraryService = new ImageLibraryService(imageStoragePath);
    
    // Initialize S3StorageService if configured
    const imageStorageType = process.env.IMAGE_STORAGE_TYPE || 'local';
    if (imageStorageType === 's3') {
      const s3BucketUsEast1 = process.env.S3_BUCKET_US_EAST_1;
      const s3BucketUsWest2 = process.env.S3_BUCKET_US_WEST_2;
      
      if (!s3BucketUsEast1 || !s3BucketUsWest2) {
        logger.warn('S3 storage type selected but bucket names not configured. Falling back to local storage.');
      } else {
        s3StorageService = new S3StorageService({
          buckets: {
            'us-east-1': s3BucketUsEast1,
            'us-west-2': s3BucketUsWest2
          },
          signedUrlExpiration: parseInt(process.env.S3_SIGNED_URL_EXPIRATION || '3600'),
          endpoint: process.env.S3_ENDPOINT
        });
        logger.info('S3StorageService initialized', {
          buckets: {
            'us-east-1': s3BucketUsEast1,
            'us-west-2': s3BucketUsWest2
          }
        });
      }
    }
    
    // Initialize ImageGenerationService with ImageLibraryService and S3StorageService
    imageGenerationService = new ImageGenerationService(
      clientFactory, 
      configService, 
      imageLibraryService,
      s3StorageService
    );
    
    logger.info('All services initialized successfully (using MCP Knowledge Server)');
  } catch (error) {
    logger.error('Failed to initialize services', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    process.exit(1);
  }
}

// Configure static file serving for images BEFORE routes
const imageStoragePath = process.env.IMAGE_STORAGE_PATH || './images';
app.use('/images', express.static(imageStoragePath));

// Initialize services before starting server (wrapped in IIFE for top-level await)
(async () => {
  await initializeServices();
  
  // Start server after initialization
  app.listen(PORT, () => {
    logger.info(`Backend server running on port ${PORT}`);
    logger.info('Available endpoints:', {
      endpoints: [
        'POST /api/optimize-prompt',
        'POST /api/generate-images',
        'GET /api/models',
        'POST /api/config/models',
        'GET /api/health',
        'GET /api/images',
        'GET /api/images/:id',
        'DELETE /api/images/:id',
        'GET /api/images/stats'
      ]
    });
  });
})();

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * POST /api/optimize-prompt
 * Optimize a user prompt for selected models using Claude Sonnet 4.5
 */
app.post('/api/optimize-prompt', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { originalPrompt, selectedModels } = req.body;

    // Validate request body
    if (!originalPrompt || typeof originalPrompt !== 'string') {
      throw new ValidationError('originalPrompt is required and must be a string');
    }

    if (!selectedModels || !Array.isArray(selectedModels)) {
      throw new ValidationError('selectedModels is required and must be an array');
    }

    // Sanitize user prompt (trim, max 2000 chars, remove HTML tags)
    const sanitizedPrompt = sanitizePrompt(originalPrompt);

    if (sanitizedPrompt.length === 0) {
      throw new ValidationError('Prompt cannot be empty after sanitization');
    }

    // Validate model selection (2-6 models, valid IDs)
    validateModelSelection(selectedModels, configService);

    logger.info('Processing prompt optimization request', {
      promptLength: sanitizedPrompt.length,
      modelCount: selectedModels.length
    });

    // Call PromptOptimizerService.optimizeForModels()
    const optimizedPrompts = await promptOptimizerService.optimizeForModels(
      sanitizedPrompt,
      selectedModels
    );

    // Return optimized prompts with parameters
    res.json({
      originalPrompt: sanitizedPrompt,
      optimizedPrompts
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/generate-images
 * Generate images using optimized prompts for multiple models
 */
app.post('/api/generate-images', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { optimizedPrompts, originalPrompt } = req.body;

    // Validate optimized prompts array in request body
    if (!optimizedPrompts || !Array.isArray(optimizedPrompts)) {
      throw new ValidationError('optimizedPrompts is required and must be an array');
    }

    if (optimizedPrompts.length === 0) {
      throw new ValidationError('optimizedPrompts array cannot be empty');
    }

    // Validate each optimized prompt
    for (const prompt of optimizedPrompts) {
      if (!prompt.modelId || !prompt.optimizedPrompt) {
        throw new ValidationError('Each optimized prompt must have modelId and optimizedPrompt');
      }
    }

    logger.info('Processing image generation request', {
      modelCount: optimizedPrompts.length,
      models: optimizedPrompts.map((p: OptimizedPrompt) => p.modelId)
    });

    // Convert to ImageGenerationRequest format
    const requests = optimizedPrompts.map((prompt: OptimizedPrompt) => ({
      modelId: prompt.modelId,
      prompt: prompt.optimizedPrompt,
      parameters: prompt.parameters || {},
      originalPrompt: originalPrompt || prompt.optimizedPrompt
    }));

    // Call ImageGenerationService.generateImages()
    const results = await imageGenerationService.generateImages(requests);

    // Return results array with images, timing, and errors
    res.json({ results });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/models
 * Get available models with metadata
 */
app.get('/api/models', (req: Request, res: Response, next: NextFunction) => {
  try {
    // Return available models from ConfigurationService
    const models = configService.getAvailableModels();

    logger.debug('Returning available models', { count: models.length });

    res.json({ models });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/config/models
 * Save user's model selection
 */
app.post('/api/config/models', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { selectedModels } = req.body;

    // Validate request body
    if (!selectedModels || !Array.isArray(selectedModels)) {
      throw new ValidationError('selectedModels is required and must be an array');
    }

    // Validate and save model selection via ConfigurationService
    await configService.setSelectedModels(selectedModels);

    logger.info('Model selection saved', {
      count: selectedModels.length,
      models: selectedModels
    });

    res.json({ success: true });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/images
 * Get all images with optional filtering, search, sorting, and pagination
 * Returns signed URLs for S3-stored images
 */
app.get('/api/images', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract query parameters
    const { model, search, sort, page, limit } = req.query;

    // Parse and validate pagination parameters
    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 20, 100); // Max 100 per page
    
    // Validate sort parameter
    const sortOrder = (sort as string) || 'newest';
    if (!['newest', 'oldest', 'model'].includes(sortOrder)) {
      throw new ValidationError('Invalid sort parameter. Must be: newest, oldest, or model');
    }

    logger.info('Fetching images', {
      model: model || 'all',
      search: search || 'none',
      sort: sortOrder,
      page: pageNum,
      limit: limitNum,
      storageType: s3StorageService ? 's3' : 'local'
    });

    let images: ImageMetadata[];

    // Fetch images from S3 or local storage
    if (s3StorageService) {
      // Fetch from both regions and combine
      const regions = s3StorageService.getRegions();
      const imagePromises = regions.map(region => 
        s3StorageService!.listImages(region, model as string | undefined)
      );
      
      const imagesByRegion = await Promise.all(imagePromises);
      images = imagesByRegion.flat();

      logger.debug('Fetched images from S3', {
        regions,
        totalImages: images.length
      });

      // Generate signed URLs for each image
      await Promise.all(images.map(async (image) => {
        try {
          // Extract S3 key from imageUrl (format: s3://bucket/key)
          // If imageUrl is empty, derive it from the metadata (legacy support)
          let s3Key: string | null = null;
          
          if (image.imageUrl && image.imageUrl.startsWith('s3://')) {
            const s3UrlMatch = image.imageUrl.match(/^s3:\/\/[^/]+\/(.+)$/);
            if (s3UrlMatch) {
              s3Key = s3UrlMatch[1];
            }
          }
          
          // For legacy metadata without imageUrl, derive S3 key from metadata location
          // The metadata is stored at: metadata/{modelId}/{timestamp}-{uuid}.json
          // The image is stored at: {modelId}/{timestamp}-{uuid}.png
          // We can get the S3 key by looking at where we loaded the metadata from
          if (!s3Key && (image as any)._metadataKey) {
            s3Key = (image as any)._metadataKey
              .replace('metadata/', '')
              .replace('.json', '.png');
            
            logger.debug('Derived S3 key from metadata location', {
              imageId: image.id,
              s3Key
            });
          }

          if (s3Key) {
            const signedUrl = await s3StorageService!.getSignedUrl(
              image.region,
              s3Key,
              3600 // 1 hour expiration
            );
            
            // Update imageUrl with signed URL
            image.imageUrl = signedUrl;
            
            logger.debug('Generated signed URL for image', {
              imageId: image.id,
              region: image.region,
              s3Key
            });
          } else {
            logger.warn('Could not determine S3 key for image', {
              imageId: image.id,
              imageUrl: image.imageUrl
            });
          }
        } catch (error) {
          logger.error('Failed to generate signed URL for image', {
            imageId: image.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          // Keep the S3 URL as fallback
        }
      }));
    } else {
      // Fetch from local storage
      images = await imageLibraryService.scanImageDirectory();
    }

    // Apply model filter if specified (for local storage only, S3 already filtered)
    if (model && typeof model === 'string' && !s3StorageService) {
      images = imageLibraryService.filterByModel(images, model);
    }

    // Apply search filter if specified
    if (search && typeof search === 'string') {
      if (s3StorageService) {
        // Implement search for S3 images
        const lowerQuery = search.toLowerCase().trim();
        images = images.filter(img => {
          const originalPrompt = img.originalPrompt.toLowerCase();
          const optimizedPrompt = img.optimizedPrompt.toLowerCase();
          return originalPrompt.includes(lowerQuery) || optimizedPrompt.includes(lowerQuery);
        });
      } else {
        images = imageLibraryService.searchByPrompt(images, search);
      }
    }

    // Apply sorting
    if (s3StorageService) {
      // Implement sorting for S3 images
      const sorted = [...images];
      switch (sortOrder) {
        case 'newest':
          sorted.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
          break;
        case 'oldest':
          sorted.sort((a, b) => a.generatedAt.getTime() - b.generatedAt.getTime());
          break;
        case 'model':
          sorted.sort((a, b) => {
            const modelCompare = a.modelId.localeCompare(b.modelId);
            if (modelCompare !== 0) return modelCompare;
            return b.generatedAt.getTime() - a.generatedAt.getTime();
          });
          break;
      }
      images = sorted;
    } else {
      images = imageLibraryService.sortImages(images, sortOrder as 'newest' | 'oldest' | 'model');
    }

    // Calculate pagination
    const total = images.length;
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedImages = images.slice(startIndex, endIndex);
    const hasMore = endIndex < total;

    logger.info('Images fetched successfully', {
      total,
      returned: paginatedImages.length,
      page: pageNum,
      hasMore,
      storageType: s3StorageService ? 's3' : 'local'
    });

    // Return response with pagination metadata
    res.json({
      images: paginatedImages,
      total,
      page: pageNum,
      hasMore
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/images/stats
 * Get storage statistics for the image gallery from S3 or local storage
 * IMPORTANT: This must come BEFORE /api/images/:id to avoid route collision
 */
app.get('/api/images/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Fetching storage statistics', {
      storageType: s3StorageService ? 's3' : 'local'
    });

    let stats: StorageStats;

    if (s3StorageService) {
      // Fetch images from all regions
      const regions = s3StorageService.getRegions();
      const imagePromises = regions.map(region => s3StorageService!.listImages(region));
      const imagesByRegion = await Promise.all(imagePromises);
      const images = imagesByRegion.flat();

      // Calculate statistics
      const totalImages = images.length;
      const totalSize = images.reduce((sum, img) => sum + img.fileSize, 0);
      
      // Group size by model ID
      const sizeByModel: Record<string, number> = {};
      images.forEach(img => {
        if (!sizeByModel[img.modelId]) {
          sizeByModel[img.modelId] = 0;
        }
        sizeByModel[img.modelId] += img.fileSize;
      });

      // Find oldest and newest images
      let oldestImage: Date | null = null;
      let newestImage: Date | null = null;

      if (images.length > 0) {
        const sortedByDate = [...images].sort((a, b) => 
          a.generatedAt.getTime() - b.generatedAt.getTime()
        );
        oldestImage = sortedByDate[0].generatedAt;
        newestImage = sortedByDate[sortedByDate.length - 1].generatedAt;
      }

      stats = {
        totalImages,
        totalSize,
        sizeByModel,
        oldestImage,
        newestImage
      };

      logger.debug('Storage statistics calculated from S3', { 
        totalImages, 
        totalSize,
        modelCount: Object.keys(sizeByModel).length
      });
    } else {
      // Get statistics from local storage
      stats = await imageLibraryService.getStorageStats();
    }

    logger.info('Storage statistics fetched successfully', {
      totalImages: stats.totalImages,
      totalSize: stats.totalSize
    });

    // Return storage statistics
    res.json(stats);

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/images/:id
 * Get detailed metadata for a specific image with signed URL if stored in S3
 */
app.get('/api/images/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    logger.info('Fetching image metadata', { 
      imageId: id,
      storageType: s3StorageService ? 's3' : 'local'
    });

    let metadata: ImageMetadata | null = null;

    if (s3StorageService) {
      // Search for image in both regions
      const regions = s3StorageService.getRegions();
      
      for (const region of regions) {
        const images = await s3StorageService.listImages(region);
        metadata = images.find(img => img.id === id) || null;
        
        if (metadata) {
          // Generate signed URL for the image
          const s3UrlMatch = metadata.imageUrl.match(/^s3:\/\/[^/]+\/(.+)$/);
          if (s3UrlMatch) {
            const s3Key = s3UrlMatch[1];
            const signedUrl = await s3StorageService.getSignedUrl(
              region,
              s3Key,
              3600 // 1 hour expiration
            );
            
            metadata.imageUrl = signedUrl;
            
            logger.debug('Generated signed URL for image', {
              imageId: id,
              region,
              s3Key
            });
          }
          break;
        }
      }
    } else {
      // Get metadata from local storage
      metadata = await imageLibraryService.getImageMetadata(id);
    }

    // Return 404 if image not found
    if (!metadata) {
      logger.warn('Image not found', { imageId: id });
      return res.status(404).json({
        error: 'IMAGE_NOT_FOUND',
        message: `Image with ID ${id} not found`
      });
    }

    logger.info('Image metadata fetched successfully', { imageId: id });

    // Return detailed metadata
    res.json({ metadata });

  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/images/:id
 * Delete an image and its metadata from S3 or local storage
 */
app.delete('/api/images/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    logger.info('Deleting image', { 
      imageId: id,
      storageType: s3StorageService ? 's3' : 'local'
    });

    let metadata: ImageMetadata | null = null;
    let foundRegion: string | null = null;

    if (s3StorageService) {
      // Search for image in both regions
      const regions = s3StorageService.getRegions();
      
      for (const region of regions) {
        const images = await s3StorageService.listImages(region);
        metadata = images.find(img => img.id === id) || null;
        
        if (metadata) {
          foundRegion = region;
          break;
        }
      }

      if (!metadata || !foundRegion) {
        logger.warn('Image not found for deletion', { imageId: id });
        return res.status(404).json({
          error: 'IMAGE_NOT_FOUND',
          message: `Image with ID ${id} not found`
        });
      }

      // Extract S3 key from imageUrl
      const s3UrlMatch = metadata.imageUrl.match(/^s3:\/\/[^/]+\/(.+)$/);
      if (!s3UrlMatch) {
        logger.error('Invalid S3 URL format', { imageUrl: metadata.imageUrl });
        throw new Error('Invalid S3 URL format');
      }

      const s3Key = s3UrlMatch[1];

      // Delete from S3
      await s3StorageService.deleteImage(foundRegion, s3Key);

      logger.info('Image deleted from S3', { 
        imageId: id,
        region: foundRegion,
        s3Key
      });
    } else {
      // Validate that image exists in local storage
      metadata = await imageLibraryService.getImageMetadata(id);
      if (!metadata) {
        logger.warn('Image not found for deletion', { imageId: id });
        return res.status(404).json({
          error: 'IMAGE_NOT_FOUND',
          message: `Image with ID ${id} not found`
        });
      }

      // Delete from local storage
      await imageLibraryService.deleteImage(id);

      // Invalidate cache
      imageLibraryService.invalidateCache();

      logger.info('Image deleted from local storage', { imageId: id });
    }

    // Return success response
    res.json({
      success: true,
      message: `Image ${id} deleted successfully`
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/health
 * Health check endpoint with regional connectivity validation
 */
app.get('/api/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.debug('Health check requested');

    // Check connectivity to us-east-1 and us-west-2 Bedrock
    const permissionValidation = await configService.validatePermissions();

    // Verify Knowledge Assistant availability
    // MCP Knowledge Client is always available (spawns on demand)
    const knowledgeAssistantAvailable = true;

    // Get validated models
    const validatedModels = configService.getValidatedModels();
    const modelsByRegion = {
      'us-east-1': validatedModels.filter(m => m.region === 'us-east-1').length,
      'us-west-2': validatedModels.filter(m => m.region === 'us-west-2').length,
    };

    // Return status object with regional health checks
    const status = permissionValidation.valid && validatedModels.length > 0 ? 'healthy' : 'degraded';

    res.json({
      status,
      timestamp: new Date().toISOString(),
      regions: permissionValidation.regions,
      knowledgeAssistant: knowledgeAssistantAvailable,
      models: {
        total: validatedModels.length,
        byRegion: modelsByRegion,
      },
      errors: permissionValidation.errors
    });

  } catch (error) {
    next(error);
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Sanitize user prompt
 * - Trim whitespace
 * - Limit to 2000 characters
 * - Remove HTML tags
 */
function sanitizePrompt(prompt: string): string {
  return prompt
    .trim()
    .slice(0, 2000)
    .replace(/<[^>]*>/g, ''); // Remove HTML tags
}

/**
 * Validate model selection
 * - Must have 2-6 models
 * - All model IDs must be valid
 */
function validateModelSelection(modelIds: string[], configService: ConfigurationService): void {
  if (modelIds.length < 2 || modelIds.length > 6) {
    throw new ValidationError('Must select between 2 and 6 models');
  }

  const availableModels = configService.getAvailableModels();
  const validIds = availableModels.map(m => m.modelId);
  const invalidIds = modelIds.filter(id => !validIds.includes(id));

  if (invalidIds.length > 0) {
    throw new ValidationError(`Invalid model IDs: ${invalidIds.join(', ')}`);
  }
}

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

/**
 * Global error handler middleware
 * Returns user-friendly error messages with resolution steps
 * Logs all errors with timestamps and context
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  // Log all errors with timestamps and context
  logger.error('Request error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Handle specific error types
  if (error instanceof AuthenticationError) {
    const response: ApiError = {
      error: error.code,
      message: error.userMessage,
      resolution: error.resolution
    };
    return res.status(error.statusCode).json(response);
  }

  if (error instanceof PermissionError) {
    const response: ApiError = {
      error: error.code,
      message: error.userMessage,
      resolution: error.resolution
    };
    return res.status(error.statusCode).json(response);
  }

  if (error instanceof ModelInvocationError) {
    const response: ApiError = {
      error: error.code,
      message: error.getUserMessage(),
      retryable: error.isRetryable(),
      modelId: error.modelId
    };
    return res.status(error.statusCode).json(response);
  }

  if (error instanceof ValidationError) {
    const response: ApiError = {
      error: error.code,
      message: error.message
    };
    return res.status(error.statusCode).json(response);
  }

  if (error instanceof TimeoutError) {
    const response: ApiError = {
      error: error.code,
      message: error.message,
      retryable: true
    };
    return res.status(error.statusCode).json(response);
  }

  if (error instanceof KnowledgeAssistantError) {
    const response: ApiError = {
      error: error.code,
      message: error.getUserMessage(),
      modelId: error.modelId
    };
    return res.status(error.statusCode).json(response);
  }

  // Generic error response for unknown errors
  const response: ApiError = {
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred. Please try again.'
  };
  res.status(500).json(response);
});

export default app;
