# Frontend Implementation

This directory contains the React frontend for the Bedrock Image Comparison Agent.

## Structure

```
src/frontend/
├── components/          # React components
│   ├── ModelSelector.tsx       # Model selection with 2-6 validation
│   ├── PromptInput.tsx         # Prompt input with character counter
│   ├── OptimizationView.tsx    # Display and edit optimized prompts
│   ├── ComparisonView.tsx      # Side-by-side image comparison
│   ├── ImageResultCard.tsx     # Individual image result display
│   ├── ErrorDisplay.tsx        # Error handling and display
│   ├── LoadingIndicator.tsx    # Loading states
│   └── index.ts                # Component exports
├── hooks/               # Custom React hooks
│   └── useApi.ts               # API interaction hooks
├── App.tsx              # Main application component
├── main.tsx             # Application entry point
├── index.css            # Global styles (Tailwind)
└── index.html           # HTML template

```

## Features Implemented

### 8.1 Project Structure ✅
- React 18 with TypeScript
- Tailwind CSS v4 with @tailwindcss/postcss
- React Query for state management
- Component directory structure

### 8.2 ModelSelector Component ✅
- Card grid layout for available models
- Multi-select with 2-6 model validation
- Display model name, provider, region, and pricing
- Visual feedback for selection state
- Persist selection via API

### 8.3 PromptInput Component ✅
- Textarea with 2000 character limit
- Real-time character counter
- Submit button with loading state
- Disabled state during processing

### 8.4 OptimizationView Component ✅
- Display original prompt
- Show optimized prompts in card layout
- Display model-specific parameters and reasoning
- Edit functionality for manual adjustments
- Confirm button to proceed to generation

### 8.5 ComparisonView Component ✅
- Display original prompt at top
- Responsive grid layout (1-3 columns)
- Show model info, generation time, resolution
- Display optimized prompt with each image
- Full-resolution modal view
- Download functionality

### 8.6 ImageResultCard Component ✅
- Display generated image with metadata
- Show optimized prompt text
- Click handler for full-resolution view
- Download button to save image
- Copy-to-clipboard for prompt
- Loading spinner during generation
- Error display for failed generations

### 8.7 React Query Hooks ✅
- `useModels()` - Fetch available models (1-hour cache)
- `useOptimizePrompt()` - Optimize prompts mutation
- `useGenerateImages()` - Generate images mutation
- `useSaveModelSelection()` - Save model selection

### 8.8 Error Handling ✅
- ErrorDisplay component for API errors
- Loading indicators during operations
- Per-model status during generation
- Retry functionality for retryable errors
- Content policy violation messages
- Rate limiting messages

## Running the Frontend

### Development
```bash
npm run dev:frontend
```
Starts Vite dev server on http://localhost:5173

### Build
```bash
npm run build:frontend
```
Builds production bundle to `dist/frontend/`

## API Integration

The frontend communicates with the backend API at `/api`:
- `GET /api/models` - Get available models
- `POST /api/optimize-prompt` - Optimize prompts
- `POST /api/generate-images` - Generate images
- `POST /api/config/models` - Save model selection

Vite proxy configuration handles API routing in development.

## State Management

The app uses a simple state machine with 5 states:
1. **setup** - Initial state, model selection and prompt input
2. **optimizing** - Optimizing prompts with Claude
3. **reviewing** - Review and edit optimized prompts
4. **generating** - Generating images concurrently
5. **complete** - Display comparison results

## Styling

- Tailwind CSS v4 for utility-first styling
- Responsive design (mobile, tablet, desktop)
- Consistent color scheme (blue primary, gray neutrals)
- Loading states and transitions
- Accessible form controls
