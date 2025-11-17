import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { ConfigurationService } from './ConfigurationService.js';
import { MCPKnowledgeClient, MCPModelDocumentation } from './MCPKnowledgeClient.js';
import { OptimizedPrompt, ModelParameters } from '../../shared/types.js';
import { logger } from '../logger.js';

/**
 * Service for optimizing user prompts using Claude Sonnet 4.5
 * Leverages MCP Knowledge Server for model-specific documentation
 * Generates optimized prompts tailored to each image generation model
 */
export class PromptOptimizerService {
  private claudeClient: BedrockRuntimeClient;
  private mcpKnowledgeClient: MCPKnowledgeClient;
  private configService: ConfigurationService;
  private readonly CLAUDE_MODEL_ID = 'us.anthropic.claude-sonnet-4-5-20250929-v1:0';
  private readonly OPTIMIZATION_TIMEOUT_MS: number;

  constructor(
    configService: ConfigurationService,
    mcpKnowledgeClient: MCPKnowledgeClient
  ) {
    this.configService = configService;
    this.mcpKnowledgeClient = mcpKnowledgeClient;

    const credentials = configService.getCredentials();
    
    // Get timeout from environment variable or use default
    this.OPTIMIZATION_TIMEOUT_MS = parseInt(process.env.OPTIMIZATION_TIMEOUT || '60000', 10);

    // Initialize Bedrock client for Claude Sonnet 4.5 in us-east-1
    this.claudeClient = new BedrockRuntimeClient({
      region: 'us-east-1',
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey
      }
    });

    logger.info('PromptOptimizerService initialized', {
      claudeModel: this.CLAUDE_MODEL_ID,
      region: 'us-east-1',
      timeout: `${this.OPTIMIZATION_TIMEOUT_MS}ms`
    });
  }

  /**
   * Optimize a user prompt for multiple image generation models
   * Fetches model documentation and uses Claude to generate model-specific prompts
   * 
   * @param originalPrompt - The user's natural language prompt
   * @param modelIds - Array of model IDs to optimize for
   * @returns Array of optimized prompts with parameters and reasoning
   * @throws Error if optimization fails or times out
   */
  async optimizeForModels(
    originalPrompt: string,
    modelIds: string[]
  ): Promise<OptimizedPrompt[]> {
    const startTime = Date.now();
    
    logger.info('Starting prompt optimization', {
      originalPrompt: originalPrompt.substring(0, 100) + (originalPrompt.length > 100 ? '...' : ''),
      modelCount: modelIds.length,
      modelIds
    });

    try {
      // Use fallback mode directly (skip MCP for serverless-only setup)
      // This provides model information from ConfigurationService instead
      logger.info('Using direct Bedrock mode (MCP disabled for serverless setup)');
      const documentations: (MCPModelDocumentation | null)[] = modelIds.map(() => null);

      // Construct Claude system prompt with original prompt and model docs
      const systemPrompt = this.buildSystemPrompt(originalPrompt, modelIds, documentations);

      // Invoke Claude Sonnet 4.5 with timeout
      const optimizedPrompts = await this.invokeClaudeWithTimeout(
        systemPrompt,
        documentations
      );

      const duration = Date.now() - startTime;

      logger.info('Prompt optimization completed successfully', {
        duration: `${duration}ms`,
        optimizedCount: optimizedPrompts.length
      });

      return optimizedPrompts;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Prompt optimization failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`,
        originalPrompt: originalPrompt.substring(0, 100)
      });

      throw error;
    }
  }

  /**
   * Build the system prompt for Claude with model documentation
   * Creates a comprehensive prompt that instructs Claude to optimize for each model
   * 
   * @private
   * @param originalPrompt - User's original prompt
   * @param documentations - Array of model documentation
   * @returns System prompt string for Claude
   */
  private buildSystemPrompt(
    originalPrompt: string,
    modelIds: string[],
    documentations: (MCPModelDocumentation | null)[]
  ): string {
    // Format model documentation for Claude with AWS Bedrock API specifications
    const modelDocsFormatted = modelIds.map((modelId, index) => {
      const modelInfo = this.configService.getAvailableModels().find(m => m.modelId === modelId);
      
      if (modelId.startsWith('amazon.nova-canvas')) {
        return `
### Amazon Nova Canvas (${modelId})
**Provider:** Amazon
**Model ID:** ${modelId}
**Max Prompt Length:** 1024 characters
**Max Output Resolution:** 4.19 million pixels (2048x2048, 2816x1536)
**Pricing Tiers:** $0.04 for ≤1024x1024, $0.06 for ≤2048x2048 (standard quality)

**API Request Structure:**
{
  "taskType": "TEXT_IMAGE",
  "textToImageParams": {
    "text": "string (1-1024 chars, REQUIRED)",
    "negativeText": "string (1-1024 chars, optional)",
    "style": "3D_ANIMATED_FAMILY_FILM | DESIGN_SKETCH | FLAT_VECTOR_ILLUSTRATION | GRAPHIC_NOVEL_ILLUSTRATION | MAXIMALISM | MIDCENTURY_RETRO | PHOTOREALISM | SOFT_DIGITAL_PAINTING (optional)"
  },
  "imageGenerationConfig": {
    "width": int (required),
    "height": int (required),
    "quality": "standard" | "premium" (optional, default: standard),
    "cfgScale": float (optional, 1.1-10.0, default: 8.0),
    "seed": int (optional, 0-2147483646),
    "numberOfImages": int (optional, 1-5, default: 1)
  }
}

**CRITICAL Dimension Requirements:**
- Each side MUST be 320-4096 pixels
- Each side MUST be evenly divisible by 16 (e.g., 512, 1024, 1280, 1920, 2048)
- Aspect ratio MUST be between 1:4 and 4:1
- Total pixels MUST be less than 4,194,304
- Valid: 1024x1024, 512x512, 1280x720, 1920x1080, 2048x2048
- Invalid: 1000x1000 (not divisible by 16), 512x3000 (exceeds 4:1 ratio)

**Prompting Best Practices (from AWS):**
- Write prompts as image captions, not commands (e.g., "photo of a cat" not "create a photo of a cat")
- Include: subject, environment, lighting, style, camera position
- Be specific and descriptive (up to 1024 chars)
- Place least important details at the end of long prompts
- NEVER use negation words ("no", "not", "without") in text - use negativeText instead
- Example: Instead of "fruit basket with no bananas", use negativeText: "bananas"
- Use consistent seed values when iterating on prompts to understand changes
- Generate multiple variations with different seeds to find the perfect output

**Parameter Guidance:**
- cfgScale: Controls prompt adherence (higher = more literal, default: 8.0, range: 1.1-10.0)
- quality: "premium" provides higher fidelity but costs more
- style: Use to guide artistic direction (PHOTOREALISM, SOFT_DIGITAL_PAINTING, etc.)
- seed: Use consistent values for iteration, vary for different outputs
- Always use dimensions divisible by 16: 512, 1024, 1280, 1536, 1920, 2048

**IMPORTANT:** Use the exact model ID "${modelId}" in your response.
`;
      } else if (modelId.startsWith('amazon.titan-image-generator')) {
        return `
### Amazon Titan Image Generator G1 (${modelId})
**Provider:** Amazon
**Model ID:** ${modelId}
**Max Prompt Length:** 512 characters
**Max Output Resolution:** 1408x1408 pixels

**API Request Structure:**
{
  "taskType": "TEXT_IMAGE",
  "textToImageParams": {
    "text": "string (required, max 512 chars)",
    "negativeText": "string (optional, max 512 chars)"
  },
  "imageGenerationConfig": {
    "quality": "standard" | "premium" (optional),
    "numberOfImages": int (optional, 1-5),
    "height": int (required),
    "width": int (required),
    "cfgScale": float (optional, 1.0-10.0),
    "seed": int (optional, 0-2147483647)
  }
}

**Supported Resolutions:**
- 1024x1024, 768x768, 512x512 (square)
- 1152x896, 1173x768 (landscape)
- 896x1152, 768x1173 (portrait)
- 768x1280, 384x1280 (tall portrait)
- 1280x768, 1280x384 (wide landscape)

**Best Practices:**
- Keep prompts concise and descriptive (max 512 chars)
- Don't use negative words in negativeText (e.g., use "mirrors" not "no mirrors")
- cfgScale controls prompt adherence (higher = stricter adherence)
- Premium quality provides better detail and coherence
- Use specific, concrete descriptions rather than abstract concepts

**IMPORTANT:** Use the exact model ID "${modelId}" in your response.
`;
      } else if (modelId.includes('stability.sd3')) {
        return `
### Stability AI Stable Diffusion 3.5 Large (${modelId})
**Provider:** Stability AI
**Model ID:** ${modelId}
**Max Prompt Length:** 10,000 characters
**Max Output Resolution:** 1 megapixel (1024x1024)

**API Request Structure:**
{
  "prompt": "string (required, max 10,000 chars)",
  "aspect_ratio": "16:9 | 1:1 | 21:9 | 2:3 | 3:2 | 4:5 | 5:4 | 9:16 | 9:21 (optional, default: 1:1)",
  "seed": int (optional, 0-4294967294, default: 0 for random),
  "negative_prompt": "string (optional, max 10,000 chars)",
  "output_format": "jpeg | png | webp (optional, default: png)"
}

**Supported Aspect Ratios:**
- 1:1 (square, 1024x1024)
- 16:9 (landscape, 1024x576)
- 21:9 (ultra-wide, 1024x439)
- 9:16 (portrait, 576x1024)
- 4:5, 5:4, 2:3, 3:2, 9:21 (various ratios)

**Best Practices:**
- Detailed, descriptive prompts work best (can use up to 10,000 chars)
- Use negative_prompt to exclude unwanted elements
- Specify artistic style, lighting, composition in prompt
- Include quality descriptors: "high quality", "detailed", "professional"
- Seed parameter ensures reproducibility (0 = random)
- aspect_ratio is more flexible than fixed dimensions

**IMPORTANT:** Use the exact model ID "${modelId}" in your response.
`;
      } else if (modelId.includes('stability.stable-image')) {
        return `
### Stability AI Stable Image (${modelId})
**Provider:** Stability AI
**Model ID:** ${modelId}
**Max Prompt Length:** 10,000 characters

**API Request Structure:**
{
  "prompt": "string (required, max 10,000 chars)",
  "aspect_ratio": "16:9 | 1:1 | 21:9 | 2:3 | 3:2 | 4:5 | 5:4 | 9:16 | 9:21 (optional)",
  "seed": int (optional, 0-4294967294),
  "negative_prompt": "string (optional, max 10,000 chars)",
  "output_format": "jpeg | png | webp (optional, default: png)"
}

**Best Practices:**
- Highly detailed prompts produce better results
- Use negative_prompt for exclusions
- Specify style, mood, lighting, and composition
- Include technical details: camera angle, lens type, lighting setup
- Use quality keywords: "masterpiece", "best quality", "highly detailed"

**IMPORTANT:** Use the exact model ID "${modelId}" in your response.
`;
      } else {
        // Generic fallback
        return `
### ${modelInfo?.modelName || 'Model'} (${modelId})
**Provider:** ${modelInfo?.provider || 'Unknown'}
**Model ID:** ${modelId}

Using default parameters and best practices for image generation.
**IMPORTANT:** Use the exact model ID "${modelId}" in your response.
`;
      }
    }).join('\n---\n');

    // Create system prompt template for Claude with model documentation injection
    const systemPrompt = `You are an expert prompt engineer for AWS Bedrock image generation models with deep knowledge of each model's API specifications and best practices.

Given a user's original prompt and AWS Bedrock API documentation for multiple image generation models, optimize the prompt for each model while preserving the user's creative intent.

**CRITICAL INSTRUCTIONS:**
1. PRESERVE the user's creative vision and intent - do not change what they want to create
2. ADAPT the prompt syntax and structure to match each model's specific API requirements
3. RECOMMEND appropriate parameters based on the model's documented capabilities and limits
4. FOLLOW AWS Bedrock API specifications exactly for each model
5. USE model-specific best practices from AWS documentation
6. PROVIDE brief reasoning for key changes made to the prompt
7. RETURN ONLY valid JSON - no markdown, no code blocks, no additional text

**Original User Prompt:**
"${originalPrompt}"

**AWS Bedrock Models to Optimize For:**
${modelDocsFormatted}

**CRITICAL: You MUST use these EXACT model IDs in your response:**
${modelIds.map((id, i) => `${i + 1}. ${id}`).join('\n')}

**Required Output Format:**
Return a JSON array with this exact structure (no markdown formatting):
[
  {
    "modelId": "EXACT model ID from the list above",
    "optimizedPrompt": "string (adapted for model's prompt style and length limits)",
    "parameters": {
      // Include ONLY parameters supported by this specific model
      // Use correct parameter names and value ranges from API docs
      // Examples:
      // Nova Canvas: width, height, quality, cfgScale, seed, style, negativeText
      // Titan: width, height, quality, cfgScale, seed, negativeText
      // Stable Diffusion: aspect_ratio, seed, negative_prompt, output_format
    },
    "reasoning": "string (brief explanation of prompt adaptations and parameter choices)"
  }
]

**Validation Rules:**
- Ensure prompt length is within model's max character limit
- Use correct parameter names for each model (e.g., "negativeText" for Nova/Titan, "negative_prompt" for Stability)
- Verify dimensions/aspect ratios are supported by the model
- Include quality parameter only for models that support it
- Follow AWS Bedrock API naming conventions exactly

Generate optimized prompts now:`;

    return systemPrompt;
  }

  /**
   * Invoke Claude Sonnet 4.5 with the optimization prompt
   * Implements 10-second timeout and error handling
   * 
   * @private
   * @param systemPrompt - The constructed system prompt
   * @param documentations - Model documentations for result mapping
   * @returns Array of optimized prompts
   * @throws Error if invocation fails or times out
   */
  private async invokeClaudeWithTimeout(
    systemPrompt: string,
    documentations: (MCPModelDocumentation | null)[]
  ): Promise<OptimizedPrompt[]> {
    logger.debug('Invoking Claude Sonnet 4.5 for optimization');

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Prompt optimization timed out after ${this.OPTIMIZATION_TIMEOUT_MS}ms`));
      }, this.OPTIMIZATION_TIMEOUT_MS);
    });

    // Create Claude invocation promise
    const invocationPromise = this.invokeClaude(systemPrompt, documentations);

    // Race between invocation and timeout
    try {
      const result = await Promise.race([invocationPromise, timeoutPromise]);
      return result;
    } catch (error) {
      // Handle Claude invocation errors gracefully
      if (error instanceof Error && error.message.includes('timed out')) {
        logger.error('Claude invocation timed out', {
          timeout: `${this.OPTIMIZATION_TIMEOUT_MS}ms`
        });
        throw new Error(
          'Prompt optimization took too long. Please try a shorter prompt or try again.'
        );
      }

      logger.error('Claude invocation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new Error(
        'Failed to optimize prompts. Please try again or contact support if the issue persists.'
      );
    }
  }

  /**
   * Invoke Claude Sonnet 4.5 and parse the response
   * 
   * @private
   * @param systemPrompt - The system prompt
   * @param documentations - Model documentations for result mapping
   * @returns Array of optimized prompts
   */
  private async invokeClaude(
    systemPrompt: string,
    documentations: (MCPModelDocumentation | null)[]
  ): Promise<OptimizedPrompt[]> {
    // Prepare Claude request body
    const requestBody = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: systemPrompt
        }
      ]
    };

    const command = new InvokeModelCommand({
      modelId: this.CLAUDE_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody)
    });

    logger.debug('Sending request to Claude', {
      modelId: this.CLAUDE_MODEL_ID,
      promptLength: systemPrompt.length
    });

    const response = await this.claudeClient.send(command);

    // Parse response
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    logger.debug('Received response from Claude', {
      stopReason: responseBody.stop_reason,
      usage: responseBody.usage
    });

    // Extract text content from Claude's response
    const claudeResponse = responseBody.content[0].text;

    // Parse Claude's JSON response to extract optimized prompts and parameters
    const optimizedPrompts = this.parseClaudeResponse(claudeResponse, documentations);

    return optimizedPrompts;
  }

  /**
   * Parse Claude's response and extract optimized prompts
   * Handles JSON extraction and validation
   * 
   * @private
   * @param claudeResponse - Raw text response from Claude
   * @param documentations - Model documentations for validation
   * @returns Array of structured OptimizedPrompt objects
   */
  private parseClaudeResponse(
    claudeResponse: string,
    documentations: (MCPModelDocumentation | null)[]
  ): OptimizedPrompt[] {
    logger.debug('Parsing Claude response', {
      responseLength: claudeResponse.length
    });

    try {
      // Try to extract JSON from the response
      // Claude might wrap it in markdown code blocks despite instructions
      let jsonText = claudeResponse.trim();
      
      // Remove markdown code blocks if present
      if (jsonText.startsWith('```')) {
        const match = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (match) {
          jsonText = match[1].trim();
        }
      }

      // Parse the JSON
      const parsedResponse = JSON.parse(jsonText);

      // Validate it's an array
      if (!Array.isArray(parsedResponse)) {
        throw new Error('Claude response is not an array');
      }

      // Map to OptimizedPrompt structure with model metadata
      const optimizedPrompts: OptimizedPrompt[] = parsedResponse.map((item: any) => {
        const doc = documentations.find(d => d?.modelId === item.modelId);
        
        if (!doc) {
          logger.warn('Model ID in Claude response not found in documentation', {
            modelId: item.modelId
          });
        }

        return {
          modelId: item.modelId,
          modelName: doc?.modelName || item.modelId,
          provider: doc?.provider || 'Unknown',
          region: this.getRegionForModel(item.modelId),
          optimizedPrompt: item.optimizedPrompt,
          parameters: this.validateParameters(item.parameters, item.modelId),
          reasoning: item.reasoning
        };
      });

      logger.info('Successfully parsed Claude response', {
        count: optimizedPrompts.length,
        models: optimizedPrompts.map(p => p.modelId)
      });

      return optimizedPrompts;

    } catch (error) {
      logger.error('Failed to parse Claude response', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responsePreview: claudeResponse.substring(0, 200)
      });

      throw new Error(
        'Failed to parse optimization results. The response format was invalid.'
      );
    }
  }

  /**
   * Validate and sanitize parameters from Claude's response
   * Ensures parameters match AWS Bedrock API specifications for each model
   * 
   * @private
   * @param parameters - Parameters from Claude
   * @param modelId - Model ID for validation
   * @returns Validated ModelParameters
   */
  private validateParameters(parameters: any, modelId: string): ModelParameters {
    const validated: ModelParameters = {};

    // Amazon Nova Canvas parameters
    if (modelId.startsWith('amazon.nova-canvas')) {
      // Dimensions (required)
      if (parameters.width && typeof parameters.width === 'number') {
        validated.width = Math.min(Math.max(parameters.width, 256), 2816);
      }
      if (parameters.height && typeof parameters.height === 'number') {
        validated.height = Math.min(Math.max(parameters.height, 256), 2816);
      }
      
      // Quality: standard or premium
      if (parameters.quality && ['standard', 'premium'].includes(parameters.quality)) {
        validated.quality = parameters.quality;
      }
      
      // cfgScale: 1.1-10.0
      if (parameters.cfgScale && typeof parameters.cfgScale === 'number') {
        validated.cfgScale = Math.min(Math.max(parameters.cfgScale, 1.1), 10.0);
      }
      
      // Seed: 0-2147483646
      if (parameters.seed && typeof parameters.seed === 'number') {
        validated.seed = Math.min(Math.max(Math.floor(parameters.seed), 0), 2147483646);
      }
      
      // Style (Nova-specific)
      const validStyles = [
        '3D_ANIMATED_FAMILY_FILM', 'DESIGN_SKETCH', 'FLAT_VECTOR_ILLUSTRATION',
        'GRAPHIC_NOVEL_ILLUSTRATION', 'MAXIMALISM', 'MIDCENTURY_RETRO',
        'PHOTOREALISM', 'SOFT_DIGITAL_PAINTING'
      ];
      if (parameters.style && validStyles.includes(parameters.style)) {
        validated.style = parameters.style;
      }
      
      // negativeText (Nova uses this name)
      if (parameters.negativeText && typeof parameters.negativeText === 'string') {
        validated.negativeText = parameters.negativeText.substring(0, 1024);
      }
      
      // numberOfImages: 1-5
      if (parameters.numberOfImages && typeof parameters.numberOfImages === 'number') {
        validated.numberOfImages = Math.min(Math.max(Math.floor(parameters.numberOfImages), 1), 5);
      }
    }
    
    // Amazon Titan Image Generator parameters
    else if (modelId.startsWith('amazon.titan-image-generator')) {
      // Dimensions (required) - Titan has specific supported resolutions
      if (parameters.width && typeof parameters.width === 'number') {
        validated.width = Math.min(Math.max(parameters.width, 384), 1408);
      }
      if (parameters.height && typeof parameters.height === 'number') {
        validated.height = Math.min(Math.max(parameters.height, 384), 1408);
      }
      
      // Quality: standard or premium
      if (parameters.quality && ['standard', 'premium'].includes(parameters.quality)) {
        validated.quality = parameters.quality;
      }
      
      // cfgScale: 1.0-10.0
      if (parameters.cfgScale && typeof parameters.cfgScale === 'number') {
        validated.cfgScale = Math.min(Math.max(parameters.cfgScale, 1.0), 10.0);
      }
      
      // Seed: 0-2147483647
      if (parameters.seed && typeof parameters.seed === 'number') {
        validated.seed = Math.min(Math.max(Math.floor(parameters.seed), 0), 2147483647);
      }
      
      // negativeText (Titan uses this name)
      if (parameters.negativeText && typeof parameters.negativeText === 'string') {
        validated.negativeText = parameters.negativeText.substring(0, 512);
      }
      
      // numberOfImages: 1-5
      if (parameters.numberOfImages && typeof parameters.numberOfImages === 'number') {
        validated.numberOfImages = Math.min(Math.max(Math.floor(parameters.numberOfImages), 1), 5);
      }
    }
    
    // Stability AI Stable Diffusion parameters
    else if (modelId.includes('stability')) {
      // Stability uses aspect_ratio instead of width/height
      const validAspectRatios = ['16:9', '1:1', '21:9', '2:3', '3:2', '4:5', '5:4', '9:16', '9:21'];
      if (parameters.aspect_ratio && validAspectRatios.includes(parameters.aspect_ratio)) {
        validated.aspect_ratio = parameters.aspect_ratio;
      } else if (parameters.aspectRatio && validAspectRatios.includes(parameters.aspectRatio)) {
        validated.aspect_ratio = parameters.aspectRatio;
      }
      
      // Seed: 0-4294967294
      if (parameters.seed && typeof parameters.seed === 'number') {
        validated.seed = Math.min(Math.max(Math.floor(parameters.seed), 0), 4294967294);
      }
      
      // negative_prompt (Stability uses underscore naming)
      if (parameters.negative_prompt && typeof parameters.negative_prompt === 'string') {
        validated.negative_prompt = parameters.negative_prompt.substring(0, 10000);
      } else if (parameters.negativePrompt && typeof parameters.negativePrompt === 'string') {
        validated.negative_prompt = parameters.negativePrompt.substring(0, 10000);
      }
      
      // output_format
      const validFormats = ['jpeg', 'png', 'webp'];
      if (parameters.output_format && validFormats.includes(parameters.output_format)) {
        validated.output_format = parameters.output_format;
      } else if (parameters.outputFormat && validFormats.includes(parameters.outputFormat)) {
        validated.output_format = parameters.outputFormat;
      }
    }

    logger.debug('Validated parameters', {
      modelId,
      originalParams: Object.keys(parameters),
      validatedParams: Object.keys(validated)
    });

    return validated;
  }

  /**
   * Get region for a model ID
   * 
   * @private
   * @param modelId - Model ID
   * @returns Region string
   */
  private getRegionForModel(modelId: string): string {
    const modelInfo = this.configService.getModelById(modelId);
    return modelInfo?.region || 'us-east-1';
  }
}
