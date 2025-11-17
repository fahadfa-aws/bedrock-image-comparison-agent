# Prompt Optimizer Service - Developer Guide

## Quick Start

The PromptOptimizerService uses AWS Bedrock API specifications to generate model-specific optimized prompts that follow official AWS best practices.

## How It Works

```typescript
import { PromptOptimizerService } from './services/PromptOptimizerService';
import { ConfigurationService } from './services/ConfigurationService';
import { MCPKnowledgeClient } from './services/MCPKnowledgeClient';

// Initialize services
const configService = new ConfigurationService();
const mcpClient = new MCPKnowledgeClient();
const optimizer = new PromptOptimizerService(configService, mcpClient);

// Optimize a prompt for multiple models
const originalPrompt = "A beautiful sunset over the ocean";
const modelIds = [
  'amazon.nova-canvas-v1:0',
  'amazon.titan-image-generator-v2:0',
  'stability.sd3-5-large-v1:0'
];

const optimizedPrompts = await optimizer.optimizeForModels(originalPrompt, modelIds);

// Each optimized prompt includes:
// - modelId: Exact model identifier
// - optimizedPrompt: Enhanced prompt for the specific model
// - parameters: Model-specific parameters (validated against AWS specs)
// - reasoning: Explanation of optimization choices
```

## Model-Specific Parameter Reference

### Amazon Nova Canvas

```typescript
{
  modelId: "amazon.nova-canvas-v1:0",
  optimizedPrompt: "Enhanced prompt text (max 1024 chars)",
  parameters: {
    width: 1920,              // 256-2816 pixels
    height: 1080,             // 256-2816 pixels
    quality: "premium",       // "standard" | "premium"
    cfgScale: 7.5,           // 1.1-10.0 (prompt adherence)
    seed: 12345,             // 0-2147483646 (reproducibility)
    style: "PHOTOREALISM",   // Optional style preset
    negativeText: "blurry",  // What to exclude (max 1024 chars)
    numberOfImages: 1        // 1-5 images
  }
}
```

**Nova Canvas Styles:**
- `3D_ANIMATED_FAMILY_FILM`
- `DESIGN_SKETCH`
- `FLAT_VECTOR_ILLUSTRATION`
- `GRAPHIC_NOVEL_ILLUSTRATION`
- `MAXIMALISM`
- `MIDCENTURY_RETRO`
- `PHOTOREALISM`
- `SOFT_DIGITAL_PAINTING`

### Amazon Titan Image Generator

```typescript
{
  modelId: "amazon.titan-image-generator-v2:0",
  optimizedPrompt: "Enhanced prompt text (max 512 chars)",
  parameters: {
    width: 1024,             // 384-1408 pixels (specific resolutions)
    height: 1024,            // 384-1408 pixels
    quality: "standard",     // "standard" | "premium"
    cfgScale: 8.0,          // 1.0-10.0
    seed: 42,               // 0-2147483647
    negativeText: "blur",   // What to exclude (max 512 chars)
    numberOfImages: 1       // 1-5 images
  }
}
```

**Titan Supported Resolutions:**
- Square: 1024x1024, 768x768, 512x512
- Landscape: 1152x896, 1173x768, 1280x768, 1280x384
- Portrait: 896x1152, 768x1173, 768x1280, 384x1280

### Stability AI Stable Diffusion

```typescript
{
  modelId: "stability.sd3-5-large-v1:0",
  optimizedPrompt: "Enhanced prompt text (max 10,000 chars)",
  parameters: {
    aspect_ratio: "16:9",        // Predefined aspect ratios
    seed: 999,                   // 0-4294967294
    negative_prompt: "blurry",   // What to exclude (max 10,000 chars)
    output_format: "png"         // "jpeg" | "png" | "webp"
  }
}
```

**Stability Aspect Ratios:**
- `1:1` - Square (1024x1024)
- `16:9` - Landscape (1024x576)
- `21:9` - Ultra-wide (1024x439)
- `9:16` - Portrait (576x1024)
- `4:5`, `5:4`, `2:3`, `3:2`, `9:21` - Various ratios

## Best Practices

### 1. Prompt Writing

#### For Nova Canvas & Titan (Short Prompts)
```typescript
// ✅ Good - Concise and descriptive
"Professional product photo of luxury watch on marble, dramatic lighting"

// ❌ Bad - Too verbose for 512-1024 char limit
"A very detailed and extremely high quality professional photograph of an expensive luxury watch..."
```

#### For Stability AI (Detailed Prompts)
```typescript
// ✅ Good - Detailed with quality descriptors
"Professional product photography of a luxury Swiss watch on polished white marble surface, dramatic side lighting creating deep shadows, studio setup, macro lens, shallow depth of field, 8k resolution, highly detailed, masterpiece quality"

// ❌ Bad - Too simple for Stability's capabilities
"A watch on marble"
```

### 2. Negative Prompts

#### Nova Canvas & Titan
```typescript
// ✅ Good - Use negativeText field, no negating words
parameters: {
  negativeText: "blur, noise, distortion, watermark"
}

// ❌ Bad - Negating words in main prompt
optimizedPrompt: "A landscape without blur and no watermarks"
```

#### Stability AI
```typescript
// ✅ Good - Use negative_prompt field
parameters: {
  negative_prompt: "blurry, low quality, distorted, watermark, text"
}
```

### 3. Quality vs Cost

```typescript
// Premium quality - Higher cost, better results
parameters: {
  quality: "premium",  // Use for final production images
  cfgScale: 8.0       // Higher adherence to prompt
}

// Standard quality - Lower cost, good results
parameters: {
  quality: "standard", // Use for drafts and iterations
  cfgScale: 6.0       // More creative freedom
}
```

### 4. Reproducibility

```typescript
// For reproducible results, set a specific seed
parameters: {
  seed: 42  // Same seed + prompt = same image
}

// For variety, use random seed
parameters: {
  seed: 0   // 0 = random seed (different each time)
}
```

## Common Patterns

### Landscape Photography
```typescript
const prompt = "Mountain landscape at sunset";
// Nova Canvas optimization:
{
  optimizedPrompt: "Majestic mountain landscape at golden hour sunset, dramatic clouds, alpine scenery, photorealistic",
  parameters: {
    width: 1920,
    height: 1080,  // 16:9 for landscapes
    style: "PHOTOREALISM",
    quality: "premium"
  }
}
```

### Product Photography
```typescript
const prompt = "Luxury watch on marble surface";
// Titan optimization:
{
  optimizedPrompt: "Professional product photography of luxury watch on white marble surface, studio lighting, high detail",
  parameters: {
    width: 1024,
    height: 1024,  // Square for product shots
    quality: "premium",
    cfgScale: 8.5  // High adherence for accuracy
  }
}
```

### Artistic/Creative
```typescript
const prompt = "Futuristic cityscape";
// Stability optimization:
{
  optimizedPrompt: "Futuristic cyberpunk cityscape with neon lights, flying cars, towering skyscrapers, dramatic perspective, highly detailed, concept art, masterpiece",
  parameters: {
    aspect_ratio: "21:9",  // Cinematic ultra-wide
    seed: 0,               // Random for variety
    output_format: "png"
  }
}
```

## Validation

Run the validation script to test the optimizer:

```bash
npm run build
node dist/backend/test-prompt-optimizer-validation.js
```

This validates:
- ✅ Correct parameter names for each model
- ✅ Parameter values within AWS-specified ranges
- ✅ Prompt lengths within limits
- ✅ Model IDs match exactly

## Troubleshooting

### Issue: "Prompt too long"
```typescript
// Check max lengths:
// Nova Canvas: 1024 chars
// Titan: 512 chars
// Stability: 10,000 chars

// Solution: Optimizer automatically truncates, but you can pre-shorten:
const shortPrompt = originalPrompt.substring(0, 500);
```

### Issue: "Invalid parameter name"
```typescript
// ❌ Wrong parameter names
parameters: {
  negativePrompt: "blur"  // Wrong for Nova/Titan
}

// ✅ Correct parameter names
parameters: {
  negativeText: "blur"    // Correct for Nova/Titan
  negative_prompt: "blur" // Correct for Stability
}
```

### Issue: "Dimensions not supported"
```typescript
// ❌ Arbitrary dimensions
parameters: {
  width: 1500,  // Not supported by Titan
  height: 900
}

// ✅ Use supported resolutions
parameters: {
  width: 1152,  // Titan-supported landscape
  height: 896
}

// Or for Stability, use aspect ratio
parameters: {
  aspect_ratio: "16:9"  // Let model choose dimensions
}
```

## AWS Documentation Links

- [Nova Canvas API](https://docs.aws.amazon.com/nova/latest/userguide/image-generation.html)
- [Titan Image Generator API](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-titan-image.html)
- [Stable Diffusion 3.5 API](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-diffusion-3-5-large.html)
- [Bedrock InvokeModel API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_InvokeModel.html)

## Support

For issues or questions:
1. Check the validation script output
2. Review AWS Bedrock documentation
3. Verify your AWS credentials and model access
4. Check CloudWatch logs for detailed error messages
