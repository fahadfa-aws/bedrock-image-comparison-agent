# S3StorageService

## Overview

The `S3StorageService` provides a robust interface for managing image storage in AWS S3 across multiple regions. It handles image uploads, signed URL generation, listing, and deletion with built-in retry logic and error handling.

## Features

- **Multi-Region Support**: Manages S3 buckets in both `us-east-1` and `us-west-2` regions
- **Automatic Retry Logic**: Retries failed operations with exponential backoff
- **Signed URL Generation**: Creates time-limited URLs for secure image access
- **Metadata Management**: Stores and retrieves image metadata alongside images
- **Error Handling**: Comprehensive error handling with detailed logging
- **Type Safety**: Full TypeScript support with strict typing

## Architecture

### Storage Structure

Images and metadata are organized in S3 with the following structure:

```
bucket-name/
├── {modelId}/
│   ├── {timestamp}-{uuid}.png          # Image files
│   └── ...
└── metadata/
    └── {modelId}/
        ├── {timestamp}-{uuid}.json     # Metadata files
        └── ...
```

### Example

```
bedrock-image-comparison-us-east-1-123456789012-dev/
├── amazon.nova-canvas-v1:0/
│   ├── 1731567890-abc123.png
│   └── 1731567891-def456.png
└── metadata/
    └── amazon.nova-canvas-v1:0/
        ├── 1731567890-abc123.json
        └── 1731567891-def456.json
```

## Configuration

### Environment Variables

Add the following to your `.env` file:

```bash
# S3 bucket names (replace {account-id} with your AWS account ID)
S3_BUCKET_US_EAST_1=bedrock-image-comparison-us-east-1-{account-id}-dev
S3_BUCKET_US_WEST_2=bedrock-image-comparison-us-west-2-{account-id}-dev

# Signed URL expiration time in seconds (default: 3600)
S3_SIGNED_URL_EXPIRATION=3600

# Optional: Custom S3 endpoint for LocalStack testing
# S3_ENDPOINT=http://localhost:4566
```

### Initialization

```typescript
import { S3StorageService } from './services/S3StorageService.js';

const s3Service = new S3StorageService({
  buckets: {
    'us-east-1': process.env.S3_BUCKET_US_EAST_1!,
    'us-west-2': process.env.S3_BUCKET_US_WEST_2!
  },
  signedUrlExpiration: parseInt(process.env.S3_SIGNED_URL_EXPIRATION || '3600'),
  endpoint: process.env.S3_ENDPOINT // Optional, for LocalStack
});
```

## Usage

### Upload Image

Upload an image with metadata to S3:

```typescript
import { ImageMetadata } from '../../shared/types.js';

const imageBuffer = Buffer.from(base64Image, 'base64');

const metadata: ImageMetadata = {
  id: 'unique-image-id',
  imageUrl: '', // Will be populated later
  modelId: 'amazon.nova-canvas-v1:0',
  modelName: 'Amazon Nova Canvas',
  region: 'us-east-1',
  originalPrompt: 'A beautiful sunset',
  optimizedPrompt: 'A stunning sunset with vibrant colors',
  parameters: {
    width: 1024,
    height: 1024,
    quality: 'standard'
  },
  generatedAt: new Date(),
  resolution: { width: 1024, height: 1024 },
  fileSize: imageBuffer.length,
  format: 'png',
  generationTime: 5000
};

const result = await s3Service.uploadImage(
  'us-east-1',
  'amazon.nova-canvas-v1:0',
  imageBuffer,
  metadata
);

console.log('Uploaded:', result.s3Key);
console.log('S3 URL:', result.s3Url);
```

### Generate Signed URL

Create a time-limited URL for accessing an image:

```typescript
const signedUrl = await s3Service.getSignedUrl(
  'us-east-1',
  'amazon.nova-canvas-v1:0/1731567890-abc123.png',
  3600 // Expires in 1 hour
);

console.log('Access image at:', signedUrl);
```

### List Images

List all images in a region, optionally filtered by model:

```typescript
// List all images in us-east-1
const allImages = await s3Service.listImages('us-east-1');

// List images for a specific model
const novaImages = await s3Service.listImages(
  'us-east-1',
  'amazon.nova-canvas-v1:0'
);

console.log(`Found ${novaImages.length} images`);
novaImages.forEach(img => {
  console.log(`- ${img.id}: ${img.originalPrompt}`);
});
```

### Delete Image

Delete an image and its metadata:

```typescript
await s3Service.deleteImage(
  'us-east-1',
  'amazon.nova-canvas-v1:0/1731567890-abc123.png'
);

console.log('Image deleted successfully');
```

### Check Image Existence

Verify if an image exists in S3:

```typescript
const exists = await s3Service.imageExists(
  'us-east-1',
  'amazon.nova-canvas-v1:0/1731567890-abc123.png'
);

console.log('Image exists:', exists);
```

## Error Handling

The service includes comprehensive error handling:

### Retryable Errors

The following errors are automatically retried with exponential backoff:
- `RequestTimeout`
- `ServiceUnavailable`
- `ThrottlingException`
- `TooManyRequestsException`
- `InternalServerError`

### Non-Retryable Errors

These errors are thrown immediately:
- Invalid region
- Invalid parameters
- Access denied
- Not found (404)

### Example Error Handling

```typescript
try {
  await s3Service.uploadImage(region, modelId, buffer, metadata);
} catch (error) {
  if (error instanceof Error) {
    console.error('Upload failed:', error.message);
    
    // Check if error is retryable
    if (error.message.includes('ThrottlingException')) {
      console.log('Rate limited, try again later');
    }
  }
}
```

## Integration with ImageGenerationService

The S3StorageService is designed to integrate seamlessly with the ImageGenerationService:

```typescript
class ImageGenerationService {
  constructor(
    private bedrockFactory: BedrockClientFactory,
    private configService: ConfigurationService,
    private s3Service: S3StorageService
  ) {}

  async generateImages(requests: ImageGenerationRequest[]): Promise<ImageGenerationResult[]> {
    const results = await Promise.all(
      requests.map(req => this.generateSingleImage(req))
    );

    // Upload successful images to S3
    for (const result of results) {
      if (result.success && result.imageBase64) {
        const buffer = Buffer.from(result.imageBase64, 'base64');
        
        const uploadResult = await this.s3Service.uploadImage(
          result.region,
          result.modelId,
          buffer,
          {
            // ... metadata
          }
        );

        // Replace base64 with S3 URL
        result.imageUrl = uploadResult.s3Url;
        delete result.imageBase64;
      }
    }

    return results;
  }
}
```

## Testing

### Unit Tests

Run the test suite:

```bash
npm run test:s3-storage
```

### Manual Testing

1. Ensure S3 buckets are created (see infrastructure/README.md)
2. Configure environment variables in `.env`
3. Run the test script:

```bash
tsx src/backend/test-s3-storage.ts
```

### LocalStack Testing

For local development without AWS:

1. Start LocalStack:
```bash
docker run -d -p 4566:4566 localstack/localstack
```

2. Set endpoint in `.env`:
```bash
S3_ENDPOINT=http://localhost:4566
```

3. Create test buckets:
```bash
aws --endpoint-url=http://localhost:4566 s3 mb s3://test-bucket-us-east-1
aws --endpoint-url=http://localhost:4566 s3 mb s3://test-bucket-us-west-2
```

## Performance Considerations

### Optimization Strategies

1. **Parallel Uploads**: Upload images concurrently using `Promise.all()`
2. **Metadata Caching**: Cache frequently accessed metadata
3. **Signed URL Caching**: Cache signed URLs until near expiration
4. **Pagination**: Use pagination when listing large numbers of images

### Example: Parallel Uploads

```typescript
const uploadPromises = results.map(result => {
  if (result.success && result.imageBase64) {
    const buffer = Buffer.from(result.imageBase64, 'base64');
    return s3Service.uploadImage(result.region, result.modelId, buffer, metadata);
  }
  return Promise.resolve(null);
});

const uploadResults = await Promise.all(uploadPromises);
```

## Security

### Best Practices

1. **Private Buckets**: All buckets are configured with private access
2. **Encryption**: Server-side encryption (SSE-S3) is enabled by default
3. **Signed URLs**: Use time-limited signed URLs for image access
4. **HTTPS Only**: Bucket policies enforce HTTPS transport
5. **IAM Permissions**: Use least-privilege IAM policies

### Required IAM Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::bedrock-image-comparison-*/*",
        "arn:aws:s3:::bedrock-image-comparison-*"
      ]
    }
  ]
}
```

## Troubleshooting

### Common Issues

#### 1. Access Denied

**Error**: `AccessDenied: Access Denied`

**Solution**: Verify IAM permissions and bucket policies

```bash
# Check IAM user permissions
aws iam get-user-policy --user-name your-user --policy-name BedrockImagePolicy

# Verify bucket exists
aws s3 ls s3://your-bucket-name
```

#### 2. Bucket Not Found

**Error**: `NoSuchBucket: The specified bucket does not exist`

**Solution**: Create the S3 buckets using CloudFormation

```bash
cd infrastructure
./deploy-s3.sh
```

#### 3. Invalid Region

**Error**: `Unsupported region: invalid-region`

**Solution**: Use only `us-east-1` or `us-west-2`

#### 4. Signed URL Expired

**Error**: `Request has expired`

**Solution**: Generate a new signed URL or increase expiration time

```typescript
const signedUrl = await s3Service.getSignedUrl(
  region,
  s3Key,
  7200 // 2 hours
);
```

## API Reference

### Constructor

```typescript
constructor(config: S3StorageConfig)
```

### Methods

#### uploadImage()
```typescript
async uploadImage(
  region: string,
  modelId: string,
  imageBuffer: Buffer,
  metadata: ImageMetadata
): Promise<UploadResult>
```

#### getSignedUrl()
```typescript
async getSignedUrl(
  region: string,
  s3Key: string,
  expiresIn?: number
): Promise<string>
```

#### deleteImage()
```typescript
async deleteImage(
  region: string,
  s3Key: string
): Promise<void>
```

#### listImages()
```typescript
async listImages(
  region: string,
  prefix?: string
): Promise<ImageMetadata[]>
```

#### imageExists()
```typescript
async imageExists(
  region: string,
  s3Key: string
): Promise<boolean>
```

#### getBucketName()
```typescript
getBucketName(region: string): string
```

#### getRegions()
```typescript
getRegions(): string[]
```

## Migration from Local Storage

To migrate from local file storage to S3:

1. Deploy S3 buckets using CloudFormation
2. Update `.env` with bucket names
3. Initialize S3StorageService in your application
4. Update ImageGenerationService to use S3StorageService
5. Migrate existing images (optional):

```typescript
// Migration script example
const localImages = await imageLibraryService.scanImageDirectory();

for (const metadata of localImages) {
  const imagePath = path.join(imageStoragePath, `${metadata.id}.png`);
  const imageBuffer = await fs.readFile(imagePath);
  
  await s3Service.uploadImage(
    metadata.region,
    metadata.modelId,
    imageBuffer,
    metadata
  );
}
```

## Future Enhancements

- [ ] Support for additional regions
- [ ] Image compression before upload
- [ ] Thumbnail generation
- [ ] Batch operations
- [ ] CloudFront integration for CDN
- [ ] S3 Transfer Acceleration
- [ ] Multipart upload for large images
- [ ] Image versioning support
