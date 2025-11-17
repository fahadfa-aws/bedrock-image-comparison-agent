/**
 * Manual test script for ConfigurationService
 * Run with: npx ts-node --esm src/backend/test-config.ts
 */

import dotenv from 'dotenv';
import { ConfigurationService } from './services/ConfigurationService.js';

// Load environment variables
dotenv.config();

async function testConfigurationService() {
  console.log('=== Testing ConfigurationService ===\n');

  try {
    const configService = new ConfigurationService();

    // Test 1: Get credentials
    console.log('Test 1: Getting AWS credentials...');
    try {
      const credentials = configService.getCredentials();
      console.log('✓ Credentials loaded successfully');
      console.log(`  Region: ${credentials.region || 'not specified'}\n`);
    } catch (error) {
      console.error('✗ Failed to load credentials:', error instanceof Error ? error.message : error);
      console.log('  Make sure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set in .env\n');
    }

    // Test 2: Get available models
    console.log('Test 2: Getting available models...');
    const models = configService.getAvailableModels();
    console.log(`✓ Found ${models.length} available models:`);
    models.forEach(model => {
      console.log(`  - ${model.modelName} (${model.provider}) - ${model.region} - $${model.pricing.perImage}/image`);
    });
    console.log();

    // Test 3: Set selected models
    console.log('Test 3: Setting selected models...');
    try {
      await configService.setSelectedModels([
        'amazon.nova-canvas-v1:0',
        'stability.stable-diffusion-xl-v1'
      ]);
      console.log('✓ Selected models saved successfully\n');
    } catch (error) {
      console.error('✗ Failed to set selected models:', error instanceof Error ? error.message : error);
      console.log();
    }

    // Test 4: Get selected models
    console.log('Test 4: Getting selected models...');
    const selectedModels = configService.getSelectedModels();
    console.log(`✓ Currently selected: ${selectedModels.length} models`);
    selectedModels.forEach(modelId => {
      const model = configService.getModelById(modelId);
      if (model) {
        console.log(`  - ${model.modelName}`);
      }
    });
    console.log();

    // Test 5: Validate model selection constraints
    console.log('Test 5: Testing model selection validation...');
    
    // Test too few models
    try {
      await configService.setSelectedModels(['amazon.nova-canvas-v1:0']);
      console.error('✗ Should have rejected selection with only 1 model');
    } catch (error) {
      console.log('✓ Correctly rejected selection with too few models');
    }

    // Test too many models
    try {
      await configService.setSelectedModels([
        'amazon.nova-canvas-v1:0',
        'stability.stable-diffusion-xl-v1',
        'stability.stable-image-core-v1:0',
        'stability.stable-image-ultra-v1:0',
        'invalid-1',
        'invalid-2',
        'invalid-3'
      ]);
      console.error('✗ Should have rejected selection with too many models');
    } catch (error) {
      console.log('✓ Correctly rejected selection with too many models');
    }

    // Test invalid model ID
    try {
      await configService.setSelectedModels([
        'amazon.nova-canvas-v1:0',
        'invalid-model-id'
      ]);
      console.error('✗ Should have rejected invalid model ID');
    } catch (error) {
      console.log('✓ Correctly rejected invalid model ID');
    }
    console.log();

    // Test 6: Validate IAM permissions (optional - requires valid AWS credentials)
    console.log('Test 6: Validating IAM permissions...');
    console.log('  (This test requires valid AWS credentials and may take a few seconds)');
    try {
      const validation = await configService.validatePermissions();
      console.log(`✓ Permission validation completed in < 5 seconds`);
      console.log(`  Overall valid: ${validation.valid}`);
      console.log(`  us-east-1: ${validation.regions['us-east-1'] ? '✓' : '✗'}`);
      console.log(`  us-west-2: ${validation.regions['us-west-2'] ? '✓' : '✗'}`);
      if (validation.errors && validation.errors.length > 0) {
        console.log('  Errors:');
        validation.errors.forEach(err => console.log(`    - ${err}`));
      }
    } catch (error) {
      console.error('✗ Permission validation failed:', error instanceof Error ? error.message : error);
    }
    console.log();

    console.log('=== All tests completed ===');

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run tests
testConfigurationService().catch(console.error);
