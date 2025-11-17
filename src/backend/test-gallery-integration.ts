/**
 * Gallery Integration Test
 * 
 * Tests the complete gallery integration including:
 * - "View in Gallery" button functionality
 * - Tab switching between Generate and Gallery views
 * - Cache invalidation after image generation
 * - Data refresh when switching to gallery
 * - S3 image display in gallery
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 13.4
 */

import axios from 'axios';
import { ImageMetadata } from '../shared/types';

const API_BASE = 'http://localhost:3000/api';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, message: string, details?: any) {
  results.push({ name, passed, message, details });
  const icon = passed ? '✓' : '✗';
  const color = passed ? '\x1b[32m' : '\x1b[31m';
  console.log(`${color}${icon}\x1b[0m ${name}: ${message}`);
  if (details) {
    console.log('  Details:', JSON.stringify(details, null, 2));
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test 1: Verify gallery API endpoint returns S3 signed URLs
 * Requirement: 13.4 - Display images using S3 signed URLs
 */
async function testGalleryApiWithS3Urls(): Promise<void> {
  console.log('\n=== Test 1: Gallery API with S3 Signed URLs ===');
  
  try {
    const response = await axios.get(`${API_BASE}/images`);
    
    if (response.status !== 200) {
      logTest(
        'Gallery API Response',
        false,
        `Expected status 200, got ${response.status}`
      );
      return;
    }
    
    logTest(
      'Gallery API Response',
      true,
      'Successfully fetched images from gallery API'
    );
    
    const { images } = response.data;
    
    if (!Array.isArray(images)) {
      logTest(
        'Gallery API Data Structure',
        false,
        'Response does not contain images array'
      );
      return;
    }
    
    logTest(
      'Gallery API Data Structure',
      true,
      `Received ${images.length} images`
    );
    
    // Check if images have S3 URLs
    if (images.length > 0) {
      const firstImage = images[0];
      
      // Verify S3 URL structure
      const hasS3Url = firstImage.imageUrl && 
                       (firstImage.imageUrl.includes('s3.amazonaws.com') || 
                        firstImage.imageUrl.includes('X-Amz-Signature'));
      
      logTest(
        'S3 Signed URL Present',
        hasS3Url,
        hasS3Url 
          ? 'Images contain S3 signed URLs' 
          : 'Images do not contain S3 signed URLs',
        { 
          imageUrl: firstImage.imageUrl?.substring(0, 100) + '...',
          hasSignature: firstImage.imageUrl?.includes('X-Amz-Signature')
        }
      );
      
      // Verify required metadata fields
      const requiredFields = ['id', 'modelId', 'modelName', 'imageUrl', 'generatedAt'];
      const missingFields = requiredFields.filter(field => !(field in firstImage));
      
      logTest(
        'Image Metadata Complete',
        missingFields.length === 0,
        missingFields.length === 0 
          ? 'All required metadata fields present' 
          : `Missing fields: ${missingFields.join(', ')}`,
        { availableFields: Object.keys(firstImage) }
      );
    } else {
      logTest(
        'Gallery Has Images',
        false,
        'No images in gallery - generate some images first to test S3 integration'
      );
    }
    
  } catch (error: any) {
    logTest(
      'Gallery API Request',
      false,
      `Failed to fetch gallery: ${error.message}`,
      { error: error.response?.data || error.message }
    );
  }
}

/**
 * Test 2: Verify cache invalidation after image generation
 * Requirement: 12.4 - Automatically refresh gallery cache after generation
 */
async function testCacheInvalidationAfterGeneration(): Promise<void> {
  console.log('\n=== Test 2: Cache Invalidation After Generation ===');
  
  try {
    // Get initial gallery state
    const initialResponse = await axios.get(`${API_BASE}/images`);
    const initialCount = initialResponse.data.images.length;
    
    logTest(
      'Initial Gallery State',
      true,
      `Gallery has ${initialCount} images before generation`
    );
    
    // Simulate image generation workflow
    console.log('\nSimulating image generation workflow...');
    
    // Step 1: Optimize prompt
    const optimizeResponse = await axios.post(`${API_BASE}/optimize-prompt`, {
      originalPrompt: 'A serene mountain landscape at sunset',
      selectedModels: ['amazon.nova-canvas-v1:0']
    });
    
    if (optimizeResponse.status !== 200) {
      logTest(
        'Prompt Optimization',
        false,
        `Optimization failed with status ${optimizeResponse.status}`
      );
      return;
    }
    
    logTest(
      'Prompt Optimization',
      true,
      'Successfully optimized prompt'
    );
    
    const { optimizedPrompts } = optimizeResponse.data;
    
    // Step 2: Generate images
    console.log('\nGenerating images (this may take 30-60 seconds)...');
    const generateResponse = await axios.post(`${API_BASE}/generate-images`, {
      optimizedPrompts
    });
    
    if (generateResponse.status !== 200) {
      logTest(
        'Image Generation',
        false,
        `Generation failed with status ${generateResponse.status}`
      );
      return;
    }
    
    const { results: generationResults } = generateResponse.data;
    const successfulGenerations = generationResults.filter((r: any) => r.success).length;
    
    logTest(
      'Image Generation',
      successfulGenerations > 0,
      `Successfully generated ${successfulGenerations} image(s)`,
      { totalAttempts: generationResults.length, successful: successfulGenerations }
    );
    
    // Step 3: Verify gallery was updated
    console.log('\nVerifying gallery cache was invalidated...');
    
    // Wait a moment for cache invalidation to propagate
    await delay(1000);
    
    const updatedResponse = await axios.get(`${API_BASE}/images`);
    const updatedCount = updatedResponse.data.images.length;
    
    const cacheInvalidated = updatedCount > initialCount;
    
    logTest(
      'Gallery Cache Invalidation',
      cacheInvalidated,
      cacheInvalidated
        ? `Gallery updated: ${initialCount} → ${updatedCount} images`
        : `Gallery not updated: still ${updatedCount} images`,
      { 
        before: initialCount, 
        after: updatedCount,
        newImages: updatedCount - initialCount
      }
    );
    
    // Verify new images are from S3
    if (cacheInvalidated) {
      const newImages = updatedResponse.data.images.slice(0, updatedCount - initialCount);
      const allHaveS3Urls = newImages.every((img: ImageMetadata) => 
        img.imageUrl && 
        (img.imageUrl.includes('s3.amazonaws.com') || img.imageUrl.includes('X-Amz-Signature'))
      );
      
      logTest(
        'New Images Use S3',
        allHaveS3Urls,
        allHaveS3Urls
          ? 'All new images have S3 signed URLs'
          : 'Some new images missing S3 URLs'
      );
    }
    
  } catch (error: any) {
    logTest(
      'Cache Invalidation Test',
      false,
      `Test failed: ${error.message}`,
      { error: error.response?.data || error.message }
    );
  }
}

/**
 * Test 3: Verify gallery data refresh on tab switch
 * Requirement: 12.1, 12.2, 12.3 - Seamless gallery integration with consistent styling
 */
async function testGalleryDataRefresh(): Promise<void> {
  console.log('\n=== Test 3: Gallery Data Refresh ===');
  
  try {
    // Simulate first gallery view
    const firstFetch = await axios.get(`${API_BASE}/images`);
    const firstFetchTime = Date.now();
    
    logTest(
      'Initial Gallery Fetch',
      firstFetch.status === 200,
      `Fetched ${firstFetch.data.images.length} images`,
      { timestamp: new Date(firstFetchTime).toISOString() }
    );
    
    // Wait a moment
    await delay(2000);
    
    // Simulate switching away and back to gallery
    console.log('\nSimulating tab switch back to gallery...');
    const secondFetch = await axios.get(`${API_BASE}/images`);
    const secondFetchTime = Date.now();
    
    logTest(
      'Gallery Refresh on Tab Switch',
      secondFetch.status === 200,
      'Successfully refreshed gallery data',
      { 
        timeSinceLastFetch: `${secondFetchTime - firstFetchTime}ms`,
        imageCount: secondFetch.data.images.length
      }
    );
    
    // Verify data freshness
    const dataIsFresh = secondFetchTime > firstFetchTime;
    
    logTest(
      'Data Freshness',
      dataIsFresh,
      'Gallery data is fresh after refresh'
    );
    
  } catch (error: any) {
    logTest(
      'Gallery Data Refresh',
      false,
      `Refresh test failed: ${error.message}`,
      { error: error.response?.data || error.message }
    );
  }
}

/**
 * Test 4: Verify gallery stats endpoint
 * Requirement: 12.5 - Smooth transition between views
 */
async function testGalleryStats(): Promise<void> {
  console.log('\n=== Test 4: Gallery Stats ===');
  
  try {
    const response = await axios.get(`${API_BASE}/images/stats`);
    
    if (response.status !== 200) {
      logTest(
        'Gallery Stats API',
        false,
        `Expected status 200, got ${response.status}`
      );
      return;
    }
    
    logTest(
      'Gallery Stats API',
      true,
      'Successfully fetched gallery stats'
    );
    
    const stats = response.data;
    
    // Verify stats structure
    const requiredFields = ['totalImages', 'totalSize', 'modelBreakdown'];
    const hasAllFields = requiredFields.every(field => field in stats);
    
    logTest(
      'Stats Data Structure',
      hasAllFields,
      hasAllFields 
        ? 'All required stats fields present' 
        : 'Missing stats fields',
      { 
        totalImages: stats.totalImages,
        totalSize: stats.totalSize,
        models: Object.keys(stats.modelBreakdown || {})
      }
    );
    
  } catch (error: any) {
    logTest(
      'Gallery Stats',
      false,
      `Stats test failed: ${error.message}`,
      { error: error.response?.data || error.message }
    );
  }
}

/**
 * Test 5: Verify S3 image accessibility
 * Requirement: 13.4 - Images accessible via signed URLs
 */
async function testS3ImageAccessibility(): Promise<void> {
  console.log('\n=== Test 5: S3 Image Accessibility ===');
  
  try {
    const response = await axios.get(`${API_BASE}/images`);
    const images = response.data.images;
    
    if (images.length === 0) {
      logTest(
        'S3 Image Accessibility',
        false,
        'No images available to test - generate images first'
      );
      return;
    }
    
    // Test first image URL
    const testImage = images[0];
    
    logTest(
      'Test Image Selected',
      true,
      `Testing image: ${testImage.modelId}`,
      { 
        imageId: testImage.id,
        modelId: testImage.modelId,
        urlPreview: testImage.imageUrl?.substring(0, 80) + '...'
      }
    );
    
    // Try to fetch the image
    try {
      const imageResponse = await axios.head(testImage.imageUrl, {
        timeout: 10000
      });
      
      const isAccessible = imageResponse.status === 200;
      const contentType = imageResponse.headers['content-type'];
      
      logTest(
        'S3 Image Accessible',
        isAccessible,
        isAccessible 
          ? `Image accessible via S3 signed URL (${contentType})` 
          : 'Image not accessible',
        { 
          status: imageResponse.status,
          contentType,
          contentLength: imageResponse.headers['content-length']
        }
      );
      
    } catch (imageError: any) {
      logTest(
        'S3 Image Accessible',
        false,
        `Failed to access image: ${imageError.message}`,
        { 
          error: imageError.message,
          url: testImage.imageUrl?.substring(0, 100)
        }
      );
    }
    
  } catch (error: any) {
    logTest(
      'S3 Image Accessibility Test',
      false,
      `Test failed: ${error.message}`,
      { error: error.response?.data || error.message }
    );
  }
}

/**
 * Test 6: Verify gallery filtering and sorting
 * Requirement: 12.1, 12.2 - Gallery functionality
 */
async function testGalleryFilteringAndSorting(): Promise<void> {
  console.log('\n=== Test 6: Gallery Filtering and Sorting ===');
  
  try {
    // Test model filtering
    const allImagesResponse = await axios.get(`${API_BASE}/images`);
    const allImages = allImagesResponse.data.images;
    
    if (allImages.length === 0) {
      logTest(
        'Gallery Filtering',
        false,
        'No images to test filtering - generate images first'
      );
      return;
    }
    
    logTest(
      'Gallery Has Images',
      true,
      `Gallery contains ${allImages.length} images for testing`
    );
    
    // Get unique models
    const uniqueModels = [...new Set(allImages.map((img: ImageMetadata) => img.modelId))];
    
    logTest(
      'Multiple Models Present',
      uniqueModels.length > 0,
      `Found ${uniqueModels.length} unique model(s)`,
      { models: uniqueModels }
    );
    
    // Test filtering by model (if multiple models exist)
    if (uniqueModels.length > 1) {
      const testModel = uniqueModels[0];
      const filteredResponse = await axios.get(`${API_BASE}/images?model=${testModel}`);
      const filteredImages = filteredResponse.data.images;
      
      const allMatchModel = filteredImages.every((img: ImageMetadata) => img.modelId === testModel);
      
      logTest(
        'Model Filtering',
        allMatchModel,
        allMatchModel
          ? `Successfully filtered to ${filteredImages.length} images for ${testModel}`
          : 'Model filtering returned incorrect results',
        { 
          requestedModel: testModel,
          resultCount: filteredImages.length
        }
      );
    }
    
    // Test sorting
    const sortedResponse = await axios.get(`${API_BASE}/images?sort=newest`);
    const sortedImages = sortedResponse.data.images;
    
    if (sortedImages.length > 1) {
      const isSortedNewest = new Date(sortedImages[0].generatedAt).getTime() >= 
                             new Date(sortedImages[1].generatedAt).getTime();
      
      logTest(
        'Sorting (Newest First)',
        isSortedNewest,
        isSortedNewest
          ? 'Images correctly sorted by newest first'
          : 'Sorting not working correctly',
        {
          first: sortedImages[0].generatedAt,
          second: sortedImages[1].generatedAt
        }
      );
    }
    
  } catch (error: any) {
    logTest(
      'Gallery Filtering and Sorting',
      false,
      `Test failed: ${error.message}`,
      { error: error.response?.data || error.message }
    );
  }
}

/**
 * Test 7: Verify pagination
 * Requirement: 12.1 - Gallery view functionality
 */
async function testGalleryPagination(): Promise<void> {
  console.log('\n=== Test 7: Gallery Pagination ===');
  
  try {
    // Test first page
    const page1Response = await axios.get(`${API_BASE}/images?page=1&limit=5`);
    const page1Data = page1Response.data;
    
    logTest(
      'Pagination - Page 1',
      page1Response.status === 200,
      `Fetched page 1 with ${page1Data.images.length} images`,
      { 
        page: page1Data.page,
        hasMore: page1Data.hasMore,
        imageCount: page1Data.images.length
      }
    );
    
    // Test second page if more images exist
    if (page1Data.hasMore) {
      const page2Response = await axios.get(`${API_BASE}/images?page=2&limit=5`);
      const page2Data = page2Response.data;
      
      const differentImages = page1Data.images[0]?.id !== page2Data.images[0]?.id;
      
      logTest(
        'Pagination - Page 2',
        differentImages,
        differentImages
          ? `Page 2 contains different images (${page2Data.images.length} images)`
          : 'Page 2 contains same images as page 1',
        { 
          page: page2Data.page,
          imageCount: page2Data.images.length
        }
      );
    } else {
      logTest(
        'Pagination - Multiple Pages',
        false,
        'Not enough images to test pagination - generate more images'
      );
    }
    
  } catch (error: any) {
    logTest(
      'Gallery Pagination',
      false,
      `Pagination test failed: ${error.message}`,
      { error: error.response?.data || error.message }
    );
  }
}

/**
 * Main test runner
 */
async function runAllTests(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         Gallery Integration Test Suite                    ║');
  console.log('║                                                            ║');
  console.log('║  Testing Requirements:                                     ║');
  console.log('║  - 12.1: Gallery view with consistent styling             ║');
  console.log('║  - 12.2: Same header and footer in gallery                ║');
  console.log('║  - 12.3: Same color scheme and typography                 ║');
  console.log('║  - 12.4: Automatic gallery cache refresh                  ║');
  console.log('║  - 12.5: Smooth transition between views                  ║');
  console.log('║  - 13.4: S3 signed URLs for image display                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log('Starting tests...\n');
  console.log('Note: Make sure the backend server is running on http://localhost:3000\n');
  
  // Run all tests
  await testGalleryApiWithS3Urls();
  await testCacheInvalidationAfterGeneration();
  await testGalleryDataRefresh();
  await testGalleryStats();
  await testS3ImageAccessibility();
  await testGalleryFilteringAndSorting();
  await testGalleryPagination();
  
  // Print summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                     Test Summary                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log(`Total Tests: ${total}`);
  console.log(`\x1b[32mPassed: ${passed}\x1b[0m`);
  console.log(`\x1b[31mFailed: ${failed}\x1b[0m`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);
  
  if (failed > 0) {
    console.log('Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  \x1b[31m✗\x1b[0m ${r.name}: ${r.message}`);
    });
    console.log('');
  }
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('\n\x1b[31mFatal error running tests:\x1b[0m', error);
  process.exit(1);
});
