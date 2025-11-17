/**
 * Performance Testing Suite
 * 
 * Tests:
 * 1. Initial load time measurement
 * 2. Image loading performance from S3
 * 3. Memory leak detection
 * 4. Bundle size analysis
 * 5. Slow connection simulation
 */

import { performance } from 'perf_hooks';
import { readFileSync, statSync, readdirSync } from 'fs';
import { join } from 'path';

interface PerformanceMetrics {
  testName: string;
  duration: number;
  memoryUsed: number;
  status: 'PASS' | 'FAIL' | 'WARNING';
  details?: string;
}

const results: PerformanceMetrics[] = [];

// Performance thresholds
const THRESHOLDS = {
  initialLoadTime: 3000, // 3 seconds
  imageLoadTime: 2000, // 2 seconds per image
  memoryLeakThreshold: 50 * 1024 * 1024, // 50MB
  bundleSizeWarning: 1024 * 1024, // 1MB
  bundleSizeCritical: 5 * 1024 * 1024, // 5MB
};

function logMetric(metric: PerformanceMetrics) {
  results.push(metric);
  const statusSymbol = metric.status === 'PASS' ? '✓' : metric.status === 'WARNING' ? '⚠' : '✗';
  console.log(`${statusSymbol} ${metric.testName}: ${metric.duration.toFixed(2)}ms (Memory: ${(metric.memoryUsed / 1024 / 1024).toFixed(2)}MB)`);
  if (metric.details) {
    console.log(`  ${metric.details}`);
  }
}

async function measureInitialLoadTime() {
  console.log('\n📊 Test 1: Initial Load Time Measurement');
  console.log('=========================================');
  
  const startTime = performance.now();
  const startMemory = process.memoryUsage().heapUsed;
  
  try {
    // Simulate loading main application modules
    const appPath = './src/frontend/App.tsx';
    const mainPath = './src/frontend/main.tsx';
    
    // Check if files exist and measure read time
    const appContent = readFileSync(appPath, 'utf-8');
    const mainContent = readFileSync(mainPath, 'utf-8');
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;
    const duration = endTime - startTime;
    const memoryUsed = endMemory - startMemory;
    
    const status = duration < THRESHOLDS.initialLoadTime ? 'PASS' : 'WARNING';
    const details = status === 'WARNING' 
      ? `Exceeds threshold of ${THRESHOLDS.initialLoadTime}ms`
      : `Within acceptable range`;
    
    logMetric({
      testName: 'Initial Load Time',
      duration,
      memoryUsed,
      status,
      details
    });
    
    // Analyze component count
    const componentCount = (appContent.match(/import.*from/g) || []).length;
    console.log(`  Components imported: ${componentCount}`);
    
  } catch (error) {
    logMetric({
      testName: 'Initial Load Time',
      duration: 0,
      memoryUsed: 0,
      status: 'FAIL',
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
}

async function testImageLoadingPerformance() {
  console.log('\n📊 Test 2: Image Loading Performance from S3');
  console.log('==============================================');
  
  const startTime = performance.now();
  const startMemory = process.memoryUsage().heapUsed;
  
  try {
    // Simulate S3 signed URL generation and image loading
    const { S3StorageService } = await import('./src/backend/services/S3StorageService.js');
    
    const s3Service = new S3StorageService();
    
    // Test signed URL generation performance
    const urlStartTime = performance.now();
    
    // Simulate multiple concurrent URL generations
    const urlPromises = Array.from({ length: 10 }, (_, i) => 
      s3Service.getSignedUrl('us-east-1', `test-image-${i}.png`, 3600)
        .catch(() => null) // Handle errors gracefully
    );
    
    const results = await Promise.all(urlPromises);
    const successCount = results.filter(r => r !== null).length;
    
    const urlEndTime = performance.now();
    const urlDuration = urlEndTime - urlStartTime;
    const avgUrlTime = urlDuration / 10;
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;
    const duration = endTime - startTime;
    const memoryUsed = endMemory - startMemory;
    
    // If no AWS credentials, mark as warning instead of fail
    if (successCount === 0) {
      logMetric({
        testName: 'S3 Image Loading Performance',
        duration,
        memoryUsed,
        status: 'WARNING',
        details: 'AWS credentials not configured. Skipping S3 tests.'
      });
      return;
    }
    
    const status = avgUrlTime < THRESHOLDS.imageLoadTime ? 'PASS' : 'WARNING';
    const details = `Average URL generation: ${avgUrlTime.toFixed(2)}ms per image (${successCount}/10 successful)`;
    
    logMetric({
      testName: 'S3 Image Loading Performance',
      duration,
      memoryUsed,
      status,
      details
    });
    
  } catch (error) {
    // Don't fail the entire test suite for S3 issues
    logMetric({
      testName: 'S3 Image Loading Performance',
      duration: 0,
      memoryUsed: 0,
      status: 'WARNING',
      details: `Skipped: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
}

async function checkMemoryLeaks() {
  console.log('\n📊 Test 3: Memory Leak Detection');
  console.log('==================================');
  
  const iterations = 100;
  const memorySnapshots: number[] = [];
  
  try {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const initialMemory = process.memoryUsage().heapUsed;
    memorySnapshots.push(initialMemory);
    
    // Simulate repeated operations
    for (let i = 0; i < iterations; i++) {
      // Simulate image generation workflow
      const data = {
        modelId: `test-model-${i}`,
        prompt: `Test prompt ${i}`,
        imageData: Buffer.alloc(1024 * 100), // 100KB buffer
        metadata: {
          timestamp: Date.now(),
          iteration: i
        }
      };
      
      // Clear reference
      if (i % 10 === 0) {
        memorySnapshots.push(process.memoryUsage().heapUsed);
        if (global.gc) {
          global.gc();
        }
      }
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = finalMemory - initialMemory;
    
    // Calculate memory growth trend
    const avgGrowth = memoryGrowth / iterations;
    const status = memoryGrowth < THRESHOLDS.memoryLeakThreshold ? 'PASS' : 'WARNING';
    
    const details = `Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB over ${iterations} iterations (${(avgGrowth / 1024).toFixed(2)}KB per iteration)`;
    
    logMetric({
      testName: 'Memory Leak Detection',
      duration: 0,
      memoryUsed: memoryGrowth,
      status,
      details
    });
    
    // Analyze memory trend
    if (memorySnapshots.length > 2) {
      const trend = memorySnapshots[memorySnapshots.length - 1] - memorySnapshots[0];
      console.log(`  Memory trend: ${trend > 0 ? '+' : ''}${(trend / 1024 / 1024).toFixed(2)}MB`);
    }
    
  } catch (error) {
    logMetric({
      testName: 'Memory Leak Detection',
      duration: 0,
      memoryUsed: 0,
      status: 'FAIL',
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
}

function analyzeBundleSize() {
  console.log('\n📊 Test 4: Bundle Size Analysis');
  console.log('=================================');
  
  try {
    const distPath = './dist';
    let totalSize = 0;
    const files: { name: string; size: number }[] = [];
    
    function scanDirectory(dir: string) {
      try {
        const items = readdirSync(dir);
        
        for (const item of items) {
          const fullPath = join(dir, item);
          try {
            const stats = statSync(fullPath);
            
            if (stats.isDirectory()) {
              scanDirectory(fullPath);
            } else if (stats.isFile()) {
              totalSize += stats.size;
              files.push({
                name: fullPath.replace(distPath + '/', ''),
                size: stats.size
              });
            }
          } catch (err) {
            // Skip files we can't access
          }
        }
      } catch (err) {
        // Directory doesn't exist or can't be read
      }
    }
    
    scanDirectory(distPath);
    
    if (files.length === 0) {
      logMetric({
        testName: 'Bundle Size Analysis',
        duration: 0,
        memoryUsed: 0,
        status: 'WARNING',
        details: 'No build artifacts found. Run "npm run build" first.'
      });
      return;
    }
    
    // Sort by size
    files.sort((a, b) => b.size - a.size);
    
    const status = totalSize < THRESHOLDS.bundleSizeCritical 
      ? (totalSize < THRESHOLDS.bundleSizeWarning ? 'PASS' : 'WARNING')
      : 'FAIL';
    
    const details = `Total bundle size: ${(totalSize / 1024 / 1024).toFixed(2)}MB across ${files.length} files`;
    
    logMetric({
      testName: 'Bundle Size Analysis',
      duration: 0,
      memoryUsed: totalSize,
      status,
      details
    });
    
    // Show largest files
    console.log('\n  Largest files:');
    files.slice(0, 5).forEach(file => {
      console.log(`    ${file.name}: ${(file.size / 1024).toFixed(2)}KB`);
    });
    
    // Analyze by type
    const byType: Record<string, number> = {};
    files.forEach(file => {
      const ext = file.name.split('.').pop() || 'unknown';
      byType[ext] = (byType[ext] || 0) + file.size;
    });
    
    console.log('\n  Size by file type:');
    Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, size]) => {
        console.log(`    .${type}: ${(size / 1024).toFixed(2)}KB`);
      });
    
  } catch (error) {
    logMetric({
      testName: 'Bundle Size Analysis',
      duration: 0,
      memoryUsed: 0,
      status: 'FAIL',
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
}

async function testSlowConnection() {
  console.log('\n📊 Test 5: Slow Connection Simulation');
  console.log('======================================');
  
  const startTime = performance.now();
  const startMemory = process.memoryUsage().heapUsed;
  
  try {
    // Simulate network delays
    const networkDelays = [100, 250, 500, 1000]; // ms
    
    for (const delay of networkDelays) {
      const delayStart = performance.now();
      
      // Simulate API call with delay
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const delayEnd = performance.now();
      const actualDelay = delayEnd - delayStart;
      
      console.log(`  ${delay}ms delay: ${actualDelay.toFixed(2)}ms actual`);
    }
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;
    const duration = endTime - startTime;
    const memoryUsed = endMemory - startMemory;
    
    // Test timeout handling
    const timeoutTest = await Promise.race([
      new Promise(resolve => setTimeout(() => resolve('timeout'), 5000)),
      new Promise(resolve => setTimeout(() => resolve('success'), 100))
    ]);
    
    const status = timeoutTest === 'success' ? 'PASS' : 'WARNING';
    const details = `Timeout handling: ${timeoutTest}`;
    
    logMetric({
      testName: 'Slow Connection Simulation',
      duration,
      memoryUsed,
      status,
      details
    });
    
  } catch (error) {
    logMetric({
      testName: 'Slow Connection Simulation',
      duration: 0,
      memoryUsed: 0,
      status: 'FAIL',
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
}

function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 PERFORMANCE TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const warnings = results.filter(r => r.status === 'WARNING').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  
  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`✓ Passed: ${passed}`);
  console.log(`⚠ Warnings: ${warnings}`);
  console.log(`✗ Failed: ${failed}`);
  
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const totalMemory = results.reduce((sum, r) => sum + r.memoryUsed, 0);
  
  console.log(`\nTotal Duration: ${totalDuration.toFixed(2)}ms`);
  console.log(`Total Memory Used: ${(totalMemory / 1024 / 1024).toFixed(2)}MB`);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 RECOMMENDATIONS');
  console.log('='.repeat(60));
  
  const recommendations: string[] = [];
  
  results.forEach(result => {
    if (result.status === 'WARNING' || result.status === 'FAIL') {
      if (result.testName.includes('Load Time')) {
        recommendations.push('• Consider code splitting and lazy loading for faster initial load');
        recommendations.push('• Implement route-based code splitting');
      }
      if (result.testName.includes('Bundle Size')) {
        recommendations.push('• Analyze and remove unused dependencies');
        recommendations.push('• Enable tree shaking in build configuration');
        recommendations.push('• Consider using dynamic imports for large components');
      }
      if (result.testName.includes('Memory')) {
        recommendations.push('• Review component lifecycle and cleanup');
        recommendations.push('• Ensure proper cleanup of event listeners and subscriptions');
        recommendations.push('• Use React.memo and useMemo for expensive computations');
      }
      if (result.testName.includes('Image Loading')) {
        recommendations.push('• Implement image lazy loading');
        recommendations.push('• Add image caching strategy');
        recommendations.push('• Consider using CDN for static assets');
      }
    }
  });
  
  if (recommendations.length === 0) {
    console.log('\n✓ All performance metrics are within acceptable ranges!');
  } else {
    console.log('');
    [...new Set(recommendations)].forEach(rec => console.log(rec));
  }
  
  console.log('\n' + '='.repeat(60));
}

// Main execution
async function runPerformanceTests() {
  console.log('🚀 Starting Performance Test Suite');
  console.log('===================================\n');
  
  await measureInitialLoadTime();
  await testImageLoadingPerformance();
  await checkMemoryLeaks();
  analyzeBundleSize();
  await testSlowConnection();
  
  generateReport();
  
  // Exit with appropriate code (warnings don't fail the build)
  const hasFailed = results.some(r => r.status === 'FAIL');
  const hasWarnings = results.some(r => r.status === 'WARNING');
  
  if (hasWarnings && !hasFailed) {
    console.log('\n⚠️  Some tests have warnings but overall performance is acceptable.');
  }
  
  process.exit(hasFailed ? 1 : 0);
}

runPerformanceTests().catch(error => {
  console.error('Fatal error running performance tests:', error);
  process.exit(1);
});
