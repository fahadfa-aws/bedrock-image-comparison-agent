/**
 * Test script to verify BedrockClientFactory initialization and validation
 * Run with: npm run test:bedrock-factory
 */

import dotenv from 'dotenv';
import { ConfigurationService } from './services/ConfigurationService.js';
import { BedrockClientFactory } from './services/BedrockClientFactory.js';
import { logger } from './logger.js';

// Load environment variables
dotenv.config();

async function testBedrockFactory() {
  try {
    logger.info('=== Testing BedrockClientFactory ===');

    // Initialize services
    logger.info('Step 1: Initializing ConfigurationService...');
    const configService = new ConfigurationService();
    
    logger.info('Step 2: Initializing BedrockClientFactory...');
    const clientFactory = new BedrockClientFactory(configService);

    // Test getting clients for different models
    logger.info('Step 3: Testing client routing...');
    
    const novaClient = clientFactory.getClientForModel('amazon.nova-canvas-v1:0');
    logger.info('✓ Successfully retrieved client for Nova Canvas (us-east-1)');

    const stabilityClient = clientFactory.getClientForModel('stability.stable-diffusion-xl-v1');
    logger.info('✓ Successfully retrieved client for Stability SDXL (us-west-2)');

    // Test direct region access
    logger.info('Step 4: Testing direct region access...');
    const eastClient = clientFactory.getEastClient();
    const westClient = clientFactory.getWestClient();
    logger.info('✓ Successfully retrieved regional clients directly');

    // Test credential validation
    logger.info('Step 5: Validating credentials and connectivity...');
    const validationResult = await clientFactory.validateCredentials();
    
    logger.info('Validation Results:', {
      valid: validationResult.valid,
      duration: `${validationResult.duration}ms`,
      regions: validationResult.regions,
      errors: validationResult.errors
    });

    if (validationResult.valid) {
      logger.info('✓ All regions validated successfully!');
    } else {
      logger.warn('⚠ Some regions failed validation:', validationResult.errors);
    }

    // Test error handling for invalid model
    logger.info('Step 6: Testing error handling...');
    try {
      clientFactory.getClientForModel('invalid-model-id');
      logger.error('✗ Should have thrown error for invalid model');
    } catch (error) {
      logger.info('✓ Correctly threw error for invalid model:', 
        error instanceof Error ? error.message : 'Unknown error'
      );
    }

    logger.info('=== All tests completed ===');
    process.exit(0);

  } catch (error) {
    logger.error('Test failed:', error instanceof Error ? error.message : 'Unknown error');
    if (error instanceof Error && error.stack) {
      logger.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run tests
testBedrockFactory();
