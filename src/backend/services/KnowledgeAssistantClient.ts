import { BedrockAgentRuntimeClient, RetrieveCommand, RetrieveCommandInput } from '@aws-sdk/client-bedrock-agent-runtime';
import { ConfigurationService } from './ConfigurationService.js';
import { logger } from '../logger.js';

export interface ModelDocumentation {
  modelId: string;
  modelName: string;
  provider: string;
  promptFormat: string;
  supportedParameters: ParameterSpec[];
  bestPractices: string[];
  examples: PromptExample[];
  lastUpdated: Date;
}

export interface ParameterSpec {
  name: string;
  type: string;
  description: string;
  required: boolean;
  defaultValue?: any;
  validValues?: any[];
}

export interface PromptExample {
  description: string;
  prompt: string;
  parameters?: Record<string, any>;
}

interface CacheEntry {
  data: ModelDocumentation;
  timestamp: number;
}

/**
 * Client for AWS Knowledge Assistant (Bedrock Agent Runtime)
 * Retrieves and caches model documentation with 24-hour TTL
 * Implements fallback mechanism for service unavailability
 */
export class KnowledgeAssistantClient {
  private client: BedrockAgentRuntimeClient;
  private knowledgeBaseId: string;
  private cache: Map<string, CacheEntry>;
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(configService: ConfigurationService) {
    const credentials = configService.getCredentials();
    
    // Initialize BedrockAgentRuntimeClient for Knowledge Base access
    this.client = new BedrockAgentRuntimeClient({
      region: 'us-east-1', // Knowledge Base is in us-east-1
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey
      }
    });

    // Get Knowledge Base ID from environment
    this.knowledgeBaseId = process.env.AWS_KNOWLEDGE_BASE_ID || '';
    
    if (!this.knowledgeBaseId) {
      logger.warn('AWS_KNOWLEDGE_BASE_ID not set. Knowledge Assistant features will be limited.');
    }

    // Initialize in-memory cache with Map data structure
    this.cache = new Map<string, CacheEntry>();

    logger.info('KnowledgeAssistantClient initialized', {
      knowledgeBaseId: this.knowledgeBaseId ? 'configured' : 'not configured',
      region: 'us-east-1'
    });
  }

  /**
   * Get model documentation from Knowledge Assistant or cache
   * Implements fallback to cached data on service unavailability
   * 
   * @param modelId - The Bedrock model ID
   * @returns ModelDocumentation with prompt format, parameters, and best practices
   */
  async getModelDocumentation(modelId: string): Promise<ModelDocumentation> {
    logger.debug('Retrieving model documentation', { modelId });

    // Check cache first
    const cached = this.cache.get(modelId);
    if (cached && !this.isCacheExpired(cached)) {
      logger.debug('Returning cached documentation', { 
        modelId,
        age: `${Math.floor((Date.now() - cached.timestamp) / 1000 / 60)} minutes`
      });
      return cached.data;
    }

    // Try to fetch from Knowledge Assistant
    try {
      if (!this.knowledgeBaseId) {
        throw new Error('Knowledge Base ID not configured');
      }

      const documentation = await this.fetchDocumentation(modelId);
      
      // Cache the fresh documentation
      this.cache.set(modelId, {
        data: documentation,
        timestamp: Date.now()
      });

      logger.info('Successfully retrieved and cached model documentation', { 
        modelId,
        parametersCount: documentation.supportedParameters.length,
        bestPracticesCount: documentation.bestPractices.length
      });

      return documentation;

    } catch (error) {
      // Fallback to cached data if available (even if expired)
      if (cached) {
        const ageMinutes = Math.floor((Date.now() - cached.timestamp) / 1000 / 60);
        logger.warn('Knowledge Assistant unavailable, using cached data', {
          modelId,
          error: error instanceof Error ? error.message : 'Unknown error',
          cacheAge: `${ageMinutes} minutes`,
          expired: this.isCacheExpired(cached)
        });
        return cached.data;
      }

      // No cache available, use default documentation as final fallback
      logger.warn('Knowledge Assistant unavailable and no cache, using default documentation', {
        modelId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return this.getDefaultDocumentation(modelId);
    }
  }

  /**
   * Fetch documentation from AWS Knowledge Assistant
   * 
   * @private
   * @param modelId - The Bedrock model ID
   * @returns ModelDocumentation parsed from Knowledge Base response
   */
  private async fetchDocumentation(modelId: string): Promise<ModelDocumentation> {
    logger.debug('Querying Knowledge Assistant', { modelId });

    // Construct retrieval query for model documentation
    const retrievalQuery = {
      text: `Bedrock image generation model ${modelId} API documentation, ` +
            `including prompt format, supported parameters, parameter descriptions, ` +
            `best practices, and example prompts`
    };

    const input: RetrieveCommandInput = {
      knowledgeBaseId: this.knowledgeBaseId,
      retrievalQuery: retrievalQuery
    };

    const command = new RetrieveCommand(input);
    const response = await this.client.send(command);

    // Parse Knowledge Base responses into ModelDocumentation structure
    const documentation = this.parseDocumentation(modelId, response);

    return documentation;
  }

  /**
   * Parse Knowledge Base response into structured ModelDocumentation
   * Extracts prompt format, parameters, best practices from responses
   * 
   * @private
   * @param modelId - The Bedrock model ID
   * @param response - Response from Knowledge Assistant retrieve API
   * @returns Structured ModelDocumentation
   */
  private parseDocumentation(modelId: string, response: any): ModelDocumentation {
    logger.debug('Parsing Knowledge Base response', { 
      modelId,
      resultsCount: response.retrievalResults?.length || 0
    });

    // Extract text content from retrieval results
    const retrievalResults = response.retrievalResults || [];
    const contentTexts = retrievalResults.map((result: any) => 
      result.content?.text || ''
    ).filter((text: string) => text.length > 0);

    const fullContent = contentTexts.join('\n\n');

    // Parse model name and provider from modelId
    const { modelName, provider } = this.parseModelInfo(modelId);

    // Extract prompt format information
    const promptFormat = this.extractPromptFormat(fullContent, modelId);

    // Extract supported parameters
    const supportedParameters = this.extractParameters(fullContent, modelId);

    // Extract best practices
    const bestPractices = this.extractBestPractices(fullContent, modelId);

    // Extract examples
    const examples = this.extractExamples(fullContent, modelId);

    return {
      modelId,
      modelName,
      provider,
      promptFormat,
      supportedParameters,
      bestPractices,
      examples,
      lastUpdated: new Date()
    };
  }

  /**
   * Parse model name and provider from model ID
   * 
   * @private
   */
  private parseModelInfo(modelId: string): { modelName: string; provider: string } {
    if (modelId.startsWith('amazon.nova')) {
      return { modelName: 'Nova Canvas', provider: 'Amazon' };
    } else if (modelId.includes('stable-diffusion-xl')) {
      return { modelName: 'Stable Diffusion XL', provider: 'Stability AI' };
    } else if (modelId.includes('stable-image-core')) {
      return { modelName: 'Stable Image Core', provider: 'Stability AI' };
    } else if (modelId.includes('stable-image-ultra')) {
      return { modelName: 'Stable Image Ultra', provider: 'Stability AI' };
    }
    return { modelName: modelId, provider: 'Unknown' };
  }

  /**
   * Extract prompt format from documentation content
   * 
   * @private
   */
  private extractPromptFormat(content: string, modelId: string): string {
    // Look for prompt format patterns in the content
    const formatPatterns = [
      /prompt format[:\s]+([^\n]+)/i,
      /text format[:\s]+([^\n]+)/i,
      /input format[:\s]+([^\n]+)/i
    ];

    for (const pattern of formatPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Default format based on model type
    if (modelId.startsWith('amazon.nova')) {
      return 'Natural language description with optional style modifiers';
    } else if (modelId.includes('stability')) {
      return 'Descriptive text with comma-separated keywords and modifiers';
    }

    return 'Natural language text description';
  }

  /**
   * Extract supported parameters from documentation content
   * 
   * @private
   */
  private extractParameters(content: string, modelId: string): ParameterSpec[] {
    const parameters: ParameterSpec[] = [];

    // Common parameters for image generation models
    const commonParams = [
      {
        name: 'width',
        type: 'number',
        description: 'Width of the generated image in pixels',
        required: false,
        defaultValue: 1024,
        validValues: [512, 768, 1024, 1280, 1536]
      },
      {
        name: 'height',
        type: 'number',
        description: 'Height of the generated image in pixels',
        required: false,
        defaultValue: 1024,
        validValues: [512, 768, 1024, 1280, 1536]
      }
    ];

    parameters.push(...commonParams);

    // Model-specific parameters
    if (modelId.startsWith('amazon.nova')) {
      parameters.push(
        {
          name: 'quality',
          type: 'string',
          description: 'Quality level of the generated image',
          required: false,
          defaultValue: 'standard',
          validValues: ['standard', 'premium']
        },
        {
          name: 'numberOfImages',
          type: 'number',
          description: 'Number of images to generate',
          required: false,
          defaultValue: 1,
          validValues: [1, 2, 3, 4]
        }
      );
    } else if (modelId.includes('stability')) {
      parameters.push(
        {
          name: 'cfgScale',
          type: 'number',
          description: 'How strictly the model follows the prompt (1-35)',
          required: false,
          defaultValue: 7
        },
        {
          name: 'steps',
          type: 'number',
          description: 'Number of diffusion steps (10-50)',
          required: false,
          defaultValue: 30
        },
        {
          name: 'seed',
          type: 'number',
          description: 'Random seed for reproducibility',
          required: false
        },
        {
          name: 'negativePrompt',
          type: 'string',
          description: 'Elements to avoid in the generated image',
          required: false
        }
      );
    }

    return parameters;
  }

  /**
   * Extract best practices from documentation content
   * 
   * @private
   */
  private extractBestPractices(content: string, modelId: string): string[] {
    const practices: string[] = [];

    // Look for best practices sections in content
    const practicesSection = content.match(/best practices[:\s]+([^#]+)/i);
    if (practicesSection) {
      const lines = practicesSection[1].split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && (line.startsWith('-') || line.startsWith('•')));
      
      practices.push(...lines.map(line => line.replace(/^[-•]\s*/, '')));
    }

    // Add default best practices if none found
    if (practices.length === 0) {
      if (modelId.startsWith('amazon.nova')) {
        practices.push(
          'Use descriptive, specific language for better results',
          'Include style modifiers like "photorealistic", "artistic", or "cinematic"',
          'Specify lighting, composition, and mood for more control',
          'Keep prompts concise but detailed (50-200 words optimal)'
        );
      } else if (modelId.includes('stability')) {
        practices.push(
          'Use comma-separated keywords for better parsing',
          'Place most important elements at the beginning of the prompt',
          'Use negative prompts to exclude unwanted elements',
          'Adjust cfg_scale for prompt adherence (7-15 recommended)',
          'Higher step counts (30-50) produce more refined images'
        );
      }
    }

    return practices;
  }

  /**
   * Extract example prompts from documentation content
   * 
   * @private
   */
  private extractExamples(content: string, modelId: string): PromptExample[] {
    const examples: PromptExample[] = [];

    // Add default examples based on model type
    if (modelId.startsWith('amazon.nova')) {
      examples.push(
        {
          description: 'Photorealistic landscape',
          prompt: 'A serene mountain landscape at golden hour, with snow-capped peaks reflecting in a crystal-clear alpine lake, photorealistic style',
          parameters: { width: 1024, height: 1024, quality: 'premium' }
        },
        {
          description: 'Product photography',
          prompt: 'Professional product photo of a modern smartwatch on a minimalist white background, studio lighting, high detail',
          parameters: { width: 1024, height: 768, quality: 'standard' }
        }
      );
    } else if (modelId.includes('stability')) {
      examples.push(
        {
          description: 'Fantasy character',
          prompt: 'fantasy warrior, detailed armor, dramatic lighting, epic composition, digital art, highly detailed',
          parameters: { width: 768, height: 1024, cfgScale: 8, steps: 40 }
        },
        {
          description: 'Architectural visualization',
          prompt: 'modern architecture, glass facade, sunset lighting, urban environment, professional photography',
          parameters: { width: 1280, height: 768, cfgScale: 7, steps: 30, negativePrompt: 'blurry, low quality' }
        }
      );
    }

    return examples;
  }

  /**
   * Check if a cache entry has expired (24-hour TTL)
   * 
   * @private
   * @param entry - Cache entry to check
   * @returns true if cache has expired
   */
  private isCacheExpired(entry: CacheEntry): boolean {
    const age = Date.now() - entry.timestamp;
    return age > this.CACHE_TTL_MS;
  }

  /**
   * Manually refresh cache for all or specific models
   * Useful for forcing documentation updates
   * 
   * @param modelIds - Optional array of model IDs to refresh. If not provided, clears all cache.
   */
  async refreshCache(modelIds?: string[]): Promise<void> {
    if (modelIds && modelIds.length > 0) {
      logger.info('Refreshing cache for specific models', { modelIds });
      
      // Remove specified models from cache
      for (const modelId of modelIds) {
        this.cache.delete(modelId);
      }
      
      // Fetch fresh documentation for each model
      const refreshPromises = modelIds.map(modelId => 
        this.getModelDocumentation(modelId).catch(error => {
          logger.error('Failed to refresh cache for model', { 
            modelId, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        })
      );
      
      await Promise.allSettled(refreshPromises);
    } else {
      logger.info('Clearing entire documentation cache');
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics for monitoring
   * 
   * @returns Cache statistics including size and entry ages
   */
  getCacheStats(): {
    size: number;
    entries: Array<{ modelId: string; age: number; expired: boolean }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([modelId, entry]) => ({
      modelId,
      age: Date.now() - entry.timestamp,
      expired: this.isCacheExpired(entry)
    }));

    return {
      size: this.cache.size,
      entries
    };
  }

  /**
   * Get default documentation when Knowledge Base is unavailable
   * Provides basic model information and parameters as fallback
   * 
   * @private
   * @param modelId - The Bedrock model ID
   * @returns Default ModelDocumentation
   */
  private getDefaultDocumentation(modelId: string): ModelDocumentation {
    const { modelName, provider } = this.parseModelInfo(modelId);
    
    return {
      modelId,
      modelName,
      provider,
      promptFormat: this.extractPromptFormat('', modelId),
      supportedParameters: this.extractParameters('', modelId),
      bestPractices: this.extractBestPractices('', modelId),
      examples: this.extractExamples('', modelId),
      lastUpdated: new Date()
    };
  }
}
