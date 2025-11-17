# Cache Invalidation Test Plan

This document outlines the manual testing steps to verify that gallery cache invalidation is working correctly.

## Test Setup

1. Start the application: `npm run dev`
2. Open the application in a browser
3. Open browser DevTools Console to monitor cache invalidation logs

## Test Case 1: Cache Invalidation After Image Generation

**Objective:** Verify that the gallery cache is invalidated after successful image generation.

**Steps:**
1. Navigate to the Generate view (Step 1: Select Models)
2. Select 1-2 models
3. Click "Continue to Prompt"
4. Enter a prompt (e.g., "a beautiful sunset over mountains")
5. Submit the prompt
6. Review optimized prompts and click "Generate Images"
7. Wait for image generation to complete
8. Switch to the Gallery tab

**Expected Results:**
- After image generation completes, the gallery cache should be automatically invalidated
- When switching to Gallery view, the newly generated images should appear immediately
- No manual refresh should be required
- Console should show cache invalidation happening

**Verification:**
- Check that newly generated images appear in the gallery
- Verify the image count in the gallery header is updated
- Confirm storage stats are updated

## Test Case 2: Cache Invalidation When Switching to Gallery View

**Objective:** Verify that the gallery cache is invalidated when switching from Generate to Gallery view.

**Steps:**
1. Start in the Generate view
2. Click the "Gallery" tab to switch views
3. Observe the gallery loading behavior
4. Switch back to "Generate" tab
5. Switch to "Gallery" tab again

**Expected Results:**
- Each time the Gallery tab is clicked, the cache should be invalidated
- Fresh data should be fetched from the server
- The gallery should show the most up-to-date images
- Console should show cache invalidation on each switch

**Verification:**
- Check browser DevTools Network tab for API calls to `/api/images` and `/api/images/stats`
- Verify that requests are made each time the Gallery tab is clicked
- Confirm that the gallery displays current data

## Test Case 3: Cache Invalidation via "View in Gallery" Button

**Objective:** Verify that clicking "View in Gallery" button after generation invalidates cache.

**Steps:**
1. Complete the image generation workflow (Steps 1-4)
2. On Step 4 (Compare Results), click the "View in Gallery" button
3. Observe the gallery view

**Expected Results:**
- Cache should be invalidated before switching to gallery view
- Newly generated images should appear in the gallery
- Gallery should show fresh data from the server

**Verification:**
- Newly generated images are visible in the gallery
- Image count and stats are updated
- No stale data is displayed

## Test Case 4: Smooth Data Updates

**Objective:** Verify that cache invalidation results in smooth, non-disruptive updates.

**Steps:**
1. Open the Gallery view with existing images
2. In a separate browser tab/window, generate new images
3. Return to the original Gallery tab
4. Switch to Generate view and back to Gallery view

**Expected Results:**
- When switching back to Gallery, cache invalidation should trigger a smooth refresh
- No jarring UI changes or flashing
- Loading indicators should be shown appropriately
- Data should update seamlessly

**Verification:**
- UI remains stable during cache refresh
- No error messages appear
- Images load smoothly without flickering
- Loading states are appropriate

## Test Case 5: Cache Behavior with React Query DevTools

**Objective:** Use React Query DevTools to observe cache invalidation behavior.

**Prerequisites:**
- Install React Query DevTools (if not already installed)
- Add DevTools to the app temporarily for testing

**Steps:**
1. Open React Query DevTools in the browser
2. Navigate to Gallery view
3. Observe the `['images']` and `['imageStats']` queries
4. Generate new images
5. Watch the queries in DevTools

**Expected Results:**
- After image generation, both `['images']` and `['imageStats']` queries should show as "invalidated"
- Queries should automatically refetch
- Fresh data should be displayed in the UI

**Verification:**
- DevTools shows query invalidation
- Queries refetch automatically
- Cache state updates correctly

## Success Criteria

All test cases should pass with the following outcomes:

✅ Gallery cache is invalidated after successful image generation
✅ Gallery cache is invalidated when switching to Gallery view
✅ Gallery cache is invalidated when clicking "View in Gallery" button
✅ Data updates are smooth and non-disruptive
✅ No stale data is displayed in the gallery
✅ React Query cache state is managed correctly

## Notes

- Cache invalidation should be automatic and transparent to the user
- Users should not need to manually refresh the page
- The gallery should always show the most current data
- Performance should not be negatively impacted by cache invalidation
