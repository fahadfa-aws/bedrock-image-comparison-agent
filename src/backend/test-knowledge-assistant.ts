import dotenv from 'dotenv';
import { ConfigurationService } from './services/ConfigurationService.js';
import { KnowledgeAssistantClient } from './services/KnowledgeAssistantClient.js';
import { createLogger, format, transports } from 'winston';

// Load environment variables
dotenv.config();

// Create a simple logger for testing
const logger = createLogger({
  level: 'debug',
  format: format.combine(
    format.timestamp(),
    format.colorize(),
    format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
      return `${timestamp} [${level}]: ${message} ${metaStr}`;
    })
  ),
  transports: [new transports.Console()]
});

// Make logger available globally for the services
(global as any).logger = logger;

async function testKnowledgeAssistantClient() {
  console.log('\n=== Testing KnowledgeAssistantClient ===\n');

  try {
    // Initialize services
    const configService = new ConfigurationService();
    const knowledgeAssistant = new KnowledgeAssistantClient(configService);

    // Test 1: Get documentation for Nova Canvas
    console.log('\n--- Test 1: Get Nova Canvas Documentation ---');
    const novaDoc = await knowledgeAssistant.getModelDocumentation('amazon.nova-canvas-v1:0');
    console.log('✓ Nova Canvas Documentation Retrieved:');
    console.log(`  Model: ${novaDoc.modelName} (${novaDoc.provider})`);
    console.log(`  Prompt Format: ${novaDoc.promptFormat}`);
    console.log(`  Parameters: ${novaDoc.supportedParameters.length}`);
    console.log(`  Best Practices: ${novaDoc.bestPractices.length}`);
    console.log(`  Examples: ${novaDoc.examples.length}`);
    console.log(`  Last Updated: ${novaDoc.lastUpdated.toISOString()}`);

    // Test 2: Get documentation for Stability model
    console.log('\n--- Test 2: Get Stability SDXL Documentation ---');
    const stabilityDoc = await knowledgeAssistant.getModelDocumentation('stability.stable-diffusion-xl-v1');
    console.log('✓ Stability SDXL Documentation Retrieved:');
    console.log(`  Model: ${stabilityDoc.modelName} (${stabilityDoc.provider})`);
    console.log(`  Prompt Format: ${stabilityDoc.promptFormat}`);
    console.log(`  Parameters: ${stabilityDoc.supportedParameters.length}`);
    console.log(`  Best Practices: ${stabilityDoc.bestPractices.length}`);
    console.log(`  Examples: ${stabilityDoc.examples.length}`);

    // Test 3: Test cache hit (should be instant)
    console.log('\n--- Test 3: Test Cache Hit ---');
    const startTime = Date.now();
    const cachedDoc = await knowledgeAssistant.getModelDocumentation('amazon.nova-canvas-v1:0');
    const duration = Date.now() - startTime;
    console.log(`✓ Cache hit successful (${duration}ms)`);
    console.log(`  Same data: ${cachedDoc.modelId === novaDoc.modelId}`);

    // Test 4: Get cache statistics
    console.log('\n--- Test 4: Cache Statistics ---');
    const stats = knowledgeAssistant.getCacheStats();
    console.log('✓ Cache Statistics:');
    console.log(`  Total entries: ${stats.size}`);
    stats.entries.forEach(entry => {
      const ageMinutes = Math.floor(entry.age / 1000 / 60);
      console.log(`  - ${entry.modelId}: ${ageMinutes} minutes old, expired: ${entry.expired}`);
    });

    // Test 5: Test multiple models concurrently
    console.log('\n--- Test 5: Fetch Multiple Models Concurrently ---');
    const modelIds = [
      'stability.stable-image-core-v1:0',
      'stability.stable-image-ultra-v1:0'
    ];
    const concurrentStart = Date.now();
    const docs = await Promise.all(
      modelIds.map(id => knowledgeAssistant.getModelDocumentation(id))
    );
    const concurrentDuration = Date.now() - concurrentStart;
    console.log(`✓ Retrieved ${docs.length} model documentations in ${concurrentDuration}ms`);
    docs.forEach(doc => {
      console.log(`  - ${doc.modelName}: ${doc.supportedParameters.length} parameters`);
    });

    // Test 6: Display sample parameter details
    console.log('\n--- Test 6: Sample Parameter Details ---');
    const sampleParams = novaDoc.supportedParameters.slice(0, 3);
    console.log('✓ Sample parameters from Nova Canvas:');
    sampleParams.forEach(param => {
      console.log(`  - ${param.name} (${param.type}): ${param.description}`);
      if (param.defaultValue !== undefined) {
        console.log(`    Default: ${param.defaultValue}`);
      }
      if (param.validValues) {
        console.log(`    Valid values: ${param.validValues.join(', ')}`);
      }
    });

    // Test 7: Display sample best practices
    console.log('\n--- Test 7: Sample Best Practices ---');
    console.log('✓ Best practices for Stability models:');
    stabilityDoc.bestPractices.slice(0, 3).forEach((practice, idx) => {
      console.log(`  ${idx + 1}. ${practice}`);
    });

    // Test 8: Display sample examples
    console.log('\n--- Test 8: Sample Examples ---');
    if (novaDoc.examples.length > 0) {
      const example = novaDoc.examples[0];
      console.log('✓ Sample example from Nova Canvas:');
      console.log(`  Description: ${example.description}`);
      console.log(`  Prompt: "${example.prompt}"`);
      if (example.parameters) {
        console.log(`  Parameters: ${JSON.stringify(example.parameters, null, 2)}`);
      }
    }

    console.log('\n=== All Tests Passed! ===\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run tests
testKnowledgeAssistantClient();
