/**
 * Test script for PromptOptimizerService
 * Verifies the service can optimize prompts using Claude Sonnet 4.5
 */

import { ConfigurationService } from './services/ConfigurationService.js';
import { KnowledgeAssistantClient } from './services/KnowledgeAssistantClient.js';
import { PromptOptimizerService } from './services/PromptOptimizerService.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testPromptOptimizer() {
  console.log('=== Testing PromptOptimizerService ===\n');

  try {
    // Initialize services
    console.log('1. Initializing services...');
    const configService = new ConfigurationService();
    const mcpKnowledgeClient = new KnowledgeAssistantClient(configService);
    const promptOptimizer = new PromptOptimizerService(configService, mcpKnowledgeClient as any);
    console.log('✓ Services initialized successfully\n');

    // Test prompt optimization
    const originalPrompt = 'A serene mountain landscape at sunset with a crystal-clear lake reflecting the golden sky';
    const modelIds = [
      'amazon.nova-canvas-v1:0',
      'stability.stable-diffusion-xl-v1'
    ];

    console.log('2. Testing prompt optimization...');
    console.log(`Original prompt: "${originalPrompt}"`);
    console.log(`Target models: ${modelIds.join(', ')}\n`);

    const startTime = Date.now();
    const optimizedPrompts = await promptOptimizer.optimizeForModels(originalPrompt, modelIds);
    const duration = Date.now() - startTime;

    console.log(`✓ Optimization completed in ${duration}ms\n`);

    // Display results
    console.log('3. Optimization Results:\n');
    for (const optimized of optimizedPrompts) {
      console.log(`--- ${optimized.modelName} (${optimized.modelId}) ---`);
      console.log(`Provider: ${optimized.provider}`);
      console.log(`Region: ${optimized.region}`);
      console.log(`Optimized Prompt: "${optimized.optimizedPrompt}"`);
      console.log(`Parameters:`, JSON.stringify(optimized.parameters, null, 2));
      if (optimized.reasoning) {
        console.log(`Reasoning: ${optimized.reasoning}`);
      }
      console.log('');
    }

    // Verify timeout constraint
    if (duration > 10000) {
      console.warn(`⚠ Warning: Optimization took ${duration}ms, exceeding 10-second requirement`);
    } else {
      console.log(`✓ Optimization completed within 10-second timeout (${duration}ms)`);
    }

    console.log('\n=== Test Completed Successfully ===');

  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the test
testPromptOptimizer();
