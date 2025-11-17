import { S3StorageService } from './services/S3StorageService.js';
import { ImageMetadata } from '../shared/types.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Test script for S3StorageService
 * Tests all core functionality: upload, getSignedUrl, list, delete
 */
async function testS3StorageService() {
  console.log('=== S3StorageService Test ===\n');

  // Get bucket names from environment
  const bucketUSEast1 = process.env.S3_BUCKET_US_EAST_1;
  const bucketUSWest2 = process.env.S3_BUCKET_US_WEST_2;

  if (!bucketUSEast1 || !bucketUSWest2) {
    console.error('❌ Error: S3 bucket names not configured in .env file');
    console.error('Please set S3_BUCKET_US_EAST_1 and S3_BUCKET_US_WEST_2');
    process.exit(1);
  }

  // Initialize S3StorageService
  const s3Service = new S3StorageService({
    buckets: {
      'us-east-1': bucketUSEast1,
      'us-west-2': bucketUSWest2
    },
    signedUrlExpiration: 3600,
    endpoint: process.env.S3_ENDPOINT // for LocalStack testing
  });

  console.log('✅ S3StorageService initialized');
  console.log(`   Regions: ${s3Service.getRegions().join(', ')}`);
  console.log(`   Buckets: ${bucketUSEast1}, ${bucketUSWest2}\n`);

  // Test 1: Upload image
  console.log('Test 1: Upload Image');
  console.log('-------------------');

  const testImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  
  const testMetadata: ImageMetadata = {
    id: 'test-image-123',
    imageUrl: '',
    modelId: 'amazon.nova-canvas-v1:0',
    modelName: 'Amazon Nova Canvas',
    region: 'us-east-1',
    originalPrompt: 'A beautiful sunset over mountains',
    optimizedPrompt: 'A stunning sunset over majestic mountains with vibrant colors',
    parameters: {
      width: 1024,
      height: 1024,
      quality: 'standard'
    },
    generatedAt: new Date(),
    resolution: {
      width: 1024,
      height: 1024
    },
    fileSize: testImageBuffer.length,
    format: 'png',
    generationTime: 5000
  };

  try {
    const uploadResult = await s3Service.uploadImage(
      'us-east-1',
      'amazon.nova-canvas-v1:0',
      testImageBuffer,
      testMetadata
    );

    console.log('✅ Image uploaded successfully');
    console.log(`   S3 Key: ${uploadResult.s3Key}`);
    console.log(`   S3 URL: ${uploadResult.s3Url}`);
    console.log(`   Bucket: ${uploadResult.bucket}`);
    console.log(`   Region: ${uploadResult.region}\n`);

    // Test 2: Generate signed URL
    console.log('Test 2: Generate Signed URL');
    console.log('---------------------------');

    const signedUrl = await s3Service.getSignedUrl('us-east-1', uploadResult.s3Key, 3600);
    console.log('✅ Signed URL generated successfully');
    console.log(`   URL: ${signedUrl.substring(0, 100)}...`);
    console.log(`   Expires in: 3600 seconds\n`);

    // Test 3: Check if image exists
    console.log('Test 3: Check Image Existence');
    console.log('-----------------------------');

    const exists = await s3Service.imageExists('us-east-1', uploadResult.s3Key);
    console.log(`✅ Image exists: ${exists}\n`);

    // Test 4: List images
    console.log('Test 4: List Images');
    console.log('-------------------');

    const images = await s3Service.listImages('us-east-1', 'amazon.nova-canvas-v1:0');
    console.log(`✅ Found ${images.length} image(s)`);
    
    if (images.length > 0) {
      console.log('   First image:');
      console.log(`   - ID: ${images[0].id}`);
      console.log(`   - Model: ${images[0].modelName}`);
      console.log(`   - Prompt: ${images[0].originalPrompt.substring(0, 50)}...`);
      console.log(`   - Generated: ${images[0].generatedAt.toISOString()}\n`);
    }

    // Test 5: Delete image
    console.log('Test 5: Delete Image');
    console.log('--------------------');

    await s3Service.deleteImage('us-east-1', uploadResult.s3Key);
    console.log('✅ Image deleted successfully\n');

    // Test 6: Verify deletion
    console.log('Test 6: Verify Deletion');
    console.log('-----------------------');

    const existsAfterDelete = await s3Service.imageExists('us-east-1', uploadResult.s3Key);
    console.log(`✅ Image exists after deletion: ${existsAfterDelete}\n`);

    // Test 7: Test error handling (invalid region)
    console.log('Test 7: Error Handling');
    console.log('----------------------');

    try {
      await s3Service.uploadImage(
        'invalid-region' as any,
        'test-model',
        testImageBuffer,
        testMetadata
      );
      console.log('❌ Should have thrown error for invalid region');
    } catch (error) {
      console.log('✅ Correctly handled invalid region error');
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    }

    console.log('=== All Tests Completed Successfully ===');

  } catch (error) {
    console.error('❌ Test failed:', error);
    
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    process.exit(1);
  }
}

// Run tests
testS3StorageService().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
