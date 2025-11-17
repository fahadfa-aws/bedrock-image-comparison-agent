# Gallery Cache Invalidation Implementation

## Overview

This document describes the implementation of gallery cache invalidation for Task 21 of the UI Refactor specification. The implementation ensures that the gallery always displays fresh data by invalidating the React Query cache at appropriate times.

## Requirements Addressed

**Requirement 12.4:** "WHEN the user generates new images, THE Image Comparison Agent SHALL automatically refresh the gallery cache"

## Implementation Details

### 1. Automatic Cache Invalidation After Image Generation

**File:** `src/frontend/hooks/useApi.ts`

The `useGenerateImages` hook now automatically invalidates the gallery cache when image generation succeeds:

```typescript
export const useGenerateImages = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (optimizedPrompts: OptimizedPrompt[]) => {
      const response = await axios.post(`${API_BASE}/generate-images`, { optimizedPrompts });
      return response.data;
    },
    onSuccess: () => {
      // Invalidate gallery cache after successful image generation
      queryClient.invalidateQueries({ queryKey: ['images'] });
      queryClient.invalidateQueries({ queryKey: ['imageStats'] });
    },
  });
};
```

**Benefits:**
- Automatic cache invalidation without manual intervention
- Ensures gallery shows newly generated images immediately
- Invalidates both image list and statistics

### 2. Manual Cache Invalidation Hook

**File:** `src/frontend/hooks/useApi.ts`

A new hook provides manual cache invalidation capability:

```typescript
export const useInvalidateGalleryCache = () => {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: ['images'] });
    queryClient.invalidateQueries({ queryKey: ['imageStats'] });
  };
};
```

**Usage:**
- Called when switching to gallery view
- Called when clicking "View in Gallery" button
- Provides explicit control over cache invalidation

### 3. Cache Invalidation When Switching Views

**File:** `src/frontend/App.tsx`

The App component now invalidates cache when switching to gallery view:

```typescript
const invalidateGalleryCache = useInvalidateGalleryCache();

const handleViewInGallery = () => {
  // Invalidate cache to ensure fresh data when viewing gallery
  invalidateGalleryCache();
  setShouldRefreshGallery(true);
  setCurrentView('gallery');
};

const handleViewChange = (view: AppView) => {
  if (view === 'gallery' && currentView === 'generate') {
    // Invalidate cache when switching to gallery view
    invalidateGalleryCache();
    setShouldRefreshGallery(true);
  }
  setCurrentView(view);
};
```

**Trigger Points:**
- Clicking the "Gallery" navigation tab
- Clicking the "View in Gallery" button after generation
- Any programmatic switch to gallery view

### 4. Enhanced Gallery Hooks

**Files:** 
- `src/frontend/hooks/useImageGallery.ts`
- `src/frontend/hooks/useImageStats.ts`

Both hooks now support:
- `refetchOnMount: 'always'` - Ensures fresh data on mount
- `invalidateCache()` method - Manual cache invalidation
- `refetch()` method - Force refetch of data

**useImageGallery updates:**
```typescript
const query = useQuery<ImageGalleryResponse>({
  queryKey: ['images', params],
  queryFn: async () => { /* ... */ },
  staleTime: 30000, // 30 seconds
  refetchOnMount: 'always', // Always refetch when component mounts
});

return {
  // ... existing returns
  invalidateCache,
  refetch,
};
```

**useImageStats updates:**
```typescript
const query = useQuery<StorageStats>({
  queryKey: ['imageStats'],
  queryFn: async () => { /* ... */ },
  staleTime: 60000, // 1 minute
  refetchOnMount: 'always', // Always refetch when component mounts
});

return {
  // ... existing returns
  invalidateCache,
  refetch,
};
```

## Cache Invalidation Flow

### Flow 1: Image Generation → Gallery View

```
User generates images
    ↓
useGenerateImages.onSuccess() triggered
    ↓
queryClient.invalidateQueries(['images'])
queryClient.invalidateQueries(['imageStats'])
    ↓
User clicks "View in Gallery"
    ↓
invalidateGalleryCache() called (redundant but safe)
    ↓
Gallery view mounts with refetchOnMount: 'always'
    ↓
Fresh data fetched from server
    ↓
Gallery displays new images
```

### Flow 2: Direct Gallery Tab Switch

```
User clicks "Gallery" tab
    ↓
handleViewChange() triggered
    ↓
invalidateGalleryCache() called
    ↓
queryClient.invalidateQueries(['images'])
queryClient.invalidateQueries(['imageStats'])
    ↓
Gallery view mounts/updates
    ↓
React Query refetches data automatically
    ↓
Gallery displays fresh data
```

## Benefits of This Implementation

### 1. Automatic Updates
- No manual refresh required
- Cache invalidation happens automatically after generation
- Users always see current data

### 2. Smooth User Experience
- React Query handles loading states
- Stale data is never displayed
- Transitions are smooth and predictable

### 3. Performance Optimized
- Cache is only invalidated when necessary
- React Query's smart refetching prevents unnecessary requests
- `staleTime` configuration balances freshness and performance

### 4. Maintainable
- Centralized cache invalidation logic
- Clear separation of concerns
- Easy to extend or modify

### 5. Reliable
- Multiple invalidation points ensure data freshness
- Redundant invalidation calls are safe (idempotent)
- Works with React Query's built-in mechanisms

## Testing

A comprehensive test plan has been created in `test-cache-invalidation.md` covering:

1. Cache invalidation after image generation
2. Cache invalidation when switching to gallery view
3. Cache invalidation via "View in Gallery" button
4. Smooth data updates
5. React Query DevTools verification

### Manual Testing Steps

1. **Generate images and verify cache invalidation:**
   ```
   - Generate images
   - Switch to Gallery tab
   - Verify new images appear immediately
   ```

2. **Test tab switching:**
   ```
   - Switch between Generate and Gallery tabs
   - Verify fresh data loads each time
   - Check Network tab for API calls
   ```

3. **Test "View in Gallery" button:**
   ```
   - Complete generation workflow
   - Click "View in Gallery"
   - Verify gallery shows new images
   ```

## Configuration

### React Query Settings

**Images Query:**
- `staleTime: 30000` (30 seconds)
- `refetchOnMount: 'always'`
- Query key: `['images', params]`

**Stats Query:**
- `staleTime: 60000` (1 minute)
- `refetchOnMount: 'always'`
- Query key: `['imageStats']`

### Cache Invalidation Targets

Both queries are invalidated together to maintain consistency:
```typescript
queryClient.invalidateQueries({ queryKey: ['images'] });
queryClient.invalidateQueries({ queryKey: ['imageStats'] });
```

## Future Enhancements

Potential improvements for future iterations:

1. **Optimistic Updates:** Update cache optimistically before server response
2. **Partial Invalidation:** Invalidate only specific query parameters
3. **Background Refetch:** Refetch in background without showing loading state
4. **Cache Persistence:** Persist cache to localStorage for offline support
5. **Real-time Updates:** WebSocket integration for live gallery updates

## Troubleshooting

### Issue: Gallery shows stale data

**Solution:** Verify that:
- `useGenerateImages` includes `onSuccess` callback
- `invalidateGalleryCache` is called in view change handlers
- React Query DevTools shows queries being invalidated

### Issue: Too many API requests

**Solution:** Adjust `staleTime` values:
- Increase `staleTime` to reduce refetch frequency
- Remove `refetchOnMount: 'always'` if not needed

### Issue: Cache not invalidating

**Solution:** Check that:
- Query keys match exactly: `['images']` and `['imageStats']`
- `useQueryClient` is properly imported and used
- React Query provider wraps the component tree

## Conclusion

The gallery cache invalidation implementation ensures that users always see fresh, up-to-date data in the gallery. The implementation leverages React Query's powerful caching and invalidation mechanisms to provide a smooth, automatic experience without requiring manual refreshes.

The solution is:
- ✅ Automatic (invalidates after generation)
- ✅ Explicit (invalidates on view switch)
- ✅ Smooth (uses React Query's built-in loading states)
- ✅ Reliable (multiple invalidation points)
- ✅ Maintainable (centralized logic)
- ✅ Performant (smart refetching with staleTime)
