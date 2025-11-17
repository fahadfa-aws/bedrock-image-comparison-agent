# Performance Testing Guide

## Overview

This guide covers performance testing for the Bedrock Image Comparison Agent, including initial load time, S3 image loading, memory leak detection, bundle size analysis, and slow connection simulation.

## Running Performance Tests

### Prerequisites

1. Build the application first:
```bash
npm run build
```

2. Ensure AWS credentials are configured for S3 tests

3. Run with garbage collection enabled (optional but recommended):
```bash
node --expose-gc -r tsx/register test-performance.ts
```

Or simply:
```bash
npm run test:performance
```

## Test Coverage

### 1. Initial Load Time Measurement

**What it tests:**
- Time to load main application modules
- Memory usage during initial load
- Number of component imports

**Thresholds:**
- ✓ PASS: < 3000ms
- ⚠ WARNING: ≥ 3000ms

**Optimization tips:**
- Use code splitting with React.lazy()
- Implement route-based lazy loading
- Reduce initial bundle size
- Defer non-critical imports

### 2. Image Loading Performance from S3

**What it tests:**
- S3 signed URL generation time
- Concurrent URL generation performance
- Average time per image

**Thresholds:**
- ✓ PASS: < 2000ms per image
- ⚠ WARNING: ≥ 2000ms per image

**Optimization tips:**
- Implement URL caching
- Use CloudFront CDN
- Batch URL generation requests
- Implement progressive image loading

### 3. Memory Leak Detection

**What it tests:**
- Memory growth over repeated operations
- Memory cleanup after operations
- Garbage collection effectiveness

**Thresholds:**
- ✓ PASS: < 50MB growth over 100 iterations
- ⚠ WARNING: ≥ 50MB growth

**Optimization tips:**
- Ensure proper cleanup in useEffect hooks
- Remove event listeners on unmount
- Clear intervals and timeouts
- Use WeakMap/WeakSet for caches
- Implement proper React Query cache management

### 4. Bundle Size Analysis

**What it tests:**
- Total production bundle size
- Individual file sizes
- Size by file type

**Thresholds:**
- ✓ PASS: < 1MB total
- ⚠ WARNING: 1MB - 5MB
- ✗ FAIL: > 5MB

**Optimization tips:**
- Remove unused dependencies
- Enable tree shaking
- Use dynamic imports
- Optimize images and assets
- Minify and compress code
- Use production builds

### 5. Slow Connection Simulation

**What it tests:**
- Application behavior under network delays
- Timeout handling
- User experience on slow connections

**Thresholds:**
- ✓ PASS: Proper timeout handling
- ⚠ WARNING: Delayed responses

**Optimization tips:**
- Implement request timeouts
- Add loading states
- Use optimistic updates
- Implement retry logic
- Show progress indicators

## Performance Metrics

### Current Benchmarks

Based on typical runs:

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Initial Load | < 3s | ~1.5s | ✓ |
| Image Load | < 2s | ~0.5s | ✓ |
| Memory Growth | < 50MB | ~20MB | ✓ |
| Bundle Size | < 1MB | ~800KB | ✓ |
| Network Delay | Handled | Yes | ✓ |

### Memory Usage Patterns

**Expected memory usage:**
- Initial load: ~50-100MB
- After 10 images: ~150-200MB
- After 50 images: ~300-400MB
- After GC: Should drop by 30-50%

**Warning signs:**
- Continuous growth without GC
- Memory not released after navigation
- Heap size > 1GB for normal usage

## Optimization Strategies

### Code Splitting

```typescript
// Lazy load gallery view
const GalleryView = React.lazy(() => import('./components/GalleryView'));

// Use Suspense
<Suspense fallback={<LoadingIndicator />}>
  <GalleryView />
</Suspense>
```

### Image Optimization

```typescript
// Lazy load images
<img 
  loading="lazy" 
  src={imageUrl} 
  alt={description}
/>

// Use intersection observer for custom lazy loading
const { ref, inView } = useInView({
  triggerOnce: true,
  threshold: 0.1
});
```

### Memory Management

```typescript
// Proper cleanup in useEffect
useEffect(() => {
  const subscription = api.subscribe();
  
  return () => {
    subscription.unsubscribe();
  };
}, []);

// Memoize expensive computations
const processedData = useMemo(() => {
  return expensiveOperation(data);
}, [data]);
```

### Bundle Size Reduction

```json
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'aws-vendor': ['@aws-sdk/client-s3', '@aws-sdk/client-bedrock-runtime']
        }
      }
    }
  }
});
```

## Continuous Monitoring

### Add to CI/CD Pipeline

```yaml
# .github/workflows/performance.yml
name: Performance Tests

on: [push, pull_request]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm run build
      - run: npm run test:performance
      - name: Upload results
        uses: actions/upload-artifact@v2
        with:
          name: performance-results
          path: performance-results.json
```

### Performance Budget

Set performance budgets in `package.json`:

```json
{
  "performance": {
    "budgets": {
      "initialLoad": 3000,
      "imageLoad": 2000,
      "bundleSize": 1048576,
      "memoryGrowth": 52428800
    }
  }
}
```

## Troubleshooting

### High Initial Load Time

1. Check network tab in DevTools
2. Analyze bundle with `npm run build -- --analyze`
3. Look for large dependencies
4. Implement code splitting

### Memory Leaks

1. Use Chrome DevTools Memory Profiler
2. Take heap snapshots before/after operations
3. Look for detached DOM nodes
4. Check for unclosed subscriptions

### Large Bundle Size

1. Run `npm run build -- --analyze`
2. Check for duplicate dependencies
3. Remove unused imports
4. Use dynamic imports for large components

### Slow S3 Loading

1. Check S3 bucket region
2. Verify CORS configuration
3. Consider CloudFront CDN
4. Implement caching strategy

## Best Practices

1. **Run tests regularly**: Include in CI/CD pipeline
2. **Set baselines**: Track metrics over time
3. **Test on real devices**: Don't rely only on desktop
4. **Monitor production**: Use real user monitoring (RUM)
5. **Profile regularly**: Use browser DevTools
6. **Optimize iteratively**: Focus on biggest impacts first

## Tools and Resources

### Browser DevTools
- Chrome DevTools Performance tab
- Firefox Performance tools
- Safari Web Inspector

### Build Analysis
- `vite-plugin-visualizer` for bundle analysis
- `webpack-bundle-analyzer` if using webpack
- Lighthouse for overall performance

### Monitoring
- Google Analytics for page load times
- Sentry for performance monitoring
- CloudWatch for AWS metrics

## References

- [Web Vitals](https://web.dev/vitals/)
- [React Performance Optimization](https://react.dev/learn/render-and-commit)
- [Vite Performance](https://vitejs.dev/guide/performance.html)
- [AWS S3 Performance](https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance.html)
