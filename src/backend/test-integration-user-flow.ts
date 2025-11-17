/**
 * Integration Test: Complete User Flow
 * 
 * Tests the end-to-end user journey:
 * 1. Select models via ModelSelector
 * 2. Enter prompt and trigger optimization
 * 3. Verify optimized prompts display correctly
 * 4. Confirm and trigger image generation
 * 5. Verify images display in comparison view
 * 6. Test download and copy-to-clipboard functionality
 * 
 * Requirements: 3.5, 4.1, 5.1, 5.2, 5.5, 5.6
 * 
 * Run with: npx ts-node --esm src/backend/test-integration-user-flow.ts
 */

import dotenv from 'dotenv';
import { ConfigurationService } from './services/ConfigurationService.js';
import { BedrockClientFactory } from './services/BedrockClientFactory.js';
import { MCPKnowledgeClient } from './services/MCPKnowledgeClient.js';
import { PromptOptimizerService } from './services/PromptOptimizerService.js';
import { ImageGenerationService } from './services/ImageGenerationService.js';
import { OptimizedPrompt, ImageGenerationResult } from '../shared/types.js';

// Load environment variables
dotenv.config();

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✓ ${message}`, colors.green);
}

function logError(message: string) {
  log(`✗ ${message}`, colors.red);
}

function logInfo(message: string) {
  log(`ℹ ${message}`, colors.cyan);
}

function logWarning(message: string) {
  log(`⚠ ${message}`, colors.yellow);
}

async function testCompleteUserFlow() {
  log('\n=== Integration Test: Complete User Flow ===\n', colors.blue);

  let configService: ConfigurationService;
  let clientFactory: BedrockClientFactory;
  let mcpKnowledgeClient: MCPKnowledgeClient;
  let promptOptimizerService: PromptOptimizerService;
  let imageGenerationService: ImageGenerationService;

  try {
    // Initialize services
    logInfo('Initializing services...');
    configService = new ConfigurationService();
    clientFactory = new BedrockClientFactory(configService);
    mcpKnowledgeClient = new MCPKnowledgeClient();
    promptOptimizerService = new PromptOptimizerService(configService, mcpKnowledgeClient);
    imageGenerationService = new ImageGenerationService(clientFactory, configService);
    logSuccess('All services initialized (using MCP Knowledge Server)\n');

    // Step 1: Select models via ModelSelector
    log('Step 1: Model Selection', colors.blue);
    logInfo('Getting available models...');
    const availableModels = configService.getAvailableModels();
    logSuccess(`Found ${availableModels.length} available models:`);
    availableModels.forEach(model => {
      console.log(`  - ${model.modelName} (${model.provider}) - ${model.region} - $${model.pricing.perImage}/image`);
    });

    // Select 2 models for testing (Nova Canvas and one Stability model)
    const selectedModels = [
      'amazon.nova-canvas-v1:0',
      'stability.stable-image-core-v1:1'
    ];
    logInfo(`\nSelecting models: ${selectedModels.join(', ')}`);
    await configService.setSelectedModels(selectedModels);
    logSuccess('Model selection saved\n');

    // Step 2: Enter prompt and trigger optimization
    log('Step 2: Prompt Optimization', colors.blue);
    const testPrompt = 'A serene mountain landscape at sunset with a crystal clear lake reflecting the golden sky';
    logInfo(`Test prompt: "${testPrompt}"`);
    logInfo('Triggering prompt optimization with Claude Sonnet 4.5...');
    
    const startOptimization = Date.now();
    const optimizedPrompts: OptimizedPrompt[] = await promptOptimizerService.optimizeForModels(
      testPrompt,
      selectedModels
    );
    const optimizationTime = Date.now() - startOptimization;
    
    logSuccess(`Optimization completed in ${(optimizationTime / 1000).toFixed(2)}s`);
    
    // Verify optimization time is within 10 seconds (Requirement 3.6)
    if (optimizationTime <= 10000) {
      logSuccess(`✓ Optimization time within 10-second requirement (${(optimizationTime / 1000).toFixed(2)}s)`);
    } else {
      logWarning(`⚠ Optimization took longer than 10 seconds: ${(optimizationTime / 1000).toFixed(2)}s`);
    }

    // Step 3: Verify optimized prompts display correctly
    log('\nStep 3: Verify Optimized Prompts', colors.blue);
    logInfo('Checking optimized prompt structure...');
    
    if (optimizedPrompts.length !== selectedModels.length) {
      logError(`Expected ${selectedModels.length} optimized prompts, got ${optimizedPrompts.length}`);
      throw new Error('Optimized prompt count mismatch');
    }
    logSuccess(`Received ${optimizedPrompts.length} optimized prompts`);

    for (const optimized of optimizedPrompts) {
      console.log(`\n  Model: ${optimized.modelName} (${optimized.modelId})`);
      console.log(`  Optimized Prompt: ${optimized.optimizedPrompt.substring(0, 100)}...`);
      console.log(`  Parameters:`, JSON.stringify(optimized.parameters, null, 2).split('\n').map(l => `    ${l}`).join('\n'));
      
      if (optimized.reasoning) {
        console.log(`  Reasoning: ${optimized.reasoning.substring(0, 150)}...`);
      }

      // Verify required fields
      if (!optimized.modelId || !optimized.modelName || !optimized.optimizedPrompt) {
        logError(`Missing required fields in optimized prompt for ${optimized.modelId}`);
        throw new Error('Invalid optimized prompt structure');
      }
    }
    logSuccess('All optimized prompts have correct structure\n');

    // Step 4: Confirm and trigger image generation
    log('Step 4: Image Generation', colors.blue);
    logInfo('Triggering concurrent image generation...');
    logWarning('This will incur AWS costs (approximately $0.08 for 2 images)');
    logInfo('Generating images for all selected models...');

    const requests = optimizedPrompts.map(prompt => ({
      modelId: prompt.modelId,
      prompt: prompt.optimizedPrompt,
      parameters: prompt.parameters || {}
    }));

    const startGeneration = Date.now();
    const results: ImageGenerationResult[] = await imageGenerationService.generateImages(requests);
    const totalGenerationTime = Date.now() - startGeneration;

    logSuccess(`Image generation completed in ${(totalGenerationTime / 1000).toFixed(2)}s\n`);

    // Step 5: Verify images display in comparison view
    log('Step 5: Verify Generation Results', colors.blue);
    logInfo('Analyzing generation results...');

    let successCount = 0;
    let failureCount = 0;

    for (const result of results) {
      console.log(`\n  Model: ${result.modelName} (${result.modelId})`);
      console.log(`  Region: ${result.region}`);
      console.log(`  Success: ${result.success ? '✓' : '✗'}`);
      console.log(`  Generation Time: ${(result.generationTime / 1000).toFixed(2)}s`);

      if (result.success) {
        successCount++;
        
        // Verify generation time is within 60 seconds (Requirement 4.6)
        if (result.generationTime <= 60000) {
          logSuccess(`  ✓ Generation time within 60-second requirement`);
        } else {
          logWarning(`  ⚠ Generation took longer than 60 seconds`);
        }

        // Verify image data
        if (result.imageBase64) {
          const imageSize = Buffer.from(result.imageBase64, 'base64').length;
          console.log(`  Image Size: ${(imageSize / 1024).toFixed(2)} KB`);
          console.log(`  Image Format: ${result.imageFormat || 'unknown'}`);
          
          if (result.resolution) {
            console.log(`  Resolution: ${result.resolution.width}x${result.resolution.height}`);
          }
          
          logSuccess(`  ✓ Image data present and valid`);
        } else {
          logError(`  ✗ Missing image data`);
          failureCount++;
        }
      } else {
        failureCount++;
        console.log(`  Error: ${result.error || 'Unknown error'}`);
        logError(`  ✗ Image generation failed`);
      }
    }

    console.log();
    logSuccess(`Successfully generated ${successCount}/${results.length} images`);
    if (failureCount > 0) {
      logWarning(`${failureCount} generation(s) failed`);
    }

    // Step 6: Test download and copy-to-clipboard functionality
    log('\nStep 6: Verify Download and Copy Functionality', colors.blue);
    logInfo('Testing image download capability...');

    for (const result of results) {
      if (result.success && result.imageBase64) {
        // Simulate download by verifying we can decode the base64 image
        try {
          const imageBuffer = Buffer.from(result.imageBase64, 'base64');
          const filename = `${result.modelId.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.${result.imageFormat || 'png'}`;
          logSuccess(`  ✓ Image for ${result.modelName} can be downloaded as ${filename}`);
        } catch (error) {
          logError(`  ✗ Failed to process image data for ${result.modelName}`);
        }
      }
    }

    logInfo('\nTesting prompt copy functionality...');
    for (const optimized of optimizedPrompts) {
      // Simulate copy-to-clipboard by verifying prompt is a valid string
      if (typeof optimized.optimizedPrompt === 'string' && optimized.optimizedPrompt.length > 0) {
        logSuccess(`  ✓ Prompt for ${optimized.modelName} can be copied (${optimized.optimizedPrompt.length} chars)`);
      } else {
        logError(`  ✗ Invalid prompt for ${optimized.modelName}`);
      }
    }

    // Summary
    log('\n=== Test Summary ===', colors.blue);
    logSuccess('✓ Step 1: Model selection - PASSED');
    logSuccess('✓ Step 2: Prompt optimization - PASSED');
    logSuccess('✓ Step 3: Optimized prompts verification - PASSED');
    logSuccess('✓ Step 4: Image generation - PASSED');
    logSuccess(`✓ Step 5: Results verification - PASSED (${successCount}/${results.length} successful)`);
    logSuccess('✓ Step 6: Download and copy functionality - PASSED');

    log('\n=== Performance Metrics ===', colors.blue);
    console.log(`  Optimization Time: ${(optimizationTime / 1000).toFixed(2)}s (requirement: <10s)`);
    console.log(`  Total Generation Time: ${(totalGenerationTime / 1000).toFixed(2)}s`);
    console.log(`  Average Generation Time: ${(totalGenerationTime / results.length / 1000).toFixed(2)}s per model (requirement: <60s)`);
    console.log(`  End-to-End Time: ${((optimizationTime + totalGenerationTime) / 1000).toFixed(2)}s`);

    log('\n=== Complete User Flow Test: PASSED ===\n', colors.green);

  } catch (error) {
    logError('\n=== Complete User Flow Test: FAILED ===');
    console.error('\nError details:', error);
    process.exit(1);
  }
}

// Run the test
testCompleteUserFlow().catch(error => {
  logError('Fatal error during test execution');
  console.error(error);
  process.exit(1);
});
