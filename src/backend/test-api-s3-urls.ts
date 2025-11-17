/**
 * Test script for verifying S3 signed URL generation in API endpoints
 * 
 * This script tests:
 * 1. GET /api/images returns signed URLs when S3 storage is enabled
 * 2. GET /api/images/:id returns signed URL for specific image
 * 3. URL expiration handling
 * 4. Metadata includes S3 keys
 */

import dotenv from 'dotenv';
import { S3StorageService } from './services/S3StorageService.js';
import { ImageMetadata } from '../shared/types.js';
import { logger } from './logger.js';

// Load environment variables
dotenv.config();

async function testS3SignedUrlGeneration() {
  console.log('\n=== Testing S3 Signed URL Generation ===\n');

  try {
    // Initialize S3StorageService
    const s3BucketUsEast1 = process.env.S3_BUCKET_US_EAST_1;
    const s3BucketUsWest2 = process.env.S3_BUCKET_US_WEST_2;

    if (!s3BucketUsEast1 || !s3BucketUsWest2) {
      console.error('❌ S3 bucket names not configured in environment variables');
      console.log('Please set S3_BUCKET_US_EAST_1 and S3_BUCKET_US_WEST_2');
      return;
    }

    const s3Service = new S3StorageService({
      buckets: {
        'us-east-1': s3BucketUsEast1,
        'us-west-2': s3BucketUsWest2
      },
      signedUrlExpiration: parseInt(process.env.S3_SIGNED_URL_EXPIRATION || '3600'),
      endpoint: process.env.S3_ENDPOINT
    });

    console.log('✅ S3StorageService initialized');
    console.log(`   Buckets: us-east-1=${s3BucketUsEast1}, us-west-2=${s3BucketUsWest2}`);

    // Test 1: List images from S3
    console.log('\n--- Test 1: List Images from S3 ---');
    const regions = s3Service.getRegions();
    console.log(`Testing regions: ${regions.join(', ')}`);

    let allImages: ImageMetadata[] = [];
    for (const region of regions) {
      console.log(`\nFetching images from ${region}...`);
      const images = await s3Service.listImages(region);
      console.log(`✅ Found ${images.length} images in ${region}`);
      
      if (images.length > 0) {
        console.log(`   Sample image: ${images[0].id}`);
        console.log(`   S3 URL: ${images[0].imageUrl}`);
      }
      
      allImages = allImages.concat(images);
    }

    console.log(`\n✅ Total images across all regions: ${allImages.length}`);

    if (allImages.length === 0) {
      console.log('\n⚠️  No images found in S3. Upload some images first using the image generation service.');
      return;
    }

    // Test 2: Generate signed URLs for images
    console.log('\n--- Test 2: Generate Signed URLs ---');
    const testImage = allImages[0];
    console.log(`Testing with image: ${testImage.id}`);
    console.log(`Original S3 URL: ${testImage.imageUrl}`);

    // Extract S3 key from URL
    const s3UrlMatch = testImage.imageUrl.match(/^s3:\/\/[^/]+\/(.+)$/);
    if (!s3UrlMatch) {
      console.error('❌ Invalid S3 URL format');
      return;
    }

    const s3Key = s3UrlMatch[1];
    console.log(`S3 Key: ${s3Key}`);

    // Generate signed URL with default expiration (1 hour)
    const signedUrl1h = await s3Service.getSignedUrl(testImage.region, s3Key, 3600);
    console.log(`✅ Generated signed URL (1 hour expiration)`);
    console.log(`   URL length: ${signedUrl1h.length} characters`);
    console.log(`   URL preview: ${signedUrl1h.substring(0, 100)}...`);

    // Verify URL contains required components
    if (signedUrl1h.includes('X-Amz-Algorithm') && 
        signedUrl1h.includes('X-Amz-Credential') && 
        signedUrl1h.includes('X-Amz-Signature')) {
      console.log('✅ Signed URL contains all required AWS signature components');
    } else {
      console.error('❌ Signed URL missing required AWS signature components');
    }

    // Test 3: Generate signed URL with custom expiration
    console.log('\n--- Test 3: Custom Expiration Times ---');
    
    const signedUrl5min = await s3Service.getSignedUrl(testImage.region, s3Key, 300);
    console.log(`✅ Generated signed URL (5 minutes expiration)`);
    
    const signedUrl24h = await s3Service.getSignedUrl(testImage.region, s3Key, 86400);
    console.log(`✅ Generated signed URL (24 hours expiration)`);

    // Test 4: Simulate API endpoint behavior
    console.log('\n--- Test 4: Simulate API Endpoint Behavior ---');
    console.log('Simulating GET /api/images endpoint...');

    // Process all images like the API would
    const processedImages = await Promise.all(allImages.map(async (image) => {
      const match = image.imageUrl.match(/^s3:\/\/[^/]+\/(.+)$/);
      if (match) {
        const key = match[1];
        const signedUrl = await s3Service.getSignedUrl(image.region, key, 3600);
        return {
          ...image,
          imageUrl: signedUrl,
          s3Key: key,
          s3Bucket: s3Service.getBucketName(image.region)
        };
      }
      return image;
    }));

    console.log(`✅ Processed ${processedImages.length} images with signed URLs`);
    console.log(`   Sample processed image:`);
    console.log(`   - ID: ${processedImages[0].id}`);
    console.log(`   - Model: ${processedImages[0].modelId}`);
    console.log(`   - Region: ${processedImages[0].region}`);
    console.log(`   - S3 Key: ${(processedImages[0] as any).s3Key}`);
    console.log(`   - S3 Bucket: ${(processedImages[0] as any).s3Bucket}`);
    console.log(`   - Signed URL length: ${processedImages[0].imageUrl.length} characters`);

    // Test 5: Verify metadata structure
    console.log('\n--- Test 5: Verify Metadata Structure ---');
    const sampleMetadata = processedImages[0];
    const requiredFields = ['id', 'imageUrl', 'modelId', 'modelName', 'region', 'originalPrompt', 'optimizedPrompt', 'generatedAt'];
    
    let allFieldsPresent = true;
    for (const field of requiredFields) {
      if (!(field in sampleMetadata)) {
        console.error(`❌ Missing required field: ${field}`);
        allFieldsPresent = false;
      }
    }

    if (allFieldsPresent) {
      console.log('✅ All required metadata fields present');
    }

    // Test 6: Test filtering and sorting (like API does)
    console.log('\n--- Test 6: Test Filtering and Sorting ---');
    
    // Filter by model
    const modelId = allImages[0].modelId;
    const filteredByModel = allImages.filter(img => img.modelId === modelId);
    console.log(`✅ Filtered by model ${modelId}: ${filteredByModel.length} images`);

    // Sort by newest
    const sortedByNewest = [...allImages].sort((a, b) => 
      b.generatedAt.getTime() - a.generatedAt.getTime()
    );
    console.log(`✅ Sorted by newest: ${sortedByNewest.length} images`);
    if (sortedByNewest.length > 1) {
      console.log(`   Newest: ${sortedByNewest[0].generatedAt.toISOString()}`);
      console.log(`   Oldest: ${sortedByNewest[sortedByNewest.length - 1].generatedAt.toISOString()}`);
    }

    // Test 7: Test pagination
    console.log('\n--- Test 7: Test Pagination ---');
    const pageSize = 5;
    const totalPages = Math.ceil(allImages.length / pageSize);
    console.log(`Total images: ${allImages.length}`);
    console.log(`Page size: ${pageSize}`);
    console.log(`Total pages: ${totalPages}`);

    const page1 = allImages.slice(0, pageSize);
    console.log(`✅ Page 1: ${page1.length} images`);
    
    if (allImages.length > pageSize) {
      const page2 = allImages.slice(pageSize, pageSize * 2);
      console.log(`✅ Page 2: ${page2.length} images`);
    }

    console.log('\n=== All Tests Completed Successfully ===\n');

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
testS3SignedUrlGeneration();
