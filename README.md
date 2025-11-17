# Bedrock Image Comparison Agent

A web application that enables comparison of AWS Bedrock image generation models (Amazon Nova Canvas and Stability AI) with intelligent prompt optimization using Claude Sonnet 4.5 and AWS Knowledge Assistant.

## ⚠️ Important: AWS Credentials Required

**Before running this application, you MUST configure your AWS credentials in the `.env` file.**

This application requires:
- **AWS Access Key ID** - Your IAM user access key
- **AWS Secret Access Key** - Your IAM user secret key  
- **AWS Knowledge Base ID** - Your Knowledge Base ID (or set to `disabled` to use fallback mode)

See the [Quick Start](#quick-start) section below for setup instructions. The `.env.example` file contains a template with all required configuration options.

**Security Note**: Never commit your `.env` file with real credentials to version control. The `.env` file is already included in `.gitignore`.

## Overview

This tool helps you explore AWS Bedrock image generation models as an alternative to Midjourney. It automatically optimizes your prompts for each model's specific requirements and generates images concurrently across multiple models, allowing you to compare results side-by-side.

### Key Features

- **Multi-Model Support**: Compare Amazon Nova Canvas and Stability AI models (SDXL, Core, Ultra)
- **Intelligent Prompt Optimization**: Claude Sonnet 4.5 adapts your prompts for each model's strengths
- **Real-Time Documentation**: AWS Knowledge Assistant provides up-to-date model specifications
- **Concurrent Generation**: Generate images from all models simultaneously
- **Side-by-Side Comparison**: View results in an intuitive comparison interface
- **Multi-Region Support**: Seamlessly access models across us-east-1 and us-west-2
- **Persistent Image Gallery**: Browse, search, and manage all your generated images
- **Advanced Filtering**: Filter by model, search by prompt, and sort by date or model name
- **Image Management**: Download, delete, and view detailed metadata for any image
- **Storage Statistics**: Track your image collection size and storage usage

## Prerequisites

Before you begin, ensure you have:

- **Node.js 20+** and npm installed
- **AWS Account** with access to:
  - AWS Bedrock in us-east-1 (Nova Canvas, Claude Sonnet 4.5)
  - AWS Bedrock in us-west-2 (Stability AI models)
  - AWS Knowledge Base (for model documentation)
- **IAM User** with programmatic access (Access Key ID and Secret Access Key)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your AWS credentials:

```bash
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_KNOWLEDGE_BASE_ID=your-knowledge-base-id
```

### 3. Run Development Servers

Open two terminal windows:

```bash
# Terminal 1 - Backend API server
npm run dev:backend

# Terminal 2 - Frontend development server
npm run dev:frontend
```

The application will be available at:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000`

**Note**: The `images/` directory will be automatically created when you generate your first image. All generated images are saved to this directory and can be browsed in the Gallery tab.

## AWS Setup Guide

### Step 1: Create IAM User

1. Sign in to the AWS Console
2. Navigate to **IAM** → **Users** → **Create user**
3. Enter a username (e.g., `bedrock-image-agent`)
4. Select **Programmatic access** (Access key - Programmatic access)
5. Click **Next**

### Step 2: Attach IAM Policy

You have two options for attaching permissions:

#### Option A: Use the Provided Policy File (Recommended)

1. In the IAM console, go to **Policies** → **Create policy**
2. Click the **JSON** tab
3. Copy the contents of `iam-policy.json` from this repository
4. Paste into the policy editor
5. Click **Next: Tags** → **Next: Review**
6. Name the policy `BedrockImageComparisonPolicy`
7. Click **Create policy**
8. Return to your IAM user and click **Add permissions** → **Attach policies directly**
9. Search for `BedrockImageComparisonPolicy` and select it
10. Click **Next** → **Add permissions**

#### Option B: Attach AWS Managed Policies

Attach these AWS managed policies to your IAM user:
- `AmazonBedrockFullAccess` (or create a custom policy with limited scope)

**Note**: The custom policy in `iam-policy.json` follows the principle of least privilege and is recommended for production use.

### Step 3: Generate Access Keys

1. Select your IAM user
2. Go to **Security credentials** tab
3. Click **Create access key**
4. Select **Application running outside AWS**
5. Click **Next** → **Create access key**
6. **Important**: Save the Access Key ID and Secret Access Key securely
7. Add these credentials to your `.env` file

### Step 4: Enable Bedrock Model Access

1. Navigate to **AWS Bedrock** console
2. Go to **Model access** in the left sidebar
3. Click **Manage model access** or **Enable specific models**
4. Enable the following models:
   - **Amazon Nova Canvas** (us-east-1)
   - **Claude Sonnet 4.5** (us-east-1)
   - **Stability AI SDXL** (us-west-2)
   - **Stability AI Core** (us-west-2)
   - **Stability AI Ultra** (us-west-2)
5. Click **Save changes**

**Note**: Model access may take a few minutes to activate.

### Step 5: Set Up AWS Knowledge Base

1. Navigate to **AWS Bedrock** → **Knowledge bases**
2. Create a new Knowledge Base or use an existing one
3. Ensure it contains Bedrock model documentation
4. Copy the Knowledge Base ID (10 alphanumeric characters)
5. Add it to your `.env` file as `AWS_KNOWLEDGE_BASE_ID`

## IAM Policy Details

The application requires the following permissions:

### Bedrock Model Invocation
```json
{
  "Effect": "Allow",
  "Action": ["bedrock:InvokeModel"],
  "Resource": [
    "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-canvas-v1:0",
    "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-5-v2:0",
    "arn:aws:bedrock:us-west-2::foundation-model/stability.stable-diffusion-xl-v1",
    "arn:aws:bedrock:us-west-2::foundation-model/stability.stable-image-core-v1:0",
    "arn:aws:bedrock:us-west-2::foundation-model/stability.stable-image-ultra-v1:0"
  ]
}
```

### Knowledge Base Access
```json
{
  "Effect": "Allow",
  "Action": ["bedrock:Retrieve"],
  "Resource": ["arn:aws:bedrock:us-east-1:*:knowledge-base/*"]
}
```

See `iam-policy.json` for the complete policy.

## Project Structure

```
bedrock-image-comparison-agent/
├── src/
│   ├── backend/                    # Express.js backend server
│   │   ├── index.ts               # Main server entry point
│   │   ├── errors.ts              # Custom error classes
│   │   ├── logger.ts              # Logging utility
│   │   └── services/              # Business logic services
│   │       ├── BedrockClientFactory.ts
│   │       ├── BedrockModelValidator.ts
│   │       ├── ConfigurationService.ts
│   │       ├── ImageGenerationService.ts
│   │       ├── ImageLibraryService.ts      # Gallery storage service
│   │       ├── KnowledgeAssistantClient.ts
│   │       ├── MCPKnowledgeClient.ts
│   │       ├── ModelDefaults.ts
│   │       └── PromptOptimizerService.ts
│   ├── frontend/                   # React frontend application
│   │   ├── App.tsx                # Main React component with tab navigation
│   │   ├── components/            # UI components
│   │   │   ├── ComparisonView.tsx
│   │   │   ├── ErrorDisplay.tsx
│   │   │   ├── GalleryHeader.tsx          # Gallery filter controls
│   │   │   ├── GalleryView.tsx            # Gallery container
│   │   │   ├── ImageCard.tsx              # Gallery image card
│   │   │   ├── ImageGrid.tsx              # Gallery grid layout
│   │   │   ├── ImageModal.tsx             # Image detail modal
│   │   │   ├── ImageResultCard.tsx
│   │   │   ├── LoadingIndicator.tsx
│   │   │   ├── ModelSelector.tsx
│   │   │   ├── OptimizationView.tsx
│   │   │   ├── PromptInput.tsx
│   │   │   ├── Toast.tsx                  # Toast notification
│   │   │   └── ToastContainer.tsx         # Toast manager
│   │   ├── contexts/              # React contexts
│   │   │   └── ToastContext.tsx           # Toast notification context
│   │   └── hooks/                 # Custom React hooks
│   │       ├── useApi.ts
│   │       ├── useImageActions.ts         # Gallery actions
│   │       ├── useImageGallery.ts         # Gallery data fetching
│   │       └── useImageStats.ts           # Storage statistics
│   └── shared/                     # Shared TypeScript types
│       └── types.ts
├── dist/                           # Build output (generated)
├── images/                         # Generated images storage (gitignored)
│   ├── {modelId}-{timestamp}.png  # Image files
│   └── {modelId}-{timestamp}.json # Image metadata
├── config/                         # Runtime configuration
│   └── user-preferences.json      # Saved model selections
├── .env.example                    # Environment variables template
├── iam-policy.json                 # IAM policy for AWS setup
├── package.json                    # Dependencies and scripts
└── README.md                       # This file
```

## Available Scripts

### Development

```bash
# Run backend development server with auto-reload
npm run dev:backend

# Run frontend development server with hot module replacement
npm run dev:frontend
```

### Testing

```bash
# Unit/Component Tests
npm run test:config                    # Test configuration service
npm run test:bedrock-factory           # Test Bedrock client factory
npm run test:knowledge-assistant       # Test Knowledge Assistant client
npm run test:prompt-optimizer          # Test prompt optimizer service

# Integration Tests
npm run test:integration:user-flow     # Test complete user flow
npm run test:integration:errors        # Test error scenarios
npm run test:integration:multi-region  # Test multi-region functionality
npm run test:integration:performance   # Test performance requirements
npm run test:integration:all           # Run all integration tests
```

**Note**: Integration tests make real AWS API calls and will incur costs (~$0.68 total). See [TESTING.md](./TESTING.md) for detailed testing documentation.

### Production

```bash
# Build both backend and frontend
npm run build

# Build backend only
npm run build:backend

# Build frontend only
npm run build:frontend

# Start production server
npm start
```

## Gallery Features

The application includes a comprehensive image gallery that automatically saves all generated images with their metadata, allowing you to browse, search, and manage your entire collection.

### Gallery Interface

The gallery provides a visual grid layout that displays all your generated images with:
- **Thumbnail previews** with model badges and generation dates
- **Responsive design** that adapts to mobile, tablet, and desktop screens
- **Lazy loading** for optimal performance with large collections
- **Real-time statistics** showing total images and storage usage

### Browsing and Navigation

Switch between the Generate and Gallery views using the navigation tabs at the top of the application:
- **Generate Tab**: Create new images with prompt optimization and model comparison
- **Gallery Tab**: Browse and manage your entire image collection

The gallery automatically refreshes when you switch to it after generating new images, ensuring you always see your latest creations.

### Filtering and Search

Find specific images quickly using the powerful filtering tools:

**Filter by Model**
- Select a specific model from the dropdown to view only images generated by that model
- Choose "All Models" to view your entire collection

**Search by Prompt**
- Type keywords in the search box to filter images by their prompts
- Search works on both original and optimized prompts
- Results update in real-time as you type (with 300ms debouncing for performance)

**Sort Options**
- **Newest First**: Show most recently generated images at the top (default)
- **Oldest First**: Show your earliest images first
- **Model Name**: Group images by model in alphabetical order

### Image Details

Click any image card to open a full-screen modal with comprehensive information:

**Image Display**
- Full-resolution image viewer
- Original prompt and optimized prompt used for generation
- Model name, ID, and region

**Generation Parameters**
- Image dimensions (width × height)
- Quality settings
- Seed value (if applicable)
- CFG scale and steps (for Stability AI models)
- Negative prompt (if used)

**Metadata**
- Generation timestamp
- Generation time (in seconds)
- File size (formatted in KB/MB)
- Image format (PNG/JPEG)

### Image Management

**Download Images**
- Click the Download button in the image modal to save the full-resolution image
- Images are downloaded with descriptive filenames: `{modelName}-{timestamp}.png`
- Success notification confirms the download

**Delete Images**
- Hover over any image card to reveal the delete button
- Click delete and confirm to permanently remove the image
- Both the image file and metadata are deleted
- Gallery automatically refreshes and updates storage statistics
- Success notification confirms deletion

**Copy Prompts**
- Click "Copy Prompt" in the image modal to copy the optimized prompt to your clipboard
- Use copied prompts to regenerate similar images or share with others

### Storage Statistics

The gallery header displays real-time storage information:
- **Total Images**: Count of all images in your collection
- **Storage Used**: Total disk space used, formatted in appropriate units (B, KB, MB, GB)
- Statistics update automatically when images are added or deleted

### Automatic Image Saving

Every image you generate is automatically saved to the gallery:
- Images are stored in the `images/` directory
- Each image has a corresponding JSON metadata file
- Unique identifiers prevent filename conflicts: `{modelId}-{timestamp}`
- No manual saving required - just generate and browse later

### Performance Features

The gallery is optimized for large collections:
- **Lazy Loading**: Images load in batches of 20 as you scroll
- **Metadata Caching**: 1-minute cache reduces file system reads
- **Debounced Search**: 300ms delay prevents excessive filtering
- **Responsive Grid**: Automatically adjusts columns based on screen size
  - Mobile (< 768px): 1-2 columns
  - Tablet (768px - 1024px): 2-3 columns
  - Desktop (> 1024px): 3-4 columns

### Empty States

The gallery provides helpful messages when:
- **No images exist**: "No images in gallery yet. Generate some images to get started!"
- **No search results**: "No images match your filters. Try adjusting your search or filter criteria."
- **Loading**: Animated loading indicator while fetching images

## API Endpoints

### Image Generation Endpoints

### POST /api/optimize-prompt

Optimize a user prompt for selected models using Claude Sonnet 4.5.

**Request:**
```json
{
  "originalPrompt": "A serene mountain landscape at sunset",
  "selectedModels": [
    "amazon.nova-canvas-v1:0",
    "stability.stable-diffusion-xl-v1"
  ]
}
```

**Response:**
```json
{
  "originalPrompt": "A serene mountain landscape at sunset",
  "optimizedPrompts": [
    {
      "modelId": "amazon.nova-canvas-v1:0",
      "modelName": "Nova Canvas",
      "optimizedPrompt": "Serene mountain landscape, golden hour sunset...",
      "parameters": {
        "width": 1024,
        "height": 1024,
        "quality": "premium"
      },
      "reasoning": "Enhanced with lighting details for Nova Canvas"
    }
  ]
}
```

### POST /api/generate-images

Generate images from optimized prompts across multiple models.

**Request:**
```json
{
  "optimizedPrompts": [
    {
      "modelId": "amazon.nova-canvas-v1:0",
      "optimizedPrompt": "Serene mountain landscape...",
      "parameters": {
        "width": 1024,
        "height": 1024
      }
    }
  ]
}
```

**Response:**
```json
{
  "results": [
    {
      "modelId": "amazon.nova-canvas-v1:0",
      "modelName": "Nova Canvas",
      "region": "us-east-1",
      "success": true,
      "imageBase64": "iVBORw0KGgoAAAANSUhEUgAA...",
      "imageFormat": "png",
      "generationTime": 8543,
      "resolution": {
        "width": 1024,
        "height": 1024
      }
    }
  ]
}
```

### GET /api/models

Get available image generation models with metadata.

**Response:**
```json
{
  "models": [
    {
      "modelId": "amazon.nova-canvas-v1:0",
      "modelName": "Nova Canvas",
      "provider": "Amazon",
      "region": "us-east-1",
      "pricing": {
        "perImage": 0.04,
        "currency": "USD"
      }
    }
  ]
}
```

### POST /api/config/models

Save user's selected models for future sessions.

**Request:**
```json
{
  "selectedModels": [
    "amazon.nova-canvas-v1:0",
    "stability.stable-diffusion-xl-v1"
  ]
}
```

**Response:**
```json
{
  "success": true
}
```

### GET /api/health

Check system health and connectivity to AWS services.

**Response:**
```json
{
  "status": "healthy",
  "regions": {
    "us-east-1": true,
    "us-west-2": true
  },
  "knowledgeAssistant": true
}
```

### Gallery Endpoints

### GET /api/images

Retrieve all images with optional filtering, searching, sorting, and pagination.

**Query Parameters:**
- `model` (optional): Filter by model ID (e.g., `amazon.nova-canvas-v1:0`)
- `search` (optional): Search by prompt text
- `sort` (optional): Sort order - `newest` (default), `oldest`, or `model`
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Images per page (default: 20, max: 100)

**Example Request:**
```
GET /api/images?model=amazon.nova-canvas-v1:0&search=mountain&sort=newest&page=1&limit=20
```

**Response:**
```json
{
  "images": [
    {
      "id": "amazon.nova-canvas-v1:0-1234567890",
      "imageUrl": "/images/amazon.nova-canvas-v1:0-1234567890.png",
      "modelId": "amazon.nova-canvas-v1:0",
      "modelName": "Nova Canvas",
      "region": "us-east-1",
      "originalPrompt": "A serene mountain landscape",
      "optimizedPrompt": "Serene mountain landscape, golden hour sunset...",
      "parameters": {
        "width": 1024,
        "height": 1024,
        "quality": "premium"
      },
      "generatedAt": "2024-01-15T10:30:00.000Z",
      "resolution": {
        "width": 1024,
        "height": 1024
      },
      "fileSize": 2458624,
      "format": "png",
      "generationTime": 8543
    }
  ],
  "total": 42,
  "page": 1,
  "hasMore": true
}
```

### GET /api/images/:id

Retrieve detailed metadata for a specific image.

**Parameters:**
- `id`: Image identifier (e.g., `amazon.nova-canvas-v1:0-1234567890`)

**Example Request:**
```
GET /api/images/amazon.nova-canvas-v1:0-1234567890
```

**Response:**
```json
{
  "metadata": {
    "id": "amazon.nova-canvas-v1:0-1234567890",
    "imageUrl": "/images/amazon.nova-canvas-v1:0-1234567890.png",
    "modelId": "amazon.nova-canvas-v1:0",
    "modelName": "Nova Canvas",
    "region": "us-east-1",
    "originalPrompt": "A serene mountain landscape",
    "optimizedPrompt": "Serene mountain landscape, golden hour sunset...",
    "parameters": {
      "width": 1024,
      "height": 1024,
      "quality": "premium",
      "seed": 42
    },
    "generatedAt": "2024-01-15T10:30:00.000Z",
    "resolution": {
      "width": 1024,
      "height": 1024
    },
    "fileSize": 2458624,
    "format": "png",
    "generationTime": 8543
  }
}
```

**Error Response (404):**
```json
{
  "error": "Image not found",
  "imageId": "invalid-id"
}
```

### DELETE /api/images/:id

Delete an image and its metadata from the gallery.

**Parameters:**
- `id`: Image identifier to delete

**Example Request:**
```
DELETE /api/images/amazon.nova-canvas-v1:0-1234567890
```

**Response:**
```json
{
  "success": true,
  "message": "Image deleted successfully",
  "imageId": "amazon.nova-canvas-v1:0-1234567890"
}
```

**Error Response (404):**
```json
{
  "error": "Image not found",
  "imageId": "invalid-id"
}
```

**Error Response (500):**
```json
{
  "error": "Failed to delete image",
  "details": "Permission denied"
}
```

### GET /api/images/stats

Retrieve storage statistics for the image gallery.

**Response:**
```json
{
  "totalImages": 42,
  "totalSize": 103546880,
  "sizeByModel": {
    "amazon.nova-canvas-v1:0": 45678912,
    "stability.stable-diffusion-xl-v1": 32456789,
    "stability.stable-image-core-v1:0": 25411179
  },
  "oldestImage": "2024-01-10T08:15:00.000Z",
  "newestImage": "2024-01-15T10:30:00.000Z"
}
```

### Static File Serving

Images are served as static files through Express:

**Image URL Format:**
```
GET /images/{modelId}-{timestamp}.png
```

**Example:**
```
GET /images/amazon.nova-canvas-v1:0-1234567890.png
```

Images are served with appropriate MIME types and can be accessed directly in the browser or downloaded.

## Usage Guide

### Generating Images

#### 1. Select Models

When you first open the application, you'll see a grid of available models. Select 2-6 models you want to compare. Your selection will be saved for future sessions.

#### 2. Enter Your Prompt

Type your image description in natural language. For example:
- "A futuristic city at night with neon lights"
- "A photorealistic portrait of a golden retriever"
- "Abstract art with vibrant colors and geometric shapes"

#### 3. Review Optimized Prompts

The system will use Claude Sonnet 4.5 to optimize your prompt for each selected model. You'll see:
- Your original prompt
- Model-specific optimized prompts
- Recommended parameters for each model
- Reasoning for the optimizations

You can edit any optimized prompt before proceeding.

#### 4. Generate and Compare

Click "Generate Images" to create images from all models simultaneously. The comparison view shows:
- All generated images side-by-side
- Model name, region, and generation time
- The optimized prompt used for each image
- Image resolution and quality

#### 5. View in Gallery

After generating images, click "View in Gallery" to see your new images alongside your entire collection. All generated images are automatically saved.

### Using the Gallery

#### Browsing Your Collection

1. Click the **Gallery** tab in the navigation header
2. Your images appear in a responsive grid layout
3. Scroll down to load more images (lazy loading in batches of 20)
4. View storage statistics at the top showing total images and disk usage

#### Filtering and Searching

**Filter by Model:**
1. Click the "Filter by Model" dropdown in the gallery header
2. Select a specific model to view only images from that model
3. Select "All Models" to view everything

**Search by Prompt:**
1. Type keywords in the search box
2. Results filter in real-time as you type
3. Search works on both original and optimized prompts
4. Click the X button to clear the search

**Sort Images:**
1. Click the "Sort" dropdown
2. Choose from:
   - **Newest First** - Most recent images at the top (default)
   - **Oldest First** - Earliest images first
   - **Model Name** - Grouped by model alphabetically

#### Viewing Image Details

1. Click any image card to open the detail modal
2. View the full-resolution image on the left
3. Review all metadata on the right:
   - Original and optimized prompts
   - Generation parameters (dimensions, quality, seed, etc.)
   - Metadata (generation time, file size, date)

#### Managing Images

**Download an Image:**
1. Click an image to open the detail modal
2. Click the **Download** button
3. Image saves with a descriptive filename
4. Success notification confirms the download

**Copy a Prompt:**
1. Open the image detail modal
2. Click **Copy Prompt** to copy the optimized prompt
3. Use the copied prompt to regenerate similar images

**Delete an Image:**
1. Hover over an image card to reveal the delete button, OR
2. Open the image detail modal and click **Delete**
3. Confirm the deletion in the dialog
4. Image and metadata are permanently removed
5. Gallery refreshes and statistics update

#### Keyboard Shortcuts

- **Escape** - Close the image detail modal
- **Tab** - Navigate between filter controls
- **Enter** - Confirm actions in dialogs

### Tips for Best Results

**Prompt Writing:**
- Be specific about style, lighting, and composition
- Mention desired mood or atmosphere
- Include technical details (e.g., "photorealistic", "oil painting style")
- Let Claude optimize - it knows each model's strengths

**Model Selection:**
- Nova Canvas: Great for photorealistic images and detailed scenes
- Stability SDXL: Versatile, good for artistic styles
- Stability Core: Fast generation, good quality
- Stability Ultra: Highest quality, best for professional use

**Gallery Management:**
- Use search to find images by theme or subject
- Filter by model to compare how different models handle similar prompts
- Delete unsuccessful generations to save storage space
- Download your favorites before they fill up storage

## Configuration

### Environment Variables

All configuration is done through environment variables. See `.env.example` for a complete list with descriptions.

**Required Variables:**
- `AWS_ACCESS_KEY_ID` - Your IAM access key
- `AWS_SECRET_ACCESS_KEY` - Your IAM secret key
- `AWS_KNOWLEDGE_BASE_ID` - Knowledge Base ID for model documentation

**Optional Variables:**
- `PORT` - API server port (default: 3000)
- `LOG_LEVEL` - Logging verbosity (default: info)
- `GENERATION_TIMEOUT` - Timeout per model in ms (default: 60000)
- `MAX_CONCURRENT_GENERATIONS` - Max models to run simultaneously (default: 6)

**Gallery Configuration:**
- `IMAGE_STORAGE_PATH` - Directory for storing generated images (default: `./images`)
- `MAX_STORAGE_SIZE` - Maximum storage size in bytes (default: 10737418240 = 10 GB)

The `images/` directory is automatically created if it doesn't exist. Images and metadata are stored as:
- `{modelId}-{timestamp}.png` - Image file
- `{modelId}-{timestamp}.json` - Metadata file

### Model Selection Persistence

Your model selection is automatically saved to `config/user-preferences.json` and will be restored when you return to the application.

## Troubleshooting

### Authentication Errors

**Error**: "Invalid AWS credentials"

**Solution**:
1. Verify your Access Key ID and Secret Access Key in `.env`
2. Ensure the IAM user exists and is active
3. Check that credentials haven't expired

### Permission Errors

**Error**: "Insufficient permissions to access Bedrock models"

**Solution**:
1. Verify the IAM policy is attached to your user
2. Check that all required models are enabled in Bedrock console
3. Ensure you have `bedrock:InvokeModel` permission for both regions
4. Verify `bedrock:Retrieve` permission for Knowledge Base access

### Model Access Errors

**Error**: "Model not available in region"

**Solution**:
1. Go to AWS Bedrock console → Model access
2. Enable the specific model that's failing
3. Wait a few minutes for access to activate
4. Restart the application

### Timeout Errors

**Error**: "Image generation timed out"

**Solution**:
1. Increase `GENERATION_TIMEOUT` in `.env` (e.g., 90000 for 90 seconds)
2. Try a simpler prompt
3. Check AWS service health status
4. Reduce the number of concurrent models

### Knowledge Assistant Errors

**Error**: "Failed to retrieve model documentation"

**Solution**:
1. Verify `AWS_KNOWLEDGE_BASE_ID` is correct
2. Check Knowledge Base contains Bedrock documentation
3. Ensure IAM user has `bedrock:Retrieve` permission
4. The system will use cached documentation as fallback

### Gallery Errors

**Error**: "Failed to load gallery"

**Solution**:
1. Check that the `images/` directory exists and has proper permissions
2. Verify `IMAGE_STORAGE_PATH` in `.env` points to a valid directory
3. Ensure the Node.js process has read/write permissions
4. Click the retry button to attempt loading again

**Error**: "Failed to delete image"

**Solution**:
1. Verify the image file exists in the storage directory
2. Check file permissions allow deletion
3. Ensure no other process is using the file
4. Try refreshing the gallery and attempting deletion again

**Error**: "Image not found"

**Solution**:
1. The image may have been deleted manually from the file system
2. Refresh the gallery to sync with the file system
3. Check that both the `.png` and `.json` files exist for the image

**Storage Full**

If you reach the storage limit (default 10 GB):
1. Delete unused images from the gallery
2. Download important images for backup
3. Increase `MAX_STORAGE_SIZE` in `.env` if needed
4. Consider moving old images to external storage

### Rate Limiting

**Error**: "Rate limit exceeded"

**Solution**:
1. Wait for the specified retry-after time
2. Reduce the frequency of requests
3. Adjust `RATE_LIMIT_MAX_REQUESTS` in `.env` if needed

## Performance Considerations

### Image Generation
- **Concurrent Generation**: All models generate images simultaneously for faster results
- **Documentation Caching**: Model documentation is cached for 24 hours to reduce API calls
- **Timeout Management**: Each model has a 60-second timeout to prevent hanging requests
- **Error Isolation**: If one model fails, others continue processing

### Gallery Performance
- **Lazy Loading**: Images load in batches of 20 to optimize initial page load
- **Metadata Caching**: Image metadata is cached in memory for 1 minute to reduce file system reads
- **Debounced Search**: Search input is debounced with 300ms delay to prevent excessive filtering
- **Responsive Grid**: Grid layout automatically adjusts columns based on screen size
- **Efficient Filtering**: All filtering and sorting operations happen in-memory for instant results
- **Intersection Observer**: Uses native browser API for efficient scroll-based loading

## Data Persistence and Backup

### Local Storage

All generated images are stored locally in the `images/` directory:
- **Image Files**: Stored as PNG format with unique identifiers
- **Metadata Files**: JSON files containing all generation parameters and metadata
- **Automatic Saving**: Every generated image is automatically saved
- **No Database Required**: Simple file-based storage for easy backup and portability

### File Structure

Each image consists of two files:
```
images/
├── amazon.nova-canvas-v1:0-1234567890.png    # Image file
├── amazon.nova-canvas-v1:0-1234567890.json   # Metadata file
├── stability.stable-diffusion-xl-v1-1234567891.png
└── stability.stable-diffusion-xl-v1-1234567891.json
```

### Backup Recommendations

**Manual Backup:**
1. Copy the entire `images/` directory to external storage
2. Both `.png` and `.json` files must be backed up together
3. Restore by copying files back to the `images/` directory

**Automated Backup:**
- Use file sync tools (Dropbox, Google Drive, OneDrive)
- Set up scheduled backups with rsync or similar tools
- Consider cloud storage for important images

**Storage Management:**
- Default limit: 10 GB (configurable via `MAX_STORAGE_SIZE`)
- Monitor storage usage in the gallery header
- Delete unused images to free up space
- Download important images before deletion

### Portability

The gallery is fully portable:
- Move the `images/` directory to another machine
- No database migration required
- All metadata is self-contained in JSON files
- Works across different operating systems

## Cost Estimation

Approximate costs per image generation (as of 2024):

| Model | Cost per Image |
|-------|----------------|
| Amazon Nova Canvas | $0.04 |
| Stability SDXL | $0.04 |
| Stability Core | $0.03 |
| Stability Ultra | $0.08 |
| Claude Sonnet 4.5 (optimization) | ~$0.01 |

**Example**: Comparing 4 models costs approximately $0.20 per prompt (including optimization).

## Security Best Practices

1. **Never commit `.env` file** - It contains sensitive credentials
2. **Use IAM roles in production** - Avoid long-lived access keys when possible
3. **Rotate credentials regularly** - Update access keys every 90 days
4. **Apply least privilege** - Use the provided `iam-policy.json` instead of full access
5. **Monitor usage** - Set up AWS CloudWatch alarms for unusual activity
6. **Enable MFA** - Protect your AWS account with multi-factor authentication
7. **Secure image storage** - Ensure the `images/` directory has appropriate file permissions
8. **Path traversal protection** - The application validates all image IDs to prevent directory traversal attacks
9. **Backup important images** - Download and backup images you want to keep long-term

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions:
- Check the Troubleshooting section above
- Review AWS Bedrock documentation
- Open an issue on GitHub

## License

ISC

## Acknowledgments

- Built with AWS Bedrock, Claude Sonnet 4.5, and AWS Knowledge Assistant
- Uses Amazon Nova Canvas and Stability AI models
- Powered by React, TypeScript, and Express.js
