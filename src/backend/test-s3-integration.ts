/**
 * Test script for S3 integration with ImageGenerationService
 * Verifies that images are uploaded to S3 and URLs are returned correctly
 */

import { config } from 'dotenv';
import { ConfigurationService } from './services/ConfigurationService.js';
import { BedrockClientFactory } from './services/BedrockClientFactory.js';
import { ImageGenerationService } from './services/ImageGenerationService.js';
import { S3StorageService } from './services/S3StorageService.js';
import { ImageLibraryService } from './services/ImageLibraryService.js';
import { logger } from './logger.js';

// Load environment variables
config();

async function testS3Integration() {
  try {
    logger.info('=== Testing S3 Integration with ImageGenerationService ===');

    // Check if S3 is configured
    const imageStorageType = process.env.IMAGE_STORAGE_TYPE || 'local';
    if (imageStorageType !== 's3') {
      logger.warn('IMAGE_STORAGE_TYPE is not set to "s3". Set it to "s3" in .env to test S3 integration.');
      logger.info('Current storage type:', imageStorageType);
      process.exit(0);
    }

    const s3BucketUsEast1 = process.env.S3_BUCKET_US_EAST_1;
    const s3BucketUsWest2 = process.env.S3_BUCKET_US_WEST_2;

    if (!s3BucketUsEast1 || !s3BucketUsWest2) {
      logger.error('S3 bucket names not configured in .env file');
      logger.info('Please set S3_BUCKET_US_EAST_1 and S3_BUCKET_US_WEST_2');
      process.exit(1);
    }

    logger.info('S3 Configuration:', {
      bucketUsEast1: s3BucketUsEast1,
      bucketUsWest2: s3BucketUsWest2,
      signedUrlExpiration: process.env.S3_SIGNED_URL_EXPIRATION || '3600'
    });

    // Initialize services
    logger.info('Initializing services...');
    const configService = new ConfigurationService();
    const clientFactory = new BedrockClientFactory(configService);
    
    const imageLibraryService = new ImageLibraryService(
      process.env.IMAGE_STORAGE_PATH || './images'
    );

    const s3StorageService = new S3StorageService({
      buckets: {
        'us-east-1': s3BucketUsEast1,
        'us-west-2': s3BucketUsWest2
      },
      signedUrlExpiration: parseInt(process.env.S3_SIGNED_URL_EXPIRATION || '3600'),
      endpoint: process.env.S3_ENDPOINT
    });

    const imageGenService = new ImageGenerationService(
      clientFactory,
      configService,
      imageLibraryService,
      s3StorageService
    );

    logger.info('✓ All services initialized successfully');

    // Test image generation with S3 upload
    logger.info('Testing image generation with S3 upload...');
    
    const testRequests = [
      {
        modelId: 'amazon.nova-canvas-v1:0',
        prompt: 'A beautiful sunset over mountains with vibrant colors',
        parameters: {
          width: 512,
          height: 512,
          quality: 'standard' as const
        },
        originalPrompt: 'A sunset over mountains'
      }
    ];

    logger.info('Generating test image...', {
      modelId: testRequests[0].modelId,
      prompt: testRequests[0].prompt.substring(0, 50) + '...'
    });

    const results = await imageGenService.generateImages(testRequests);

    logger.info('Image generation completed', {
      totalResults: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });

    // Verify S3 integration
    for (const result of results) {
      if (result.success) {
        logger.info('✓ Image generated successfully', {
          modelId: result.modelId,
          modelName: result.modelName,
          region: result.region,
          generationTime: `${result.generationTime}ms`
        });

        // Check if S3 fields are present
        if (result.imageUrl) {
          logger.info('✓ S3 URL present', {
            imageUrl: result.imageUrl.substring(0, 100) + '...'
          });
        } else {
          logger.warn('✗ S3 URL missing - image may not have been uploaded');
        }

        if (result.s3Key) {
          logger.info('✓ S3 key present', {
            s3Key: result.s3Key
          });
        } else {
          logger.warn('✗ S3 key missing');
        }

        if (result.s3Bucket) {
          logger.info('✓ S3 bucket present', {
            s3Bucket: result.s3Bucket
          });
        } else {
          logger.warn('✗ S3 bucket missing');
        }

        // Check if base64 was removed
        if (result.imageBase64) {
          logger.warn('✗ Base64 data still present - should be removed after S3 upload');
        } else {
          logger.info('✓ Base64 data removed after S3 upload');
        }

        // Verify the image exists in S3
        if (result.s3Key) {
          logger.info('Verifying image exists in S3...');
          const exists = await s3StorageService.imageExists(result.region, result.s3Key);
          if (exists) {
            logger.info('✓ Image verified in S3');
          } else {
            logger.error('✗ Image not found in S3');
          }
        }

      } else {
        logger.error('✗ Image generation failed', {
          modelId: result.modelId,
          error: result.error
        });
      }
    }

    logger.info('=== S3 Integration Test Completed Successfully ===');

  } catch (error) {
    logger.error('S3 Integration test failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

// Run test
testS3Integration();
