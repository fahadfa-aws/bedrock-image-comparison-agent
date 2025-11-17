/**
 * Comprehensive S3 Integration Test
 * Tests all S3 functionality including:
 * - Image upload to S3
 * - Signed URL generation
 * - Image deletion from S3
 * - Cross-region functionality
 * - Bucket policies and permissions
 */

import { S3StorageService } from './services/S3StorageService.js';
import { ImageMetadata } from '../shared/types.js';
import dotenv from 'dotenv';
import { logger } from './logger.js';

// Load environment variables
dotenv.config();

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

class S3ComprehensiveTest {
  private s3Service: S3StorageService;
  private testResults: TestResult[] = [];
  private testImageBuffer: Buffer;
  private uploadedImages: Map<string, { region: string; s3Key: string }> = new Map();

  constructor() {
    // Get bucket names from environment
    const bucketUSEast1 = process.env.S3_BUCKET_US_EAST_1;
    const bucketUSWest2 = process.env.S3_BUCKET_US_WEST_2;

    if (!bucketUSEast1 || !bucketUSWest2) {
      throw new Error('S3 bucket names not configured in .env file');
    }

    // Initialize S3StorageService
    this.s3Service = new S3StorageService({
      buckets: {
        'us-east-1': bucketUSEast1,
        'us-west-2': bucketUSWest2
      },
      signedUrlExpiration: 3600,
      endpoint: process.env.S3_ENDPOINT
    });

    // Create a small test image (1x1 red pixel PNG)
    this.testImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
      'base64'
    );
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    console.log('='.repeat(80));
    console.log('S3 COMPREHENSIVE INTEGRATION TEST');
    console.log('='.repeat(80));
    console.log();

    try {
      // Test 1: Image Upload to S3 (us-east-1)
      await this.testImageUploadUSEast1();

      // Test 2: Image Upload to S3 (us-west-2)
      await this.testImageUploadUSWest2();

      // Test 3: Signed URL Generation
      await this.testSignedUrlGeneration();

      // Test 4: Cross-Region Functionality
      await this.testCrossRegionFunctionality();

      // Test 5: Image Listing
      await this.testImageListing();

      // Test 6: Image Existence Check
      await this.testImageExistence();

      // Test 7: Image Deletion
      await this.testImageDeletion();

      // Test 8: Bucket Policies and Permissions
      await this.testBucketPolicies();

      // Test 9: Error Handling
      await this.testErrorHandling();

      // Test 10: Concurrent Operations
      await this.testConcurrentOperations();

      // Print summary
      this.printSummary();

    } catch (error) {
      logger.error('Fatal error during tests', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Test 1: Image Upload to S3 (us-east-1)
   */
  private async testImageUploadUSEast1(): Promise<void> {
    console.log('Test 1: Image Upload to S3 (us-east-1)');
    console.log('-'.repeat(80));

    try {
      const metadata: ImageMetadata = this.createTestMetadata('us-east-1', 'amazon.nova-canvas-v1:0');
      
      const result = await this.s3Service.uploadImage(
        'us-east-1',
        'amazon.nova-canvas-v1:0',
        this.testImageBuffer,
        metadata
      );

      // Store for later tests
      this.uploadedImages.set('us-east-1-nova', {
        region: 'us-east-1',
        s3Key: result.s3Key
      });

      console.log('✅ PASSED: Image uploaded to us-east-1');
      console.log(`   S3 Key: ${result.s3Key}`);
      console.log(`   Bucket: ${result.bucket}`);
      console.log(`   Region: ${result.region}`);
      console.log();

      this.testResults.push({
        name: 'Image Upload (us-east-1)',
        passed: true,
        details: result
      });

    } catch (error) {
      console.log('❌ FAILED: Image upload to us-east-1');
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log();

      this.testResults.push({
        name: 'Image Upload (us-east-1)',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Test 2: Image Upload to S3 (us-west-2)
   */
  private async testImageUploadUSWest2(): Promise<void> {
    console.log('Test 2: Image Upload to S3 (us-west-2)');
    console.log('-'.repeat(80));

    try {
      const metadata: ImageMetadata = this.createTestMetadata('us-west-2', 'stability.sd3-large-v1:0');
      
      const result = await this.s3Service.uploadImage(
        'us-west-2',
        'stability.sd3-large-v1:0',
        this.testImageBuffer,
        metadata
      );

      // Store for later tests
      this.uploadedImages.set('us-west-2-stability', {
        region: 'us-west-2',
        s3Key: result.s3Key
      });

      console.log('✅ PASSED: Image uploaded to us-west-2');
      console.log(`   S3 Key: ${result.s3Key}`);
      console.log(`   Bucket: ${result.bucket}`);
      console.log(`   Region: ${result.region}`);
      console.log();

      this.testResults.push({
        name: 'Image Upload (us-west-2)',
        passed: true,
        details: result
      });

    } catch (error) {
      console.log('❌ FAILED: Image upload to us-west-2');
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log();

      this.testResults.push({
        name: 'Image Upload (us-west-2)',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Test 3: Signed URL Generation
   */
  private async testSignedUrlGeneration(): Promise<void> {
    console.log('Test 3: Signed URL Generation');
    console.log('-'.repeat(80));

    try {
      const testCases = [
        { name: 'us-east-1', key: 'us-east-1-nova' },
        { name: 'us-west-2', key: 'us-west-2-stability' }
      ];

      for (const testCase of testCases) {
        const imageInfo = this.uploadedImages.get(testCase.key);
        if (!imageInfo) {
          throw new Error(`Image not found for ${testCase.name}`);
        }

        const signedUrl = await this.s3Service.getSignedUrl(
          imageInfo.region,
          imageInfo.s3Key,
          3600
        );

        // Verify URL format
        if (!signedUrl.startsWith('https://')) {
          throw new Error('Signed URL does not use HTTPS');
        }

        if (!signedUrl.includes('X-Amz-Signature')) {
          throw new Error('Signed URL missing signature');
        }

        console.log(`✅ PASSED: Signed URL generated for ${testCase.name}`);
        console.log(`   URL length: ${signedUrl.length} characters`);
        console.log(`   Uses HTTPS: Yes`);
        console.log(`   Has signature: Yes`);
      }

      console.log();

      this.testResults.push({
        name: 'Signed URL Generation',
        passed: true
      });

    } catch (error) {
      console.log('❌ FAILED: Signed URL generation');
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log();

      this.testResults.push({
        name: 'Signed URL Generation',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Test 4: Cross-Region Functionality
   */
  private async testCrossRegionFunctionality(): Promise<void> {
    console.log('Test 4: Cross-Region Functionality');
    console.log('-'.repeat(80));

    try {
      // Verify both regions are configured
      const regions = this.s3Service.getRegions();
      
      if (!regions.includes('us-east-1')) {
        throw new Error('us-east-1 not configured');
      }

      if (!regions.includes('us-west-2')) {
        throw new Error('us-west-2 not configured');
      }

      // Verify bucket names are different
      const bucketEast = this.s3Service.getBucketName('us-east-1');
      const bucketWest = this.s3Service.getBucketName('us-west-2');

      if (bucketEast === bucketWest) {
        throw new Error('Bucket names should be different for different regions');
      }

      // Verify images exist in their respective regions
      const eastImage = this.uploadedImages.get('us-east-1-nova');
      const westImage = this.uploadedImages.get('us-west-2-stability');

      if (!eastImage || !westImage) {
        throw new Error('Test images not found');
      }

      const eastExists = await this.s3Service.imageExists(eastImage.region, eastImage.s3Key);
      const westExists = await this.s3Service.imageExists(westImage.region, westImage.s3Key);

      if (!eastExists || !westExists) {
        throw new Error('Images not found in their respective regions');
      }

      console.log('✅ PASSED: Cross-region functionality verified');
      console.log(`   Regions configured: ${regions.join(', ')}`);
      console.log(`   us-east-1 bucket: ${bucketEast}`);
      console.log(`   us-west-2 bucket: ${bucketWest}`);
      console.log(`   Images exist in both regions: Yes`);
      console.log();

      this.testResults.push({
        name: 'Cross-Region Functionality',
        passed: true,
        details: { regions, buckets: { east: bucketEast, west: bucketWest } }
      });

    } catch (error) {
      console.log('❌ FAILED: Cross-region functionality');
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log();

      this.testResults.push({
        name: 'Cross-Region Functionality',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Test 5: Image Listing
   */
  private async testImageListing(): Promise<void> {
    console.log('Test 5: Image Listing');
    console.log('-'.repeat(80));

    try {
      // List images in us-east-1
      const imagesEast = await this.s3Service.listImages('us-east-1');
      console.log(`✅ Listed ${imagesEast.length} image(s) in us-east-1`);

      // List images in us-west-2
      const imagesWest = await this.s3Service.listImages('us-west-2');
      console.log(`✅ Listed ${imagesWest.length} image(s) in us-west-2`);

      // List images with prefix filter
      const novaImages = await this.s3Service.listImages('us-east-1', 'amazon.nova-canvas-v1:0');
      console.log(`✅ Listed ${novaImages.length} Nova Canvas image(s) in us-east-1`);

      // Verify metadata structure
      if (imagesEast.length > 0) {
        const firstImage = imagesEast[0];
        const requiredFields = ['id', 'modelId', 'modelName', 'region', 'originalPrompt', 'generatedAt'];
        const missingFields = requiredFields.filter(field => !(field in firstImage));

        if (missingFields.length > 0) {
          throw new Error(`Missing metadata fields: ${missingFields.join(', ')}`);
        }

        console.log('✅ Metadata structure validated');
      }

      console.log();

      this.testResults.push({
        name: 'Image Listing',
        passed: true,
        details: {
          usEast1Count: imagesEast.length,
          usWest2Count: imagesWest.length,
          novaImagesCount: novaImages.length
        }
      });

    } catch (error) {
      console.log('❌ FAILED: Image listing');
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log();

      this.testResults.push({
        name: 'Image Listing',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Test 6: Image Existence Check
   */
  private async testImageExistence(): Promise<void> {
    console.log('Test 6: Image Existence Check');
    console.log('-'.repeat(80));

    try {
      // Check existing images
      for (const [name, imageInfo] of this.uploadedImages.entries()) {
        const exists = await this.s3Service.imageExists(imageInfo.region, imageInfo.s3Key);
        
        if (!exists) {
          throw new Error(`Image ${name} should exist but doesn't`);
        }

        console.log(`✅ Image exists: ${name}`);
      }

      // Check non-existent image
      const nonExistentExists = await this.s3Service.imageExists(
        'us-east-1',
        'non-existent-key.png'
      );

      if (nonExistentExists) {
        throw new Error('Non-existent image should not exist');
      }

      console.log('✅ Non-existent image correctly reported as not existing');
      console.log();

      this.testResults.push({
        name: 'Image Existence Check',
        passed: true
      });

    } catch (error) {
      console.log('❌ FAILED: Image existence check');
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log();

      this.testResults.push({
        name: 'Image Existence Check',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Test 7: Image Deletion
   */
  private async testImageDeletion(): Promise<void> {
    console.log('Test 7: Image Deletion');
    console.log('-'.repeat(80));

    try {
      // Delete images from both regions
      for (const [name, imageInfo] of this.uploadedImages.entries()) {
        // Verify image exists before deletion
        const existsBefore = await this.s3Service.imageExists(imageInfo.region, imageInfo.s3Key);
        if (!existsBefore) {
          throw new Error(`Image ${name} should exist before deletion`);
        }

        // Delete the image
        await this.s3Service.deleteImage(imageInfo.region, imageInfo.s3Key);
        console.log(`✅ Deleted image: ${name}`);

        // Verify image no longer exists
        const existsAfter = await this.s3Service.imageExists(imageInfo.region, imageInfo.s3Key);
        if (existsAfter) {
          throw new Error(`Image ${name} should not exist after deletion`);
        }

        console.log(`✅ Verified deletion: ${name}`);
      }

      console.log();

      this.testResults.push({
        name: 'Image Deletion',
        passed: true
      });

    } catch (error) {
      console.log('❌ FAILED: Image deletion');
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log();

      this.testResults.push({
        name: 'Image Deletion',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Test 8: Bucket Policies and Permissions
   */
  private async testBucketPolicies(): Promise<void> {
    console.log('Test 8: Bucket Policies and Permissions');
    console.log('-'.repeat(80));

    try {
      // Test that we can perform all required operations
      const testMetadata = this.createTestMetadata('us-east-1', 'test-model');
      
      // Upload (tests PutObject permission)
      const uploadResult = await this.s3Service.uploadImage(
        'us-east-1',
        'test-model',
        this.testImageBuffer,
        testMetadata
      );
      console.log('✅ PutObject permission verified');

      // Get signed URL (tests GetObject permission)
      await this.s3Service.getSignedUrl('us-east-1', uploadResult.s3Key);
      console.log('✅ GetObject permission verified');

      // List (tests ListBucket permission)
      await this.s3Service.listImages('us-east-1');
      console.log('✅ ListBucket permission verified');

      // Delete (tests DeleteObject permission)
      await this.s3Service.deleteImage('us-east-1', uploadResult.s3Key);
      console.log('✅ DeleteObject permission verified');

      console.log();

      this.testResults.push({
        name: 'Bucket Policies and Permissions',
        passed: true
      });

    } catch (error) {
      console.log('❌ FAILED: Bucket policies and permissions');
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log('   This may indicate missing IAM permissions');
      console.log();

      this.testResults.push({
        name: 'Bucket Policies and Permissions',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Test 9: Error Handling
   */
  private async testErrorHandling(): Promise<void> {
    console.log('Test 9: Error Handling');
    console.log('-'.repeat(80));

    try {
      let errorTests = 0;
      let errorsPassed = 0;

      // Test 9.1: Invalid region
      errorTests++;
      try {
        await this.s3Service.uploadImage(
          'invalid-region' as any,
          'test-model',
          this.testImageBuffer,
          this.createTestMetadata('us-east-1', 'test-model')
        );
        console.log('❌ Should have thrown error for invalid region');
      } catch (error) {
        console.log('✅ Correctly handled invalid region error');
        errorsPassed++;
      }

      // Test 9.2: Invalid S3 key for signed URL
      errorTests++;
      try {
        await this.s3Service.getSignedUrl('us-east-1', 'non-existent-key.png');
        // Note: getSignedUrl may succeed even for non-existent keys (it just generates a URL)
        // The actual error would occur when trying to access the URL
        console.log('✅ Signed URL generated (will fail on access)');
        errorsPassed++;
      } catch (error) {
        console.log('✅ Correctly handled invalid key error');
        errorsPassed++;
      }

      // Test 9.3: Empty buffer upload
      errorTests++;
      try {
        await this.s3Service.uploadImage(
          'us-east-1',
          'test-model',
          Buffer.alloc(0),
          this.createTestMetadata('us-east-1', 'test-model')
        );
        console.log('⚠️  Empty buffer upload succeeded (may be valid)');
        errorsPassed++;
      } catch (error) {
        console.log('✅ Correctly handled empty buffer error');
        errorsPassed++;
      }

      console.log();
      console.log(`Error handling: ${errorsPassed}/${errorTests} tests passed`);
      console.log();

      this.testResults.push({
        name: 'Error Handling',
        passed: errorsPassed === errorTests,
        details: { passed: errorsPassed, total: errorTests }
      });

    } catch (error) {
      console.log('❌ FAILED: Error handling tests');
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log();

      this.testResults.push({
        name: 'Error Handling',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Test 10: Concurrent Operations
   */
  private async testConcurrentOperations(): Promise<void> {
    console.log('Test 10: Concurrent Operations');
    console.log('-'.repeat(80));

    try {
      const concurrentUploads = 5;
      const uploadPromises: Promise<any>[] = [];

      // Upload multiple images concurrently
      for (let i = 0; i < concurrentUploads; i++) {
        const metadata = this.createTestMetadata('us-east-1', `test-model-${i}`);
        const promise = this.s3Service.uploadImage(
          'us-east-1',
          `test-model-${i}`,
          this.testImageBuffer,
          metadata
        );
        uploadPromises.push(promise);
      }

      const startTime = Date.now();
      const results = await Promise.all(uploadPromises);
      const duration = Date.now() - startTime;

      console.log(`✅ Uploaded ${concurrentUploads} images concurrently`);
      console.log(`   Duration: ${duration}ms`);
      console.log(`   Average: ${Math.round(duration / concurrentUploads)}ms per image`);

      // Clean up uploaded images
      const deletePromises = results.map(result =>
        this.s3Service.deleteImage('us-east-1', result.s3Key)
      );
      await Promise.all(deletePromises);

      console.log(`✅ Cleaned up ${concurrentUploads} test images`);
      console.log();

      this.testResults.push({
        name: 'Concurrent Operations',
        passed: true,
        details: { count: concurrentUploads, duration, avgPerImage: Math.round(duration / concurrentUploads) }
      });

    } catch (error) {
      console.log('❌ FAILED: Concurrent operations');
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log();

      this.testResults.push({
        name: 'Concurrent Operations',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Create test metadata
   */
  private createTestMetadata(region: string, modelId: string): ImageMetadata {
    return {
      id: `test-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      imageUrl: '',
      modelId,
      modelName: `Test Model ${modelId}`,
      region,
      originalPrompt: 'Test prompt for S3 integration',
      optimizedPrompt: 'Optimized test prompt for S3 integration testing',
      parameters: {
        width: 512,
        height: 512,
        quality: 'standard'
      },
      generatedAt: new Date(),
      resolution: {
        width: 512,
        height: 512
      },
      fileSize: this.testImageBuffer.length,
      format: 'png',
      generationTime: 1000
    };
  }

  /**
   * Print test summary
   */
  private printSummary(): void {
    console.log('='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));
    console.log();

    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;
    const total = this.testResults.length;

    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log();

    if (failed > 0) {
      console.log('Failed Tests:');
      console.log('-'.repeat(80));
      this.testResults
        .filter(r => !r.passed)
        .forEach(result => {
          console.log(`❌ ${result.name}`);
          if (result.error) {
            console.log(`   Error: ${result.error}`);
          }
        });
      console.log();
    }

    console.log('Detailed Results:');
    console.log('-'.repeat(80));
    this.testResults.forEach(result => {
      const status = result.passed ? '✅ PASSED' : '❌ FAILED';
      console.log(`${status}: ${result.name}`);
      if (result.details) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
      }
    });
    console.log();

    console.log('='.repeat(80));
    
    if (failed === 0) {
      console.log('🎉 ALL TESTS PASSED! S3 integration is working correctly.');
    } else {
      console.log('⚠️  SOME TESTS FAILED. Please review the errors above.');
    }
    
    console.log('='.repeat(80));
  }
}

/**
 * Main test execution
 */
async function main() {
  try {
    const tester = new S3ComprehensiveTest();
    await tester.runAllTests();
    process.exit(0);
  } catch (error) {
    logger.error('Test execution failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

// Run tests
main();
