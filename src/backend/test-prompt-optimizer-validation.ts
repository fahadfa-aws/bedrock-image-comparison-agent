/**
 * Test script to validate PromptOptimizerService with AWS Bedrock API specifications
 * 
 * This script tests that the prompt optimizer:
 * 1. Uses correct parameter names for each model provider
 * 2. Respects parameter value ranges from AWS documentation
 * 3. Follows AWS Bedrock best practices
 * 4. Generates valid API request structures
 */

import { PromptOptimizerService } from './services/PromptOptimizerService.js';
import { ConfigurationService } from './services/ConfigurationService.js';
import { MCPKnowledgeClient } from './services/MCPKnowledgeClient.js';
import { logger } from './logger.js';

async function validatePromptOptimizer() {
  logger.info('Starting PromptOptimizerService validation with AWS Bedrock API specs');

  try {
    // Initialize services
    const configService = new ConfigurationService();
    const mcpClient = new MCPKnowledgeClient();
    const optimizer = new PromptOptimizerService(configService, mcpClient);

    // Test prompts
    const testPrompts = [
      {
        prompt: 'A serene mountain landscape at sunset with snow-capped peaks',
        description: 'Simple landscape scene'
      },
      {
        prompt: 'A futuristic cityscape with flying cars, neon lights, and towering skyscrapers in a cyberpunk style',
        description: 'Complex scene with style specification'
      },
      {
        prompt: 'Professional product photography of a luxury watch on a marble surface with dramatic lighting',
        description: 'Product photography with technical requirements'
      }
    ];

    // Get available models
    const models = configService.getAvailableModels();
    const modelIds = models.map(m => m.modelId);

    logger.info('Testing with models:', { modelIds });

    // Test each prompt
    for (const test of testPrompts) {
      logger.info(`\n${'='.repeat(80)}`);
      logger.info(`Testing: ${test.description}`);
      logger.info(`Original prompt: "${test.prompt}"`);
      logger.info('='.repeat(80));

      try {
        const optimizedPrompts = await optimizer.optimizeForModels(test.prompt, modelIds);

        // Validate each optimized prompt
        for (const optimized of optimizedPrompts) {
          logger.info(`\n--- ${optimized.modelName} (${optimized.modelId}) ---`);
          
          // Validate model ID matches
          if (!modelIds.includes(optimized.modelId)) {
            logger.error('❌ VALIDATION FAILED: Model ID mismatch', {
              expected: modelIds,
              received: optimized.modelId
            });
            continue;
          }
          logger.info('✓ Model ID is valid');

          // Validate prompt length
          const maxLengths: Record<string, number> = {
            'amazon.nova-canvas': 1024,
            'amazon.titan-image-generator': 512,
            'stability': 10000
          };
          
          let maxLength = 10000; // default
          for (const [prefix, length] of Object.entries(maxLengths)) {
            if (optimized.modelId.startsWith(prefix)) {
              maxLength = length;
              break;
            }
          }

          if (optimized.optimizedPrompt.length > maxLength) {
            logger.error('❌ VALIDATION FAILED: Prompt exceeds max length', {
              length: optimized.optimizedPrompt.length,
              maxLength
            });
          } else {
            logger.info(`✓ Prompt length valid (${optimized.optimizedPrompt.length}/${maxLength} chars)`);
          }

          // Validate parameters based on model
          logger.info('Parameters:', JSON.stringify(optimized.parameters, null, 2));

          if (optimized.modelId.startsWith('amazon.nova-canvas')) {
            validateNovaParameters(optimized.parameters);
          } else if (optimized.modelId.startsWith('amazon.titan-image-generator')) {
            validateTitanParameters(optimized.parameters);
          } else if (optimized.modelId.includes('stability')) {
            validateStabilityParameters(optimized.parameters);
          }

          logger.info('Optimized prompt:', optimized.optimizedPrompt);
          logger.info('Reasoning:', optimized.reasoning);
        }

        logger.info(`\n✅ Successfully optimized for ${optimizedPrompts.length} models`);

      } catch (error) {
        logger.error('❌ Optimization failed', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    logger.info('\n' + '='.repeat(80));
    logger.info('Validation complete');
    logger.info('='.repeat(80));

  } catch (error) {
    logger.error('Validation script failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    process.exit(1);
  }
}

function validateNovaParameters(params: any) {
  logger.info('Validating Amazon Nova Canvas parameters...');
  
  // Check for required dimensions
  if (!params.width || !params.height) {
    logger.warn('⚠️  Missing width or height (should be provided)');
  } else {
    if (params.width < 256 || params.width > 2816) {
      logger.error('❌ Width out of range (256-2816):', params.width);
    } else {
      logger.info('✓ Width valid:', params.width);
    }
    
    if (params.height < 256 || params.height > 2816) {
      logger.error('❌ Height out of range (256-2816):', params.height);
    } else {
      logger.info('✓ Height valid:', params.height);
    }
  }

  // Check quality
  if (params.quality && !['standard', 'premium'].includes(params.quality)) {
    logger.error('❌ Invalid quality value:', params.quality);
  } else if (params.quality) {
    logger.info('✓ Quality valid:', params.quality);
  }

  // Check cfgScale
  if (params.cfgScale !== undefined) {
    if (params.cfgScale < 1.1 || params.cfgScale > 10.0) {
      logger.error('❌ cfgScale out of range (1.1-10.0):', params.cfgScale);
    } else {
      logger.info('✓ cfgScale valid:', params.cfgScale);
    }
  }

  // Check seed
  if (params.seed !== undefined) {
    if (params.seed < 0 || params.seed > 2147483646) {
      logger.error('❌ Seed out of range (0-2147483646):', params.seed);
    } else {
      logger.info('✓ Seed valid:', params.seed);
    }
  }

  // Check style
  const validStyles = [
    '3D_ANIMATED_FAMILY_FILM', 'DESIGN_SKETCH', 'FLAT_VECTOR_ILLUSTRATION',
    'GRAPHIC_NOVEL_ILLUSTRATION', 'MAXIMALISM', 'MIDCENTURY_RETRO',
    'PHOTOREALISM', 'SOFT_DIGITAL_PAINTING'
  ];
  if (params.style && !validStyles.includes(params.style)) {
    logger.error('❌ Invalid style value:', params.style);
  } else if (params.style) {
    logger.info('✓ Style valid:', params.style);
  }

  // Check for correct parameter naming
  if (params.negativePrompt) {
    logger.warn('⚠️  Using "negativePrompt" - Nova Canvas uses "negativeText"');
  }
  if (params.negativeText) {
    logger.info('✓ Using correct parameter name: negativeText');
  }
}

function validateTitanParameters(params: any) {
  logger.info('Validating Amazon Titan Image Generator parameters...');
  
  // Check for required dimensions
  if (!params.width || !params.height) {
    logger.warn('⚠️  Missing width or height (should be provided)');
  } else {
    if (params.width < 384 || params.width > 1408) {
      logger.error('❌ Width out of range (384-1408):', params.width);
    } else {
      logger.info('✓ Width valid:', params.width);
    }
    
    if (params.height < 384 || params.height > 1408) {
      logger.error('❌ Height out of range (384-1408):', params.height);
    } else {
      logger.info('✓ Height valid:', params.height);
    }
  }

  // Check quality
  if (params.quality && !['standard', 'premium'].includes(params.quality)) {
    logger.error('❌ Invalid quality value:', params.quality);
  } else if (params.quality) {
    logger.info('✓ Quality valid:', params.quality);
  }

  // Check cfgScale
  if (params.cfgScale !== undefined) {
    if (params.cfgScale < 1.0 || params.cfgScale > 10.0) {
      logger.error('❌ cfgScale out of range (1.0-10.0):', params.cfgScale);
    } else {
      logger.info('✓ cfgScale valid:', params.cfgScale);
    }
  }

  // Check seed
  if (params.seed !== undefined) {
    if (params.seed < 0 || params.seed > 2147483647) {
      logger.error('❌ Seed out of range (0-2147483647):', params.seed);
    } else {
      logger.info('✓ Seed valid:', params.seed);
    }
  }

  // Check for correct parameter naming
  if (params.negativePrompt) {
    logger.warn('⚠️  Using "negativePrompt" - Titan uses "negativeText"');
  }
  if (params.negativeText) {
    logger.info('✓ Using correct parameter name: negativeText');
  }
}

function validateStabilityParameters(params: any) {
  logger.info('Validating Stability AI parameters...');
  
  // Stability uses aspect_ratio, not width/height
  if (params.width || params.height) {
    logger.warn('⚠️  Stability AI uses aspect_ratio, not width/height');
  }

  if (params.aspect_ratio) {
    const validRatios = ['16:9', '1:1', '21:9', '2:3', '3:2', '4:5', '5:4', '9:16', '9:21'];
    if (!validRatios.includes(params.aspect_ratio)) {
      logger.error('❌ Invalid aspect_ratio:', params.aspect_ratio);
    } else {
      logger.info('✓ aspect_ratio valid:', params.aspect_ratio);
    }
  }

  // Check seed
  if (params.seed !== undefined) {
    if (params.seed < 0 || params.seed > 4294967294) {
      logger.error('❌ Seed out of range (0-4294967294):', params.seed);
    } else {
      logger.info('✓ Seed valid:', params.seed);
    }
  }

  // Check output_format
  if (params.output_format) {
    const validFormats = ['jpeg', 'png', 'webp'];
    if (!validFormats.includes(params.output_format)) {
      logger.error('❌ Invalid output_format:', params.output_format);
    } else {
      logger.info('✓ output_format valid:', params.output_format);
    }
  }

  // Check for correct parameter naming
  if (params.negativePrompt || params.negativeText) {
    logger.warn('⚠️  Stability AI uses "negative_prompt" (with underscore)');
  }
  if (params.negative_prompt) {
    logger.info('✓ Using correct parameter name: negative_prompt');
  }
}

// Run validation
validatePromptOptimizer().catch(error => {
  logger.error('Unhandled error in validation script', {
    error: error instanceof Error ? error.message : 'Unknown error'
  });
  process.exit(1);
});
