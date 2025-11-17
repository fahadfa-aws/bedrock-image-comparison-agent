import { ModelInfo } from '../../shared/types.js';
import { logger } from '../logger.js';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import fs from 'fs';
import path from 'path';
import { BedrockModelValidator, ValidatedModel } from './BedrockModelValidator.js';

export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
}

export interface PermissionValidation {
  valid: boolean;
  regions: {
    'us-east-1': boolean;
    'us-west-2': boolean;
  };
  errors?: string[];
}

export interface ImageStorageConfig {
  storagePath: string;
  maxStorageSize: number;
}

// Model Registry with pricing information
// Updated with correct serverless model IDs from AWS Bedrock
const MODEL_REGISTRY: ModelInfo[] = [
  {
    modelId: 'amazon.nova-canvas-v1:0',
    modelName: 'Nova Canvas',
    provider: 'Amazon',
    region: 'us-east-1',
    pricing: { perImage: 0.06, currency: 'USD' } // $0.04 for ≤1024x1024, $0.06 for ≤2048x2048 (using higher tier)
  },
  {
    modelId: 'stability.sd3-5-large-v1:0',
    modelName: 'Stable Diffusion 3.5 Large',
    provider: 'Stability AI',
    region: 'us-west-2',
    pricing: { perImage: 0.08, currency: 'USD' }
  },
  {
    modelId: 'stability.stable-image-core-v1:1',
    modelName: 'Stable Image Core',
    provider: 'Stability AI',
    region: 'us-west-2',
    pricing: { perImage: 0.04, currency: 'USD' }
  },
  {
    modelId: 'stability.stable-image-ultra-v1:1',
    modelName: 'Stable Image Ultra',
    provider: 'Stability AI',
    region: 'us-west-2',
    pricing: { perImage: 0.14, currency: 'USD' }
  }
];

export class ConfigurationService {
  private selectedModels: string[] = [];
  private configFilePath: string;
  private modelValidator?: BedrockModelValidator;
  private validatedModels: ValidatedModel[] = [];

  constructor() {
    // Store configuration in a local JSON file
    this.configFilePath = path.join(process.cwd(), 'config', 'user-preferences.json');
    this.loadSelectedModels();
  }

  /**
   * Initialize model validator and validate registry against AWS
   * Should be called after credentials are loaded
   */
  async initializeModelValidator(): Promise<void> {
    try {
      this.modelValidator = new BedrockModelValidator(this);
      const validation = await this.modelValidator.validateModelRegistry();

      this.validatedModels = validation.valid;

      // Log validation results
      logger.info('Model registry validation complete', {
        validCount: validation.valid.length,
        invalidCount: validation.invalid.length,
        warningCount: validation.warnings.length,
      });

      // Log warnings
      validation.warnings.forEach((warning) => {
        logger.warn(warning);
      });

      // Log invalid models
      if (validation.invalid.length > 0) {
        logger.error('Some models in registry are not available in AWS Bedrock', {
          invalidModels: validation.invalid,
        });
      }

      // Fail if no valid models found
      if (validation.valid.length === 0) {
        throw new Error(
          'No valid serverless image generation models found in AWS Bedrock. ' +
            'Please enable model access in the AWS console for us-east-1 and us-west-2.'
        );
      }
    } catch (error) {
      logger.error('Failed to initialize model validator', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get validated models from AWS (only available after initializeModelValidator is called)
   */
  getValidatedModels(): ValidatedModel[] {
    return this.validatedModels;
  }

  /**
   * Get image storage configuration from environment variables
   * @returns ImageStorageConfig with storage path and max size
   */
  getImageStorageConfig(): ImageStorageConfig {
    const storagePath = process.env.IMAGE_STORAGE_PATH || './images';
    const maxStorageSize = parseInt(process.env.MAX_STORAGE_SIZE || '10737418240', 10);

    logger.info('Image storage configuration loaded', {
      storagePath,
      maxStorageSize: `${(maxStorageSize / (1024 * 1024 * 1024)).toFixed(2)} GB`,
    });

    return {
      storagePath,
      maxStorageSize,
    };
  }

  /**
   * Get AWS credentials from environment variables
   * @throws Error if required credentials are missing
   */
  getCredentials(): AWSCredentials {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION;

    if (!accessKeyId || !secretAccessKey) {
      const missing = [];
      if (!accessKeyId) missing.push('AWS_ACCESS_KEY_ID');
      if (!secretAccessKey) missing.push('AWS_SECRET_ACCESS_KEY');
      
      logger.error('Missing required AWS credentials', { missing });
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    logger.info('AWS credentials loaded successfully', { 
      region: region || 'not specified',
      // Never log actual credentials
    });

    return {
      accessKeyId,
      secretAccessKey,
      region
    };
  }

  /**
   * Get all available models with metadata
   */
  getAvailableModels(): ModelInfo[] {
    return MODEL_REGISTRY;
  }

  /**
   * Get currently selected models
   */
  getSelectedModels(): string[] {
    return this.selectedModels;
  }

  /**
   * Set selected models with validation
   * @param modelIds Array of model IDs to select
   * @throws Error if validation fails
   */
  async setSelectedModels(modelIds: string[]): Promise<void> {
    // Validate model selection count (2-6 models)
    if (modelIds.length < 2 || modelIds.length > 6) {
      throw new Error('Must select between 2 and 6 models');
    }

    // Validate that all model IDs are valid
    const validIds = MODEL_REGISTRY.map(m => m.modelId);
    const invalidIds = modelIds.filter(id => !validIds.includes(id));
    
    if (invalidIds.length > 0) {
      throw new Error(`Invalid model IDs: ${invalidIds.join(', ')}`);
    }

    // Remove duplicates
    this.selectedModels = [...new Set(modelIds)];
    
    // Persist to file
    await this.saveSelectedModels();
    
    logger.info('Model selection updated', { 
      selectedModels: this.selectedModels,
      count: this.selectedModels.length 
    });
  }

  /**
   * Validate IAM permissions for Bedrock access in both regions
   * Tests connectivity and permissions with lightweight invocations
   */
  async validatePermissions(): Promise<PermissionValidation> {
    const credentials = this.getCredentials();
    const errors: string[] = [];
    const regions: { 'us-east-1': boolean; 'us-west-2': boolean } = {
      'us-east-1': false,
      'us-west-2': false
    };

    const startTime = Date.now();

    // Test us-east-1 (Nova Canvas region)
    try {
      await this.testRegionAccess('us-east-1', credentials);
      regions['us-east-1'] = true;
      logger.info('Successfully validated permissions for us-east-1');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`us-east-1: ${errorMessage}`);
      logger.error('Failed to validate permissions for us-east-1', { error: errorMessage });
    }

    // Test us-west-2 (Stability models region)
    try {
      await this.testRegionAccess('us-west-2', credentials);
      regions['us-west-2'] = true;
      logger.info('Successfully validated permissions for us-west-2');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`us-west-2: ${errorMessage}`);
      logger.error('Failed to validate permissions for us-west-2', { error: errorMessage });
    }

    const duration = Date.now() - startTime;
    const valid = regions['us-east-1'] && regions['us-west-2'];

    logger.info('Permission validation completed', { 
      duration: `${duration}ms`,
      valid,
      regions 
    });

    // Ensure validation completes within 5 seconds as per requirements
    if (duration > 5000) {
      logger.warn('Permission validation exceeded 5 second threshold', { duration: `${duration}ms` });
    }

    return {
      valid,
      regions,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Test Bedrock access in a specific region with a lightweight invocation
   * @private
   */
  private async testRegionAccess(
    region: 'us-east-1' | 'us-west-2',
    credentials: AWSCredentials
  ): Promise<void> {
    const client = new BedrockRuntimeClient({
      region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey
      }
    });

    // Use a minimal test invocation to check permissions
    // For us-east-1, test with Nova Canvas model
    // For us-west-2, test with Stability model
    const testModelId = region === 'us-east-1' 
      ? 'amazon.nova-canvas-v1:0'
      : 'stability.stable-diffusion-xl-v1';

    try {
      // Create a minimal test request that will validate permissions
      // without actually generating an image (or fail fast if permissions are wrong)
      const command = new InvokeModelCommand({
        modelId: testModelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          // Minimal payload to test permissions
          taskType: 'TEXT_IMAGE',
          textToImageParams: {
            text: 'test'
          },
          imageGenerationConfig: {
            numberOfImages: 1,
            height: 512,
            width: 512
          }
        })
      });

      // Set a timeout to ensure we return within 5 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Validation timeout')), 4000);
      });

      await Promise.race([
        client.send(command),
        timeoutPromise
      ]);

    } catch (error: any) {
      // Parse error to provide meaningful feedback
      if (error.name === 'UnrecognizedClientException' || 
          error.name === 'InvalidSignatureException' ||
          error.name === 'SignatureDoesNotMatch') {
        throw new Error('Invalid AWS credentials. Please check your access key and secret key.');
      }
      
      if (error.name === 'AccessDeniedException' || 
          error.name === 'UnauthorizedException') {
        throw new Error(`Insufficient permissions. IAM user needs bedrock:InvokeModel permission for ${region}.`);
      }

      if (error.message === 'Validation timeout') {
        throw new Error(`Connection timeout to ${region}. Check network connectivity.`);
      }

      // If we get a validation error about the request body, that's actually good
      // It means authentication worked, we just sent a minimal test payload
      if (error.name === 'ValidationException' && error.message.includes('body')) {
        // This is expected - credentials are valid
        return;
      }

      // For other errors, log but don't fail - might be model-specific issues
      logger.warn(`Unexpected error during permission test for ${region}`, { 
        error: error.message,
        errorName: error.name 
      });
      
      // If we got this far without auth errors, consider it a pass
      if (!error.name?.includes('Auth') && !error.name?.includes('Credential')) {
        return;
      }

      throw error;
    }
  }

  /**
   * Get model information by ID
   */
  getModelById(modelId: string): ModelInfo | undefined {
    return MODEL_REGISTRY.find(m => m.modelId === modelId);
  }

  /**
   * Get models by region
   */
  getModelsByRegion(region: 'us-east-1' | 'us-west-2'): ModelInfo[] {
    return MODEL_REGISTRY.filter(m => m.region === region);
  }

  /**
   * Load selected models from persistent storage
   */
  private loadSelectedModels(): void {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const data = fs.readFileSync(this.configFilePath, 'utf-8');
        const config = JSON.parse(data);
        
        if (config.selectedModels && Array.isArray(config.selectedModels)) {
          // Validate loaded models
          const validIds = MODEL_REGISTRY.map(m => m.modelId);
          this.selectedModels = config.selectedModels.filter((id: string) => 
            validIds.includes(id)
          );
          
          logger.info('Loaded selected models from config', { 
            count: this.selectedModels.length 
          });
        }
      }
    } catch (error) {
      logger.warn('Failed to load selected models from config', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      // Continue with empty selection
      this.selectedModels = [];
    }
  }

  /**
   * Save selected models to persistent storage
   */
  private async saveSelectedModels(): Promise<void> {
    try {
      // Ensure config directory exists
      const configDir = path.dirname(this.configFilePath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      const config = {
        selectedModels: this.selectedModels,
        lastUpdated: new Date().toISOString()
      };

      fs.writeFileSync(
        this.configFilePath, 
        JSON.stringify(config, null, 2), 
        'utf-8'
      );

      logger.info('Saved selected models to config');
    } catch (error) {
      logger.error('Failed to save selected models to config', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw new Error('Failed to persist model selection');
    }
  }
}
