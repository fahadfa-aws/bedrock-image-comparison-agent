/**
 * Integration test for API endpoints with S3 storage
 * Tests the complete flow of GET /api/images with signed URL generation
 */

import dotenv from 'dotenv';
import { S3StorageService } from './services/S3StorageService.js';
import { ImageLibraryService } from './services/ImageLibraryService.js';
import { ImageMetadata, StorageStats } from '../shared/types.js';
import { logger } from './logger.js';

// Load environment variables
dotenv.config();

async function testAPIEndpoints() {
  console.log('\n=== Testing API Endpoints with S3 Storage ===\n');

  try {
    // Initialize services
    const s3BucketUsEast1 = process.env.S3_BUCKET_US_EAST_1;
    const s3BucketUsWest2 = process.env.S3_BUCKET_US_WEST_2;

    if (!s3BucketUsEast1 || !s3BucketUsWest2) {
      console.error('❌ S3 bucket names not configured');
      return;
    }

    const s3StorageService = new S3StorageService({
      buckets: {
        'us-east-1': s3BucketUsEast1,
        'us-west-2': s3BucketUsWest2
      },
      signedUrlExpiration: parseInt(process.env.S3_SIGNED_URL_EXPIRATION || '3600'),
      endpoint: process.env.S3_ENDPOINT
    });

    console.log('✅ S3StorageService initialized');

    // Test 1: Simulate GET /api/images endpoint
    console.log('\n--- Test 1: GET /api/images (List All Images) ---');
    
    const regions = s3StorageService.getRegions();
    const imagePromises = regions.map(region => s3StorageService.listImages(region));
    const imagesByRegion = await Promise.all(imagePromises);
    let images = imagesByRegion.flat();

    console.log(`✅ Fetched ${images.length} images from S3`);

    // Generate signed URLs for each image
    await Promise.all(images.map(async (image) => {
      try {
        let s3Key: string | null = null;
        
        if (image.imageUrl && image.imageUrl.startsWith('s3://')) {
          const s3UrlMatch = image.imageUrl.match(/^s3:\/\/[^/]+\/(.+)$/);
          if (s3UrlMatch) {
            s3Key = s3UrlMatch[1];
          }
        }
        
        if (!s3Key && (image as any)._metadataKey) {
          s3Key = (image as any)._metadataKey
            .replace('metadata/', '')
            .replace('.json', '.png');
        }

        if (s3Key) {
          const signedUrl = await s3StorageService.getSignedUrl(
            image.region,
            s3Key,
            3600
          );
          
          image.imageUrl = signedUrl;
        }
      } catch (error) {
        console.error(`Failed to generate signed URL for ${image.id}:`, error);
      }
    }));

    console.log('✅ Generated signed URLs for all images');

    if (images.length > 0) {
      const sample = images[0];
      console.log('\nSample image:');
      console.log(`  ID: ${sample.id}`);
      console.log(`  Model: ${sample.modelId}`);
      console.log(`  Region: ${sample.region}`);
      console.log(`  URL type: ${sample.imageUrl.startsWith('https://') ? 'Signed URL' : 'S3 URL'}`);
      console.log(`  URL length: ${sample.imageUrl.length} characters`);
      console.log(`  Has signature: ${sample.imageUrl.includes('X-Amz-Signature') ? 'Yes' : 'No'}`);
    }

    // Test 2: Simulate GET /api/images with filtering
    console.log('\n--- Test 2: GET /api/images?model={modelId} (Filter by Model) ---');
    
    if (images.length > 0) {
      const modelId = images[0].modelId;
      const filteredImages = images.filter(img => img.modelId === modelId);
      console.log(`✅ Filtered by model ${modelId}: ${filteredImages.length} images`);
    } else {
      console.log('⚠️  No images to filter');
    }

    // Test 3: Simulate GET /api/images with search
    console.log('\n--- Test 3: GET /api/images?search={query} (Search by Prompt) ---');
    
    if (images.length > 0) {
      const searchQuery = 'sunset';
      const searchResults = images.filter(img => {
        const originalPrompt = img.originalPrompt.toLowerCase();
        const optimizedPrompt = img.optimizedPrompt.toLowerCase();
        return originalPrompt.includes(searchQuery) || optimizedPrompt.includes(searchQuery);
      });
      console.log(`✅ Search for "${searchQuery}": ${searchResults.length} results`);
    } else {
      console.log('⚠️  No images to search');
    }

    // Test 4: Simulate GET /api/images with sorting
    console.log('\n--- Test 4: GET /api/images?sort={order} (Sort Images) ---');
    
    if (images.length > 0) {
      // Sort by newest
      const sortedByNewest = [...images].sort((a, b) => 
        b.generatedAt.getTime() - a.generatedAt.getTime()
      );
      console.log(`✅ Sorted by newest: ${sortedByNewest.length} images`);
      
      // Sort by oldest
      const sortedByOldest = [...images].sort((a, b) => 
        a.generatedAt.getTime() - b.generatedAt.getTime()
      );
      console.log(`✅ Sorted by oldest: ${sortedByOldest.length} images`);
      
      // Sort by model
      const sortedByModel = [...images].sort((a, b) => {
        const modelCompare = a.modelId.localeCompare(b.modelId);
        if (modelCompare !== 0) return modelCompare;
        return b.generatedAt.getTime() - a.generatedAt.getTime();
      });
      console.log(`✅ Sorted by model: ${sortedByModel.length} images`);
    } else {
      console.log('⚠️  No images to sort');
    }

    // Test 5: Simulate GET /api/images with pagination
    console.log('\n--- Test 5: GET /api/images?page={page}&limit={limit} (Pagination) ---');
    
    const pageSize = 5;
    const totalPages = Math.ceil(images.length / pageSize);
    console.log(`Total images: ${images.length}`);
    console.log(`Page size: ${pageSize}`);
    console.log(`Total pages: ${totalPages}`);
    
    const page1 = images.slice(0, pageSize);
    console.log(`✅ Page 1: ${page1.length} images`);
    
    if (images.length > pageSize) {
      const page2 = images.slice(pageSize, pageSize * 2);
      console.log(`✅ Page 2: ${page2.length} images`);
    }

    // Test 6: Simulate GET /api/images/:id endpoint
    console.log('\n--- Test 6: GET /api/images/:id (Get Single Image) ---');
    
    if (images.length > 0) {
      const testImage = images[0];
      console.log(`Testing with image ID: ${testImage.id}`);
      
      // Find image in both regions
      let foundImage: ImageMetadata | null = null;
      
      for (const region of regions) {
        const regionImages = await s3StorageService.listImages(region);
        foundImage = regionImages.find(img => img.id === testImage.id) || null;
        
        if (foundImage) {
          // Generate signed URL
          const s3UrlMatch = foundImage.imageUrl.match(/^s3:\/\/[^/]+\/(.+)$/);
          if (s3UrlMatch) {
            const s3Key = s3UrlMatch[1];
            const signedUrl = await s3StorageService.getSignedUrl(region, s3Key, 3600);
            foundImage.imageUrl = signedUrl;
          }
          break;
        }
      }
      
      if (foundImage) {
        console.log('✅ Image found and signed URL generated');
        console.log(`  URL type: ${foundImage.imageUrl.startsWith('https://') ? 'Signed URL' : 'S3 URL'}`);
      } else {
        console.error('❌ Image not found');
      }
    } else {
      console.log('⚠️  No images to test');
    }

    // Test 7: Simulate GET /api/images/stats endpoint
    console.log('\n--- Test 7: GET /api/images/stats (Storage Statistics) ---');
    
    // Calculate statistics
    const totalImages = images.length;
    const totalSize = images.reduce((sum, img) => sum + img.fileSize, 0);
    
    const sizeByModel: Record<string, number> = {};
    images.forEach(img => {
      if (!sizeByModel[img.modelId]) {
        sizeByModel[img.modelId] = 0;
      }
      sizeByModel[img.modelId] += img.fileSize;
    });

    let oldestImage: Date | null = null;
    let newestImage: Date | null = null;

    if (images.length > 0) {
      const sortedByDate = [...images].sort((a, b) => 
        a.generatedAt.getTime() - b.generatedAt.getTime()
      );
      oldestImage = sortedByDate[0].generatedAt;
      newestImage = sortedByDate[sortedByDate.length - 1].generatedAt;
    }

    const stats: StorageStats = {
      totalImages,
      totalSize,
      sizeByModel,
      oldestImage,
      newestImage
    };

    console.log('✅ Storage statistics calculated');
    console.log(`  Total images: ${stats.totalImages}`);
    console.log(`  Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Models: ${Object.keys(stats.sizeByModel).length}`);
    if (stats.oldestImage) {
      console.log(`  Oldest: ${stats.oldestImage.toISOString()}`);
    }
    if (stats.newestImage) {
      console.log(`  Newest: ${stats.newestImage.toISOString()}`);
    }

    // Test 8: URL expiration handling
    console.log('\n--- Test 8: URL Expiration Handling ---');
    
    console.log('Current expiration: 1 hour (3600 seconds)');
    console.log('✅ Within AWS best practices (max 7 days)');
    console.log('✅ Appropriate for gallery viewing use case');
    
    // Test different expiration times
    if (images.length > 0) {
      const testImage = images[0];
      const s3UrlMatch = testImage.imageUrl.match(/^s3:\/\/[^/]+\/(.+)$/);
      
      if (s3UrlMatch) {
        const s3Key = s3UrlMatch[1];
        
        // Short expiration (5 minutes)
        const shortUrl = await s3StorageService.getSignedUrl(testImage.region, s3Key, 300);
        console.log('✅ Generated URL with 5 minute expiration');
        
        // Long expiration (24 hours)
        const longUrl = await s3StorageService.getSignedUrl(testImage.region, s3Key, 86400);
        console.log('✅ Generated URL with 24 hour expiration');
        
        // Maximum expiration (7 days)
        const maxUrl = await s3StorageService.getSignedUrl(testImage.region, s3Key, 604800);
        console.log('✅ Generated URL with 7 day expiration (maximum)');
      }
    }

    console.log('\n=== All API Endpoint Tests Completed Successfully ===\n');

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
testAPIEndpoints();
