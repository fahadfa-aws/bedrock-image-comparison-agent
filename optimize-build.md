# Build Optimization Implementation Guide

This guide provides step-by-step instructions to implement the performance optimizations identified in the performance testing.

## 1. Enable Gzip Compression

### For Vite Development Server

Already enabled by default in production builds.

### For Production Deployment

#### Option A: Nginx Configuration

```nginx
# /etc/nginx/nginx.conf or site-specific config
http {
    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/rss+xml
        font/truetype
        font/opentype
        application/vnd.ms-fontobject
        image/svg+xml;
}
```

#### Option B: Express Server (if serving static files)

```typescript
import compression from 'compression';
import express from 'express';

const app = express();

// Enable gzip compression
app.use(compression({
  level: 6,
  threshold: 1024, // Only compress files > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

app.use(express.static('dist/frontend'));
```

#### Option C: CloudFront CDN

```yaml
# CloudFormation template
Resources:
  CloudFrontDistribution:
    Type: AWS::CloudFront::Distribution
    Properties:
      DistributionConfig:
        Enabled: true
        DefaultCacheBehavior:
          Compress: true  # Enable automatic compression
          TargetOriginId: S3Origin
          ViewerProtocolPolicy: redirect-to-https
```

**Expected Impact:** 70% reduction in transfer size (1MB → ~300KB)

---

## 2. Remove Source Maps from Production

### Update vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false, // Disable source maps in production
    // Or use 'hidden' to generate but not reference them
    // sourcemap: 'hidden',
  },
});
```

### Update tsconfig.json

```json
{
  "compilerOptions": {
    "sourceMap": false  // Disable for production builds
  }
}
```

**Expected Impact:** 284KB reduction (28% of current bundle)

---

## 3. Implement Code Splitting

### Update App.tsx

```typescript
import React, { Suspense, lazy } from 'react';
import LoadingIndicator from './components/LoadingIndicator';

// Lazy load gallery view
const GalleryView = lazy(() => import('./components/GalleryView'));

function App() {
  return (
    <div className="app-container">
      {currentView === 'gallery' ? (
        <Suspense fallback={<LoadingIndicator overallMessage="Loading gallery..." />}>
          <GalleryView />
        </Suspense>
      ) : (
        // Generate view components
      )}
    </div>
  );
}
```

### Advanced Code Splitting with Route-Based Loading

```typescript
// Create separate chunks for each major feature
const ModelSelector = lazy(() => import('./components/ModelSelector'));
const PromptInput = lazy(() => import('./components/PromptInput'));
const OptimizationView = lazy(() => import('./components/OptimizationView'));
const ComparisonView = lazy(() => import('./components/ComparisonView'));

// Use Suspense boundaries
<Suspense fallback={<LoadingIndicator />}>
  {currentStep === 'model-selection' && <ModelSelector />}
  {currentStep === 'prompt-input' && <PromptInput />}
  {currentStep === 'optimization' && <OptimizationView />}
  {currentStep === 'comparison' && <ComparisonView />}
</Suspense>
```

**Expected Impact:** 30-40% reduction in initial bundle size

---

## 4. Configure Manual Chunks in Vite

### Update vite.config.ts

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom'],
          'react-query': ['@tanstack/react-query'],
          'aws-sdk': [
            '@aws-sdk/client-s3',
            '@aws-sdk/client-bedrock-runtime',
            '@aws-sdk/s3-request-presigner'
          ],
          
          // Feature chunks
          'gallery': ['./src/frontend/components/GalleryView.tsx'],
          'comparison': ['./src/frontend/components/ComparisonView.tsx'],
        },
      },
    },
    chunkSizeWarningLimit: 500, // Warn if chunk > 500KB
  },
});
```

**Expected Impact:** Better caching, faster subsequent loads

---

## 5. Implement Image Lazy Loading

### Update ImageCard Component

```typescript
import { useEffect, useRef, useState } from 'react';

function ImageCard({ imageUrl, alt }: ImageCardProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsLoaded(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className="image-card">
      {isLoaded ? (
        <img
          src={imageUrl}
          alt={alt}
          loading="lazy"
          onLoad={() => console.log('Image loaded')}
        />
      ) : (
        <div className="image-placeholder">Loading...</div>
      )}
    </div>
  );
}
```

**Expected Impact:** Faster initial page load, reduced bandwidth

---

## 6. Implement S3 URL Caching

### Create URL Cache Hook

```typescript
import { useQuery } from '@tanstack/react-query';

function useSignedUrl(s3Key: string, region: string) {
  return useQuery({
    queryKey: ['signed-url', s3Key, region],
    queryFn: async () => {
      const response = await fetch(`/api/signed-url?key=${s3Key}&region=${region}`);
      return response.json();
    },
    staleTime: 50 * 60 * 1000, // 50 minutes (URLs expire in 60 minutes)
    cacheTime: 55 * 60 * 1000, // Keep in cache for 55 minutes
  });
}
```

### Update Backend API

```typescript
// Cache signed URLs in memory
const urlCache = new Map<string, { url: string; expiresAt: number }>();

app.get('/api/signed-url', async (req, res) => {
  const { key, region } = req.query;
  const cacheKey = `${region}:${key}`;
  
  // Check cache
  const cached = urlCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json({ url: cached.url });
  }
  
  // Generate new URL
  const url = await s3Service.getSignedUrl(region, key, 3600);
  
  // Cache it
  urlCache.set(cacheKey, {
    url,
    expiresAt: Date.now() + 50 * 60 * 1000, // 50 minutes
  });
  
  res.json({ url });
});
```

**Expected Impact:** Reduced API calls, faster image loading

---

## 7. Optimize Dependencies

### Analyze Bundle

```bash
npm run build -- --analyze
```

### Remove Unused Dependencies

```bash
# Check for unused dependencies
npx depcheck

# Remove unused packages
npm uninstall <package-name>
```

### Use Lighter Alternatives

Consider replacing heavy dependencies:
- `moment` → `date-fns` or native `Intl.DateTimeFormat`
- `lodash` → `lodash-es` (tree-shakeable) or native methods
- Large icon libraries → Use only needed icons

**Expected Impact:** 10-20% bundle size reduction

---

## 8. Enable Tree Shaking

### Ensure ES Modules

```json
// package.json
{
  "type": "module",
  "sideEffects": false  // Enable aggressive tree shaking
}
```

### Import Only What You Need

```typescript
// ❌ Bad - imports entire library
import _ from 'lodash';

// ✅ Good - imports only what's needed
import { debounce } from 'lodash-es';

// ✅ Better - use native methods
const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};
```

**Expected Impact:** 5-15% bundle size reduction

---

## 9. Implement Build-Time Optimizations

### Update package.json Scripts

```json
{
  "scripts": {
    "build": "npm run build:backend && npm run build:frontend",
    "build:frontend": "vite build --mode production",
    "build:backend": "tsc",
    "build:analyze": "vite build --mode production && npm run analyze:bundle",
    "build:optimized": "npm run build && npm run optimize:post-build"
  }
}
```

### Post-Build Optimization Script

```bash
#!/bin/bash
# optimize-post-build.sh

echo "Running post-build optimizations..."

# Remove source maps
find dist -name "*.map" -type f -delete

# Compress assets (if not using CDN compression)
find dist -type f \( -name "*.js" -o -name "*.css" -o -name "*.html" \) -exec gzip -k {} \;

echo "Optimization complete!"
```

---

## 10. Set Up Performance Monitoring

### Add Performance Marks

```typescript
// In App.tsx
useEffect(() => {
  performance.mark('app-mounted');
  
  return () => {
    performance.mark('app-unmounted');
    performance.measure('app-lifetime', 'app-mounted', 'app-unmounted');
  };
}, []);
```

### Report to Analytics

```typescript
function reportWebVitals(metric: Metric) {
  // Send to analytics
  console.log(metric);
  
  // Or send to your analytics service
  // analytics.track('web-vital', metric);
}

// In main.tsx
import { onCLS, onFID, onFCP, onLCP, onTTFB } from 'web-vitals';

onCLS(reportWebVitals);
onFID(reportWebVitals);
onFCP(reportWebVitals);
onLCP(reportWebVitals);
onTTFB(reportWebVitals);
```

---

## Implementation Checklist

- [ ] Enable gzip compression on web server
- [ ] Disable source maps in production builds
- [ ] Implement code splitting for GalleryView
- [ ] Configure manual chunks in Vite
- [ ] Add image lazy loading
- [ ] Implement S3 URL caching
- [ ] Audit and remove unused dependencies
- [ ] Enable tree shaking
- [ ] Set up post-build optimization script
- [ ] Add performance monitoring
- [ ] Test optimizations in staging
- [ ] Deploy to production
- [ ] Monitor performance metrics

## Verification

After implementing optimizations, run:

```bash
# Build with optimizations
npm run build

# Run performance tests
npm run test:performance

# Analyze bundle
npm run analyze:bundle

# Expected results:
# - Bundle size: < 500KB (from 662KB)
# - Initial load: < 2s
# - No memory leaks
# - All tests passing
```

## Rollback Plan

If optimizations cause issues:

1. Revert changes: `git revert <commit-hash>`
2. Rebuild: `npm run build`
3. Redeploy previous version
4. Investigate issues
5. Re-apply optimizations incrementally

## Support

For questions or issues:
- Review `PERFORMANCE-TEST-GUIDE.md`
- Check `PERFORMANCE-TEST-REPORT.md`
- Run `npm run test:performance` for diagnostics
