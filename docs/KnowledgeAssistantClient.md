# KnowledgeAssistantClient

The `KnowledgeAssistantClient` provides access to AWS Bedrock model documentation through AWS Knowledge Assistant (Bedrock Agent Runtime). It implements intelligent caching and fallback mechanisms to ensure reliable access to model specifications.

## Features

### 1. Model Documentation Retrieval
- Fetches comprehensive documentation for Bedrock image generation models
- Extracts prompt formats, supported parameters, best practices, and examples
- Parses Knowledge Base responses into structured `ModelDocumentation` objects

### 2. 24-Hour Caching
- In-memory cache with Map data structure
- Automatic cache expiration after 24 hours
- Significantly reduces API calls and improves performance
- Cache statistics available for monitoring

### 3. Fallback Mechanism
- Returns cached data (even if expired) when Knowledge Assistant is unavailable
- Logs warnings when using stale cached documentation
- Ensures service continuity during AWS service disruptions

## Usage

### Basic Usage

```typescript
import { ConfigurationService } from './services/ConfigurationService.js';
import { KnowledgeAssistantClient } from './services/KnowledgeAssistantClient.js';

// Initialize
const configService = new ConfigurationService();
const knowledgeAssistant = new KnowledgeAssistantClient(configService);

// Get model documentation
const documentation = await knowledgeAssistant.getModelDocumentation('amazon.nova-canvas-v1:0');

console.log(documentation.modelName); // "Nova Canvas"
console.log(documentation.promptFormat); // "Natural language description..."
console.log(documentation.supportedParameters); // Array of parameter specs
console.log(documentation.bestPractices); // Array of best practice strings
console.log(documentation.examples); // Array of prompt examples
```

### Cache Management

```typescript
// Get cache statistics
const stats = knowledgeAssistant.getCacheStats();
console.log(`Cache size: ${stats.size}`);
console.log(`Entries:`, stats.entries);

// Manually refresh cache for specific models
await knowledgeAssistant.refreshCache(['amazon.nova-canvas-v1:0']);

// Clear entire cache
await knowledgeAssistant.refreshCache();
```

### Error Handling

```typescript
try {
  const doc = await knowledgeAssistant.getModelDocumentation('some-model-id');
} catch (error) {
  // Error thrown only if:
  // 1. Knowledge Assistant is unavailable AND
  // 2. No cached data exists for the model
  console.error('Failed to retrieve documentation:', error.message);
}
```

## Data Structures

### ModelDocumentation

```typescript
interface ModelDocumentation {
  modelId: string;           // e.g., "amazon.nova-canvas-v1:0"
  modelName: string;         // e.g., "Nova Canvas"
  provider: string;          // e.g., "Amazon"
  promptFormat: string;      // Description of expected prompt format
  supportedParameters: ParameterSpec[];
  bestPractices: string[];
  examples: PromptExample[];
  lastUpdated: Date;
}
```

### ParameterSpec

```typescript
interface ParameterSpec {
  name: string;              // e.g., "width"
  type: string;              // e.g., "number"
  description: string;       // Parameter description
  required: boolean;         // Whether parameter is required
  defaultValue?: any;        // Default value if not specified
  validValues?: any[];       // Array of valid values
}
```

### PromptExample

```typescript
interface PromptExample {
  description: string;       // Example description
  prompt: string;            // Example prompt text
  parameters?: Record<string, any>; // Recommended parameters
}
```

## Configuration

### Environment Variables

```bash
# Required: AWS Knowledge Base ID
AWS_KNOWLEDGE_BASE_ID=your-knowledge-base-id

# Required: AWS Credentials
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Optional: Cache TTL (default: 86400000 = 24 hours)
DOCUMENTATION_CACHE_TTL=86400000
```

### IAM Permissions

The IAM user must have the following permission:

```json
{
  "Effect": "Allow",
  "Action": [
    "bedrock:Retrieve"
  ],
  "Resource": [
    "arn:aws:bedrock:us-east-1:<account-id>:knowledge-base/<knowledge-base-id>"
  ]
}
```

## Implementation Details

### Cache Strategy

1. **First Request**: Fetches from Knowledge Assistant, caches result
2. **Subsequent Requests**: Returns cached data if not expired (< 24 hours)
3. **Expired Cache**: Attempts to fetch fresh data, falls back to expired cache on failure
4. **No Cache**: Throws error if Knowledge Assistant is unavailable

### Fallback Behavior

```
Request → Check Cache → Cache Valid? → Return Cached Data
                     ↓
                     No
                     ↓
          Fetch from Knowledge Assistant
                     ↓
          Success? → Cache & Return
                     ↓
                     No
                     ↓
          Cached Data Exists? → Return Stale Cache (with warning)
                     ↓
                     No
                     ↓
                  Throw Error
```

### Model-Specific Defaults

When Knowledge Assistant is unavailable and no cache exists, the client provides sensible defaults based on model type:

- **Nova Canvas**: Natural language prompts with style modifiers
- **Stability Models**: Comma-separated keywords with negative prompts

## Testing

Run the test suite to verify functionality:

```bash
npm run test:knowledge-assistant
```

The test suite covers:
- Documentation retrieval for multiple models
- Cache hit performance
- Concurrent fetching
- Cache statistics
- Parameter and best practice extraction

## Integration with Prompt Optimizer

The KnowledgeAssistantClient is designed to work seamlessly with the PromptOptimizerService:

```typescript
// In PromptOptimizerService
const novaDoc = await this.knowledgeAssistant.getModelDocumentation('amazon.nova-canvas-v1:0');
const stabilityDoc = await this.knowledgeAssistant.getModelDocumentation('stability.stable-diffusion-xl-v1');

// Use documentation to construct Claude system prompt
const systemPrompt = `
Optimize the user's prompt for these models:

Nova Canvas:
- Format: ${novaDoc.promptFormat}
- Parameters: ${JSON.stringify(novaDoc.supportedParameters)}
- Best Practices: ${novaDoc.bestPractices.join(', ')}

Stability SDXL:
- Format: ${stabilityDoc.promptFormat}
- Parameters: ${JSON.stringify(stabilityDoc.supportedParameters)}
- Best Practices: ${stabilityDoc.bestPractices.join(', ')}
`;
```

## Monitoring

### Cache Performance

Monitor cache effectiveness:

```typescript
const stats = knowledgeAssistant.getCacheStats();

// Calculate cache hit rate
const totalRequests = /* track this in your app */;
const cacheHits = stats.size;
const hitRate = (cacheHits / totalRequests) * 100;

console.log(`Cache hit rate: ${hitRate}%`);
```

### Stale Cache Detection

Check for expired entries:

```typescript
const stats = knowledgeAssistant.getCacheStats();
const expiredEntries = stats.entries.filter(e => e.expired);

if (expiredEntries.length > 0) {
  console.warn(`${expiredEntries.length} cache entries are expired`);
  // Consider refreshing cache
  await knowledgeAssistant.refreshCache(expiredEntries.map(e => e.modelId));
}
```

## Troubleshooting

### Knowledge Assistant Unavailable

**Symptom**: Warnings about using stale cached data

**Solution**: 
1. Check AWS service health dashboard
2. Verify IAM permissions for `bedrock:Retrieve`
3. Confirm Knowledge Base ID is correct
4. Check network connectivity to AWS

### No Cached Data Available

**Symptom**: Error "Unable to retrieve documentation and no cached data exists"

**Solution**:
1. Ensure Knowledge Base ID is configured
2. Verify IAM permissions
3. Check if Knowledge Base exists and is accessible
4. Try manual cache refresh when service is available

### Slow Performance

**Symptom**: Slow response times for documentation requests

**Solution**:
1. Check cache statistics - cache should be hitting most requests
2. Verify cache TTL is set appropriately (24 hours recommended)
3. Consider pre-warming cache on application startup
4. Monitor Knowledge Assistant API latency

## Best Practices

1. **Pre-warm Cache**: Fetch documentation for all models on startup
2. **Monitor Cache**: Regularly check cache statistics
3. **Handle Errors**: Always wrap calls in try-catch
4. **Log Warnings**: Pay attention to stale cache warnings
5. **Refresh Periodically**: Consider scheduled cache refreshes during low-traffic periods
