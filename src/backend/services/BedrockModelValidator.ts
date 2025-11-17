import { BedrockClient, ListFoundationModelsCommand } from '@aws-sdk/client-bedrock';
import { ConfigurationService } from './ConfigurationService.js';
import { logger } from '../logger.js';

export interface ValidatedModel {
  modelId: string;
  modelName: string;
  provider: string;
  region: string;
  inferenceTypes: string[];
  isServerless: boolean;
}

export interface ModelValidationResult {
  region: string;
  availableModels: ValidatedModel[];
  totalCount: number;
  serverlessCount: number;
}

export class BedrockModelValidator {
  private configService: ConfigurationService;
  private usEast1Client: BedrockClient;
  private usWest2Client: BedrockClient;

  constructor(configService: ConfigurationService) {
    this.configService = configService;
    const credentials = this.configService.getCredentials();

    this.usEast1Client = new BedrockClient({
      region: 'us-east-1',
      credentials,
    });

    this.usWest2Client = new BedrockClient({
      region: 'us-west-2',
      credentials,
    });
  }

  /**
   * List available foundation models in a specific region
   * Filters for serverless image generation models only
   */
  async listAvailableModels(region: 'us-east-1' | 'us-west-2'): Promise<ModelValidationResult> {
    const client = region === 'us-east-1' ? this.usEast1Client : this.usWest2Client;

    try {
      logger.info(`Fetching available models from Bedrock in ${region}`);

      const command = new ListFoundationModelsCommand({
        byOutputModality: 'IMAGE', // Filter for image generation models
      });

      const response = await client.send(command);
      const models = response.modelSummaries || [];

      // Filter for serverless models only (exclude provisioned throughput)
      const serverlessModels: ValidatedModel[] = models
        .filter((model) => {
          const inferenceTypes = model.inferenceTypesSupported || [];
          // Only include models that support ON_DEMAND (serverless) inference
          return inferenceTypes.includes('ON_DEMAND');
        })
        .map((model) => ({
          modelId: model.modelId || '',
          modelName: model.modelName || '',
          provider: model.providerName || '',
          region,
          inferenceTypes: model.inferenceTypesSupported || [],
          isServerless: true,
        }));

      logger.info(`Found ${serverlessModels.length} serverless image models in ${region}`, {
        models: serverlessModels.map((m) => m.modelId),
      });

      return {
        region,
        availableModels: serverlessModels,
        totalCount: models.length,
        serverlessCount: serverlessModels.length,
      };
    } catch (error: any) {
      logger.error(`Failed to list models in ${region}`, {
        error: error.message,
        code: error.code,
      });
      throw new Error(`Failed to fetch models from ${region}: ${error.message}`);
    }
  }

  /**
   * Validate hardcoded model IDs against actual available models in AWS
   */
  async validateModelRegistry(): Promise<{
    valid: ValidatedModel[];
    invalid: string[];
    warnings: string[];
  }> {
    logger.info('Validating model registry against AWS Bedrock');

    const [usEast1Result, usWest2Result] = await Promise.all([
      this.listAvailableModels('us-east-1'),
      this.listAvailableModels('us-west-2'),
    ]);

    const allAvailableModels = [
      ...usEast1Result.availableModels,
      ...usWest2Result.availableModels,
    ];

    const availableModelIds = new Set(allAvailableModels.map((m) => m.modelId));

    // Get hardcoded models from ConfigurationService
    const hardcodedModels = this.configService.getAvailableModels();
    const valid: ValidatedModel[] = [];
    const invalid: string[] = [];
    const warnings: string[] = [];

    for (const hardcodedModel of hardcodedModels) {
      const modelId = hardcodedModel.modelId;

      if (availableModelIds.has(modelId)) {
        // Find the validated model details
        const validatedModel = allAvailableModels.find((m) => m.modelId === modelId);
        if (validatedModel) {
          valid.push(validatedModel);
          logger.info(`✓ Model validated: ${modelId}`);
        }
      } else {
        invalid.push(modelId);
        warnings.push(
          `Model "${modelId}" is in registry but not available in AWS Bedrock. ` +
            `Check if model access is enabled in the AWS console.`
        );
        logger.warn(`✗ Model not available: ${modelId}`);
      }
    }

    // Check for new models available in AWS but not in our registry
    for (const awsModel of allAvailableModels) {
      const isInRegistry = hardcodedModels.some((m) => m.modelId === awsModel.modelId);
      if (!isInRegistry) {
        warnings.push(
          `New model available in AWS: ${awsModel.modelId} (${awsModel.modelName}). ` +
            `Consider adding to MODEL_REGISTRY.`
        );
        logger.info(`ℹ New model available: ${awsModel.modelId}`);
      }
    }

    logger.info('Model validation complete', {
      validCount: valid.length,
      invalidCount: invalid.length,
      warningCount: warnings.length,
    });

    return { valid, invalid, warnings };
  }

  /**
   * Get all serverless image generation models from both regions
   */
  async getAllServerlessModels(): Promise<ValidatedModel[]> {
    const [usEast1Result, usWest2Result] = await Promise.all([
      this.listAvailableModels('us-east-1'),
      this.listAvailableModels('us-west-2'),
    ]);

    return [...usEast1Result.availableModels, ...usWest2Result.availableModels];
  }
}
