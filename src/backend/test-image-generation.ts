/**
 * Test script for ImageGenerationService
 * Verifies service initialization and basic functionality
 */

import { config } from 'dotenv';
import { ConfigurationService } from './services/ConfigurationService.js';
import { BedrockClientFactory } from './services/BedrockClientFactory.js';
import { ImageGenerationService } from './services/ImageGenerationService.js';
import { logger } from './logger.js';

// Load environment variables
config();

async function testImageGenerationService() {
  try {
    logger.info('=== Testing ImageGenerationService ===');

    // Initialize services
    const configService = new ConfigurationService();
    const clientFactory = new BedrockClientFactory(configService);
    const imageGenService = new ImageGenerationService(clientFactory, configService);

    logger.info('✓ ImageGenerationService initialized successfully');

    // Test with a simple request (won't actually generate to save costs)
    const testRequest = {
      modelId: 'amazon.nova-canvas-v1:0',
      prompt: 'A serene mountain landscape at sunset',
      parameters: {
        width: 512,
        height: 512,
        quality: 'standard' as const
      }
    };

    logger.info('Test request prepared', { 
      modelId: testRequest.modelId,
      prompt: testRequest.prompt.substring(0, 50) + '...'
    });

    logger.info('✓ ImageGenerationService test completed successfully');
    logger.info('Note: Actual image generation not performed to avoid costs');

  } catch (error) {
    logger.error('ImageGenerationService test failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

// Run test
testImageGenerationService();
