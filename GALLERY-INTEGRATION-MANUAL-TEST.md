# Gallery Integration Manual Test Guide

## Prerequisites
- Backend server running (`npm run dev:backend`)
- Frontend server running (`npm run dev:frontend`)
- At least 2 images generated in the gallery

## Test 1: "View in Gallery" Button

### Steps:
1. Open the application in your browser (http://localhost:5173)
2. Complete the image generation workflow:
   - Step 1: Select 2 models
   - Step 2: Enter a prompt
   - Step 3: Review optimized prompts
   - Step 4: Wait for images to generate
3. On Step 4 (Compare Results), locate the "View in Gallery" button
4. Click the "View in Gallery" button

### Expected Results:
- ✓ Application switches to the Gallery tab
- ✓ Gallery tab becomes active (white background)
- ✓ Gallery view displays with the same header and footer
- ✓ Generated images appear in the gallery
- ✓ New images are at the top (sorted by newest first)

### Pass Criteria:
All expected results must be true.

---

## Test 2: Tab Switching

### Steps:
1. Start on the Generate tab
2. Click the "Gallery" tab
3. Observe the gallery view
4. Click the "Generate" tab
5. Verify the generate workflow state

### Expected Results:
- ✓ Clicking Gallery tab switches to gallery view smoothly
- ✓ Active tab has white background and colored text
- ✓ Inactive tab has transparent background
- ✓ Gallery displays images with consistent styling
- ✓ Switching back to Generate preserves your workflow state
- ✓ No page reload or flicker during tab switch

### Pass Criteria:
All expected results must be true.

---

## Test 3: Cache Invalidation After Generation

### Steps:
1. Note the current number of images in the gallery
2. Switch to the Generate tab
3. Generate new images (complete the full workflow)
4. Click "View in Gallery" button
5. Check if new images appear

### Expected Results:
- ✓ New images appear in the gallery immediately
- ✓ No manual refresh required
- ✓ Image count increases by the number of models selected
- ✓ New images are at the top of the gallery

### Pass Criteria:
All expected results must be true.

---

## Test 4: Data Refresh on Tab Switch

### Steps:
1. Open the Gallery tab
2. Note the images displayed
3. Switch to Generate tab
4. Wait 5 seconds
5. Switch back to Gallery tab
6. Observe if data is refreshed

### Expected Results:
- ✓ Gallery data is refreshed when switching back
- ✓ No stale data displayed
- ✓ Loading indicator may briefly appear
- ✓ Images display correctly after refresh

### Pass Criteria:
All expected results must be true.

---

## Test 5: Visual Consistency

### Steps:
1. Compare the Generate view and Gallery view side by side
2. Check header, footer, colors, and typography

### Expected Results:

#### Header:
- ✓ Same gradient background (purple to pink)
- ✓ Same title: "Bedrock Image Comparison Agent"
- ✓ Same subtitle
- ✓ Same navigation tabs
- ✓ Same font and text colors

#### Footer:
- ✓ Same content: "Powered by AWS Bedrock and Claude Sonnet 4.5"
- ✓ Same styling and position

#### Colors:
- ✓ Same background color (#f5f5f5)
- ✓ Same card backgrounds (white)
- ✓ Same button colors (primary: #667eea, secondary: #e0e0e0)
- ✓ Same text colors

#### Typography:
- ✓ Same font family
- ✓ Same heading sizes
- ✓ Same body text size

### Pass Criteria:
All expected results must be true.

---

## Test 6: Gallery Functionality

### Steps:
1. Open the Gallery tab
2. Test filtering by model (if multiple models exist)
3. Test search functionality
4. Test sorting options
5. Click on an image to open modal
6. Test image actions (download, delete)

### Expected Results:
- ✓ Model filter dropdown works correctly
- ✓ Search filters images by prompt text
- ✓ Sorting changes image order
- ✓ Image modal opens when clicking an image
- ✓ Download button downloads the image
- ✓ Delete button removes the image
- ✓ Gallery updates after deletion

### Pass Criteria:
All expected results must be true.

---

## Test 7: Responsive Design

### Steps:
1. Open the application in a desktop browser
2. Resize the browser window to tablet size (768px - 1024px)
3. Resize to mobile size (< 768px)
4. Test tab switching at each size

### Expected Results:
- ✓ Layout adapts to different screen sizes
- ✓ Navigation tabs remain accessible
- ✓ Images display in appropriate grid columns
- ✓ All interactive elements are touch-friendly
- ✓ No horizontal scrolling
- ✓ Text remains readable

### Pass Criteria:
All expected results must be true.

---

## Test 8: Error Handling

### Steps:
1. Stop the backend server
2. Try to switch to Gallery tab
3. Observe error handling
4. Restart the backend server
5. Click retry button

### Expected Results:
- ✓ Error message displays clearly
- ✓ Retry button is available
- ✓ Error doesn't crash the application
- ✓ Retry button successfully reloads data

### Pass Criteria:
All expected results must be true.

---

## Test 9: State Preservation

### Steps:
1. Start generating images (Step 1-3)
2. Switch to Gallery tab
3. Switch back to Generate tab
4. Verify your progress is preserved

### Expected Results:
- ✓ Selected models are still selected
- ✓ Entered prompt is still there
- ✓ Optimized prompts are preserved
- ✓ You're on the same step you left
- ✓ No data loss when switching tabs

### Pass Criteria:
All expected results must be true.

---

## Test 10: S3 Integration (Optional)

**Note**: This test requires S3 to be enabled in .env file.

### Steps:
1. Set `IMAGE_STORAGE_TYPE=s3` in .env
2. Restart the backend server
3. Generate new images
4. View in gallery
5. Open browser DevTools Network tab
6. Observe image URLs

### Expected Results:
- ✓ Images are uploaded to S3 during generation
- ✓ Gallery displays images via S3 signed URLs
- ✓ Image URLs contain `X-Amz-Signature` parameter
- ✓ Images load correctly from S3
- ✓ No errors in console

### Pass Criteria:
All expected results must be true.

---

## Summary Checklist

Use this checklist to track your testing progress:

- [ ] Test 1: "View in Gallery" Button
- [ ] Test 2: Tab Switching
- [ ] Test 3: Cache Invalidation After Generation
- [ ] Test 4: Data Refresh on Tab Switch
- [ ] Test 5: Visual Consistency
- [ ] Test 6: Gallery Functionality
- [ ] Test 7: Responsive Design
- [ ] Test 8: Error Handling
- [ ] Test 9: State Preservation
- [ ] Test 10: S3 Integration (Optional)

## Reporting Issues

If any test fails, document:
1. Test number and name
2. Steps to reproduce
3. Expected result
4. Actual result
5. Screenshots (if applicable)
6. Browser and version
7. Console errors (if any)

## Success Criteria

**All tests must pass** for the gallery integration to be considered complete.

Minimum passing score: **9/10 tests** (Test 10 is optional if S3 is not enabled)
