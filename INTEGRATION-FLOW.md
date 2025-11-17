# Image Generation → Gallery Integration Flow

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (React)                            │
│                                                                 │
│  User enters prompt → Optimize → Generate Images               │
│                                                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ POST /api/generate-images
                         │ { optimizedPrompts, originalPrompt }
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend (Express)                           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ImageGenerationService                                  │  │
│  │                                                          │  │
│  │  1. Generate image via AWS Bedrock                      │  │
│  │  2. Receive base64 image data                           │  │
│  │  3. Create unique ID: {modelId}-{timestamp}             │  │
│  │  4. Call saveImageToLibrary()                           │  │
│  │     ├─ Decode base64 → Buffer                           │  │
│  │     ├─ Save PNG file to disk                            │  │
│  │     ├─ Create ImageMetadata object                      │  │
│  │     └─ Call ImageLibraryService.saveImageMetadata()     │  │
│  │                                                          │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                         │                                       │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ImageLibraryService                                     │  │
│  │                                                          │  │
│  │  - Validates image ID                                   │  │
│  │  - Writes metadata JSON file                            │  │
│  │  - Updates in-memory cache                              │  │
│  │                                                          │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                         │                                       │
└─────────────────────────┼───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  File System Storage                            │
│                                                                 │
│  images/                                                        │
│  ├── amazon.nova-canvas-v1:0-1731532800000.png                 │
│  ├── amazon.nova-canvas-v1:0-1731532800000.json                │
│  ├── stability.stable-diffusion-xl-v1-1731532801000.png        │
│  └── stability.stable-diffusion-xl-v1-1731532801000.json       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Image Generation Request
```typescript
{
  modelId: "amazon.nova-canvas-v1:0",
  prompt: "A serene mountain landscape at sunset with vibrant colors",
  parameters: {
    width: 1024,
    height: 1024,
    quality: "premium",
    seed: 42
  },
  originalPrompt: "mountain sunset"
}
```

### 2. Image Generation Result
```typescript
{
  modelId: "amazon.nova-canvas-v1:0",
  modelName: "Nova Canvas",
  provider: "Amazon",
  region: "us-east-1",
  success: true,
  imageBase64: "iVBORw0KGgoAAAANSUhEUgAA...",
  imageFormat: "png",
  generationTime: 8500,
  resolution: { width: 1024, height: 1024 },
  timestamp: Date("2024-11-13T...")
}
```

### 3. Saved Image Metadata
```json
{
  "id": "amazon.nova-canvas-v1:0-1731532800000",
  "imageUrl": "/images/amazon.nova-canvas-v1:0-1731532800000.png",
  "modelId": "amazon.nova-canvas-v1:0",
  "modelName": "Nova Canvas",
  "region": "us-east-1",
  "originalPrompt": "mountain sunset",
  "optimizedPrompt": "A serene mountain landscape at sunset with vibrant colors",
  "parameters": {
    "width": 1024,
    "height": 1024,
    "quality": "premium",
    "seed": 42
  },
  "generatedAt": "2024-11-13T10:00:00.000Z",
  "resolution": {
    "width": 1024,
    "height": 1024
  },
  "fileSize": 2458624,
  "format": "png",
  "generationTime": 8500
}
```

## Key Features

### ✓ Automatic Persistence
- Every successful image generation is automatically saved
- No user action required
- Transparent integration

### ✓ Complete Metadata
- All generation parameters preserved
- Both original and optimized prompts stored
- Timing and performance metrics included

### ✓ Unique Identification
- Format: `{modelId}-{timestamp}`
- Prevents collisions across models
- Sortable by time

### ✓ Error Resilience
- Save failures don't affect generation
- Graceful degradation
- Comprehensive logging

### ✓ Backward Compatible
- Works with or without ImageLibraryService
- Existing code unchanged
- Opt-in integration

## Usage Example

```typescript
// Initialize services
const configService = new ConfigurationService();
const clientFactory = new BedrockClientFactory(configService);
const imageLibraryService = new ImageLibraryService('./images');

// Create service WITH gallery integration
const imageGenService = new ImageGenerationService(
  clientFactory,
  configService,
  imageLibraryService  // ← Gallery integration enabled
);

// Generate images - automatically saved to gallery
const results = await imageGenService.generateImages([
  {
    modelId: 'amazon.nova-canvas-v1:0',
    prompt: 'A serene mountain landscape',
    parameters: { width: 1024, height: 1024 },
    originalPrompt: 'mountain'
  }
]);

// Images are now in ./images/ directory
// Metadata is cached and queryable via ImageLibraryService
```

## Next Steps

With this integration complete, the backend is ready to:
1. ✓ Generate images
2. ✓ Save images to disk
3. ✓ Store complete metadata
4. ✓ Serve images via static file endpoint
5. ✓ Provide gallery API endpoints

The frontend can now:
- Browse saved images via `/api/images`
- View details via `/api/images/:id`
- Delete images via `DELETE /api/images/:id`
- Check storage stats via `/api/images/stats`
