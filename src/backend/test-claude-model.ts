/**
 * Test script to find the correct Claude Sonnet model ID
 */

import dotenv from 'dotenv';
import { BedrockClient, ListFoundationModelsCommand } from '@aws-sdk/client-bedrock';

// Load environment variables
dotenv.config();

async function testClaudeModel() {
  console.log('\n=== Finding Claude Sonnet Model ID ===\n');

  try {
    const client = new BedrockClient({
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      }
    });

    const command = new ListFoundationModelsCommand({
      byProvider: 'Anthropic'
    });

    const response = await client.send(command);
    const models = response.modelSummaries || [];

    console.log(`Found ${models.length} Anthropic models:\n`);

    models.forEach(model => {
      if (model.modelId?.includes('sonnet')) {
        console.log(`✓ ${model.modelId}`);
        console.log(`  Name: ${model.modelName}`);
        console.log(`  Inference: ${model.inferenceTypesSupported?.join(', ')}`);
        console.log('');
      }
    });

    process.exit(0);

  } catch (error) {
    console.error('\n✗ Failed to list models\n');
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

testClaudeModel();
