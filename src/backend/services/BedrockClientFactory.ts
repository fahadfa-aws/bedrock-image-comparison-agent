import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { ConfigurationService } from './ConfigurationService.js';
import { logger } from '../logger.js';

export interface ValidationResult {
  valid: boolean;
  regions: {
    'us-east-1': boolean;
    'us-west-2': boolean;
  };
  errors?: string[];
  duration: number;
}

/**
 * Factory class to manage multi-region Bedrock clients
 * Handles routing of model requests to the appropriate regional client
 */
export class BedrockClientFactory {
  private eastClient: BedrockRuntimeClient;
  private westClient: BedrockRuntimeClient;
  private configService: ConfigurationService;

  constructor(configService: ConfigurationService) {
    this.configService = configService;
    
    const credentials = configService.getCredentials();

    // Initialize BedrockRuntimeClient for us-east-1 (Nova Canvas)
    this.eastClient = new BedrockRuntimeClient({
      region: 'us-east-1',
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey
      }
    });

    // Initialize BedrockRuntimeClient for us-west-2 (Stability models)
    this.westClient = new BedrockRuntimeClient({
      region: 'us-west-2',
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey
      }
    });

    logger.info('BedrockClientFactory initialized with multi-region clients', {
      regions: ['us-east-1', 'us-west-2']
    });
  }

  /**
   * Get the appropriate Bedrock client for a given model ID
   * Routes requests based on model's region
   * 
   * @param modelId - The Bedrock model ID
   * @returns BedrockRuntimeClient configured for the model's region
   * @throws Error if model ID is not found in registry
   */
  getClientForModel(modelId: string): BedrockRuntimeClient {
    const modelInfo = this.configService.getModelById(modelId);
    
    if (!modelInfo) {
      logger.error('Model not found in registry', { modelId });
      throw new Error(`Unknown model ID: ${modelId}`);
    }

    const client = modelInfo.region === 'us-east-1' ? this.eastClient : this.westClient;
    
    logger.debug('Routing model request to regional client', {
      modelId,
      modelName: modelInfo.modelName,
      region: modelInfo.region
    });

    return client;
  }

  /**
   * Get the us-east-1 client directly (for Nova Canvas and Claude)
   */
  getEastClient(): BedrockRuntimeClient {
    return this.eastClient;
  }

  /**
   * Get the us-west-2 client directly (for Stability models)
   */
  getWestClient(): BedrockRuntimeClient {
    return this.westClient;
  }

  /**
   * Get client for a specific region
   * 
   * @param region - AWS region
   * @returns BedrockRuntimeClient for the specified region
   */
  getClientForRegion(region: 'us-east-1' | 'us-west-2'): BedrockRuntimeClient {
    return region === 'us-east-1' ? this.eastClient : this.westClient;
  }

  /**
   * Validate credentials and connectivity to both regions on startup
   * Tests IAM permissions with test InvokeModel calls
   * Returns detailed error messages for authentication failures within 5 seconds
   * 
   * @returns ValidationResult with status for each region
   */
  async validateCredentials(): Promise<ValidationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const regions: { 'us-east-1': boolean; 'us-west-2': boolean } = {
      'us-east-1': false,
      'us-west-2': false
    };

    logger.info('Starting credential validation for both regions');

    // Test both regions concurrently to stay within 5 second requirement
    const validationPromises = [
      this.testRegionConnectivity('us-east-1', this.eastClient),
      this.testRegionConnectivity('us-west-2', this.westClient)
    ];

    const results = await Promise.allSettled(validationPromises);

    // Process us-east-1 result
    if (results[0].status === 'fulfilled') {
      regions['us-east-1'] = true;
      logger.info('Successfully validated connectivity to us-east-1');
    } else {
      const error = results[0].reason;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`us-east-1: ${errorMessage}`);
      logger.error('Failed to validate connectivity to us-east-1', { error: errorMessage });
    }

    // Process us-west-2 result
    if (results[1].status === 'fulfilled') {
      regions['us-west-2'] = true;
      logger.info('Successfully validated connectivity to us-west-2');
    } else {
      const error = results[1].reason;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`us-west-2: ${errorMessage}`);
      logger.error('Failed to validate connectivity to us-west-2', { error: errorMessage });
    }

    const duration = Date.now() - startTime;
    const valid = regions['us-east-1'] && regions['us-west-2'];

    logger.info('Credential validation completed', {
      duration: `${duration}ms`,
      valid,
      regions
    });

    // Warn if validation took longer than 5 seconds
    if (duration > 5000) {
      logger.warn('Credential validation exceeded 5 second threshold', { 
        duration: `${duration}ms` 
      });
    }

    return {
      valid,
      regions,
      errors: errors.length > 0 ? errors : undefined,
      duration
    };
  }

  /**
   * Test connectivity and IAM permissions for a specific region
   * Uses a minimal InvokeModel call to validate access
   * 
   * @private
   * @param region - AWS region to test
   * @param client - BedrockRuntimeClient for the region
   * @throws Error with detailed message if validation fails
   */
  private async testRegionConnectivity(
    region: 'us-east-1' | 'us-west-2',
    client: BedrockRuntimeClient
  ): Promise<void> {
    // Select appropriate test model for the region
    const testModelId = region === 'us-east-1'
      ? 'amazon.nova-canvas-v1:0'
      : 'stability.stable-diffusion-xl-v1';

    logger.debug('Testing connectivity to region', { region, testModelId });

    try {
      // Create a minimal test request to validate permissions
      // This will fail fast if credentials or permissions are invalid
      const command = new InvokeModelCommand({
        modelId: testModelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
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

      // Set a 4-second timeout to ensure we stay within 5 second total requirement
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), 4000);
      });

      await Promise.race([
        client.send(command),
        timeoutPromise
      ]);

      // If we get here, the call succeeded (or failed with a non-auth error)
      logger.debug('Successfully validated region connectivity', { region });

    } catch (error: any) {
      // Parse error to provide detailed, actionable feedback
      const errorName = error.name || '';
      const errorMessage = error.message || '';

      // Authentication errors
      if (errorName === 'UnrecognizedClientException' ||
          errorName === 'InvalidSignatureException' ||
          errorName === 'SignatureDoesNotMatch') {
        throw new Error(
          'Invalid AWS credentials. Please verify your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.'
        );
      }

      // Permission errors
      if (errorName === 'AccessDeniedException' ||
          errorName === 'UnauthorizedException') {
        throw new Error(
          `Insufficient IAM permissions for ${region}. ` +
          `Ensure your IAM user has bedrock:InvokeModel permission for ${testModelId}.`
        );
      }

      // Timeout errors
      if (errorMessage === 'Connection timeout') {
        throw new Error(
          `Connection timeout to ${region}. Check network connectivity and AWS service availability.`
        );
      }

      // Validation errors about request body are actually good
      // They mean authentication worked, we just sent a minimal test payload
      if (errorName === 'ValidationException') {
        // This is expected - credentials are valid, just the request format might be minimal
        logger.debug('Validation error indicates successful authentication', { 
          region, 
          error: errorMessage 
        });
        return;
      }

      // For other errors, check if they're auth-related
      if (errorName.toLowerCase().includes('auth') ||
          errorName.toLowerCase().includes('credential') ||
          errorMessage.toLowerCase().includes('credential')) {
        throw new Error(
          `Authentication error for ${region}: ${errorMessage}`
        );
      }

      // If we got this far without auth errors, consider it a pass
      // The error might be model-specific or request-specific
      logger.debug('Non-authentication error during validation, considering as pass', {
        region,
        errorName,
        errorMessage
      });
    }
  }
}
