/**
 * Test script to validate Bedrock model IDs from AWS
 * This ensures we're using the correct serverless model IDs
 */

import dotenv from 'dotenv';
import { ConfigurationService } from './services/ConfigurationService.js';
import { logger } from './logger.js';

// Load environment variables
dotenv.config();

async function testModelValidation() {
  console.log('\n=== Bedrock Model Validation Test ===\n');

  try {
    // Initialize configuration service
    console.log('ℹ Initializing ConfigurationService...');
    const configService = new ConfigurationService();
    console.log('✓ ConfigurationService initialized\n');

    // Initialize model validator
    console.log('ℹ Validating model registry against AWS Bedrock...');
    await configService.initializeModelValidator();
    console.log('✓ Model validation complete\n');

    // Get validated models
    const validatedModels = configService.getValidatedModels();
    
    console.log(`✓ Found ${validatedModels.length} valid serverless image generation models:\n`);
    
    // Group by region
    const usEast1Models = validatedModels.filter(m => m.region === 'us-east-1');
    const usWest2Models = validatedModels.filter(m => m.region === 'us-west-2');

    console.log('📍 us-east-1 (Amazon Nova Canvas):');
    usEast1Models.forEach(model => {
      console.log(`  ✓ ${model.modelId}`);
      console.log(`    Name: ${model.modelName}`);
      console.log(`    Provider: ${model.provider}`);
      console.log(`    Inference: ${model.inferenceTypes.join(', ')}`);
      console.log('');
    });

    console.log('📍 us-west-2 (Stability AI):');
    usWest2Models.forEach(model => {
      console.log(`  ✓ ${model.modelId}`);
      console.log(`    Name: ${model.modelName}`);
      console.log(`    Provider: ${model.provider}`);
      console.log(`    Inference: ${model.inferenceTypes.join(', ')}`);
      console.log('');
    });

    console.log('=== Model Validation Test: PASSED ===\n');
    process.exit(0);

  } catch (error) {
    console.error('\n✗ Model validation failed\n');
    console.error('Error details:', error instanceof Error ? error.message : error);
    console.error('\n=== Model Validation Test: FAILED ===\n');
    process.exit(1);
  }
}

// Run the test
testModelValidation();
