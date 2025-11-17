import { useState, useEffect } from 'react';
import { OptimizedPrompt, ImageGenerationResult } from '@shared/types';
import ModelSelector from './components/ModelSelector';
import PromptInput from './components/PromptInput';
import OptimizationView from './components/OptimizationView';
import ComparisonView from './components/ComparisonView';
import ErrorDisplay from './components/ErrorDisplay';
import LoadingIndicator from './components/LoadingIndicator';
import GalleryView from './components/GalleryView';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './contexts/ToastContext';
import { 
  useModels, 
  useOptimizePrompt, 
  useGenerateImages, 
  useSaveModelSelection,
  useInvalidateGalleryCache
} from './hooks/useApi';

type AppStep = 'model-selection' | 'prompt-input' | 'optimization' | 'generation' | 'comparison';
type AppView = 'generate' | 'gallery';

function App() {
  // View and step state management
  const [currentView, setCurrentView] = useState<AppView>('generate');
  const [currentStep, setCurrentStep] = useState<AppStep>('model-selection');
  
  // Data state
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [optimizedPrompts, setOptimizedPrompts] = useState<OptimizedPrompt[]>([]);
  const [generationResults, setGenerationResults] = useState<ImageGenerationResult[]>([]);
  const [shouldRefreshGallery, setShouldRefreshGallery] = useState(false);
  const [modelResolutions, setModelResolutions] = useState<Record<string, { width: number; height: number }>>({});
  
  // Error recovery state - preserve user input
  const [lastValidPrompt, setLastValidPrompt] = useState('');
  const [lastValidOptimizedPrompts, setLastValidOptimizedPrompts] = useState<OptimizedPrompt[]>([]);

  const { data: modelsData, isLoading: modelsLoading, error: modelsError } = useModels();
  const optimizeMutation = useOptimizePrompt();
  const generateMutation = useGenerateImages();
  const saveSelectionMutation = useSaveModelSelection();
  const invalidateGalleryCache = useInvalidateGalleryCache();

  useEffect(() => {
    if (modelsData?.models && selectedModels.length === 0) {
      const defaultSelection = modelsData.models.slice(0, 2).map(m => m.modelId);
      setSelectedModels(defaultSelection);
    }
  }, [modelsData]);

  // Step navigation handlers
  const handleContinueToPrompt = () => {
    setCurrentStep('prompt-input');
  };

  const handlePromptSubmit = async (prompt: string) => {
    setOriginalPrompt(prompt);
    setLastValidPrompt(prompt); // Preserve input for error recovery
    setCurrentStep('optimization');

    try {
      const result = await optimizeMutation.mutateAsync({
        originalPrompt: prompt,
        selectedModels,
      });
      
      setOptimizedPrompts(result.optimizedPrompts);
      setLastValidOptimizedPrompts(result.optimizedPrompts); // Save for recovery
    } catch (error) {
      console.error('Optimization failed:', error);
      // Error is handled by mutation state, don't change step here
      // User input is preserved in originalPrompt and lastValidPrompt
    }
  };

  const handleOptimizationEdit = (modelId: string, newPrompt: string) => {
    setOptimizedPrompts(prev =>
      prev.map(p =>
        p.modelId === modelId
          ? { ...p, optimizedPrompt: newPrompt }
          : p
      )
    );
  };

  const handleResolutionChange = (modelId: string, width: number, height: number) => {
    // Store resolution override for this specific model
    setModelResolutions(prev => ({
      ...prev,
      [modelId]: { width, height }
    }));
    
    // Apply resolution override to the specific model's optimized prompt
    setOptimizedPrompts(prev =>
      prev.map(p =>
        p.modelId === modelId
          ? {
              ...p,
              parameters: {
                ...p.parameters,
                width,
                height,
              }
            }
          : p
      )
    );
  };

  const handleOptimizationConfirm = async () => {
    setCurrentStep('generation');
    setLastValidOptimizedPrompts(optimizedPrompts); // Preserve edited prompts

    try {
      const result = await generateMutation.mutateAsync(optimizedPrompts);
      setGenerationResults(result.results);
      setCurrentStep('comparison');
      // Gallery cache is automatically invalidated by the mutation's onSuccess callback
    } catch (error) {
      console.error('Generation failed:', error);
      // Error is handled by mutation state, don't change step here
      // Optimized prompts are preserved for retry
    }
  };

  const handleStartOver = () => {
    setCurrentStep('model-selection');
    setOriginalPrompt('');
    setOptimizedPrompts([]);
    setGenerationResults([]);
  };

  const handleBackToPrompt = () => {
    setCurrentStep('prompt-input');
  };

  const handleChangeModels = () => {
    setCurrentStep('model-selection');
  };

  const handleImageClick = (result: ImageGenerationResult) => {
    console.log('Image clicked:', result.modelName);
  };

  const handleDownload = (result: ImageGenerationResult) => {
    console.log('Download:', result.modelName);
  };

  const handleCopyPrompt = (prompt: string) => {
    console.log('Copied prompt:', prompt);
  };

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

  const handleModelSelectionChange = (modelIds: string[]) => {
    setSelectedModels(modelIds);
    saveSelectionMutation.mutate(modelIds);
  };

  // Error recovery handlers
  const handleRetryOptimization = () => {
    optimizeMutation.reset();
    if (lastValidPrompt) {
      handlePromptSubmit(lastValidPrompt);
    } else {
      setCurrentStep('prompt-input');
    }
  };

  const handleRetryGeneration = () => {
    generateMutation.reset();
    if (lastValidOptimizedPrompts.length > 0) {
      handleOptimizationConfirm();
    } else {
      setCurrentStep('optimization');
    }
  };

  const handleDismissOptimizationError = () => {
    optimizeMutation.reset();
    setCurrentStep('prompt-input');
    // Preserve originalPrompt so user can edit and retry
  };

  const handleDismissGenerationError = () => {
    generateMutation.reset();
    setCurrentStep('optimization');
    // Preserve optimizedPrompts so user can edit and retry
  };

  // Global error boundary handler
  const handleGlobalError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('Global error caught:', error, errorInfo);
    // Could send to error tracking service here
  };

  const handleErrorBoundaryReset = () => {
    // Reset to safe state
    setCurrentStep('model-selection');
    optimizeMutation.reset();
    generateMutation.reset();
  };

  if (modelsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingIndicator message="Loading models..." />
      </div>
    );
  }

  if (modelsError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <ErrorDisplay error={modelsError as any} />
        </div>
      </div>
    );
  }

  const availableModels = modelsData?.models || [];

  return (
    <ErrorBoundary 
      onError={handleGlobalError}
      onReset={handleErrorBoundaryReset}
    >
      <ToastProvider>
        <div className="app-container">
        {/* Header with gradient and navigation tabs */}
        <header className="app-header">
          <h1>Bedrock Image Comparison Agent</h1>
          <p>Compare AWS Bedrock image generation models side-by-side</p>
          
          {/* Navigation Tabs */}
          <nav className="nav-tabs">
            <button
              onClick={() => handleViewChange('generate')}
              className={`nav-tab ${currentView === 'generate' ? 'active' : ''}`}
              aria-current={currentView === 'generate' ? 'page' : undefined}
            >
              Generate
            </button>
            <button
              onClick={() => handleViewChange('gallery')}
              className={`nav-tab ${currentView === 'gallery' ? 'active' : ''}`}
              aria-current={currentView === 'gallery' ? 'page' : undefined}
            >
              Gallery
            </button>
          </nav>
        </header>

        {/* Main Content */}
        <main className="app-main">
          {currentView === 'generate' && (
            <>
              {/* Step 1: Model Selection */}
              {currentStep === 'model-selection' && (
                <ErrorBoundary>
                  <section className="step-section">
                    <h2>Step 1: Select Models</h2>
                    <p>Choose the image generation models you want to compare</p>
                    
                    <ModelSelector
                      availableModels={availableModels}
                      selectedModels={selectedModels}
                      onSelectionChange={handleModelSelectionChange}
                      isLoading={modelsLoading}
                    />
                    
                    <div className="step-actions">
                      <button
                        onClick={handleContinueToPrompt}
                        className="primary-btn"
                        disabled={selectedModels.length === 0}
                      >
                        Continue to Prompt ({selectedModels.length} model{selectedModels.length !== 1 ? 's' : ''} selected)
                      </button>
                    </div>
                  </section>
                </ErrorBoundary>
              )}

              {/* Step 2: Prompt Input */}
              {currentStep === 'prompt-input' && (
                <ErrorBoundary>
                  <section className="step-section">
                    <h2>Step 2: Enter Your Prompt</h2>
                    <p>Describe the image you want to generate</p>
                    
                    <div className="selected-models-summary">
                      <span>
                        <strong>{selectedModels.length}</strong> model{selectedModels.length !== 1 ? 's' : ''} selected
                      </span>
                      <button
                        onClick={handleChangeModels}
                        className="change-models-btn"
                      >
                        Change Models
                      </button>
                    </div>
                    
                    <PromptInput
                      onSubmit={handlePromptSubmit}
                      isLoading={optimizeMutation.isPending}
                      initialValue={originalPrompt}
                    />
                  </section>
                </ErrorBoundary>
              )}

              {/* Step 3: Optimization Review */}
              {currentStep === 'optimization' && !optimizeMutation.isError && (
                <ErrorBoundary>
                  {optimizeMutation.isPending ? (
                    <div className="step-section">
                      <LoadingIndicator message="Optimizing prompts for selected models..." />
                    </div>
                  ) : optimizedPrompts.length > 0 ? (
                    <section className="step-section">
                      <h2>Step 3: Review Optimized Prompts</h2>
                      <p>Review and edit the AI-optimized prompts before generating images</p>
                      
                      <OptimizationView
                        originalPrompt={originalPrompt}
                        optimizedPrompts={optimizedPrompts}
                        onConfirm={handleOptimizationConfirm}
                        onEdit={handleOptimizationEdit}
                        onResolutionChange={handleResolutionChange}
                      />
                      
                      <div className="step-actions">
                        <button
                          onClick={handleBackToPrompt}
                          className="secondary-btn"
                        >
                          Back to Prompt
                        </button>
                      </div>
                    </section>
                  ) : null}
                </ErrorBoundary>
              )}

              {/* Optimization Error */}
              {optimizeMutation.isError && (
                <div className="step-section">
                  <ErrorDisplay 
                    error={optimizeMutation.error as any}
                    title="Prompt Optimization Failed"
                    onRetry={handleRetryOptimization}
                    onDismiss={handleDismissOptimizationError}
                  />
                  <div className="error-context">
                    <p className="error-context-label">Your prompt has been preserved:</p>
                    <div className="error-context-value">{originalPrompt}</div>
                  </div>
                </div>
              )}

              {/* Step 4: Generation and Comparison */}
              {currentStep === 'generation' && !generateMutation.isError && (
                <div className="step-section">
                  <LoadingIndicator message="Generating images with selected models..." />
                </div>
              )}

              {/* Generation Error */}
              {generateMutation.isError && (
                <div className="step-section">
                  <ErrorDisplay 
                    error={generateMutation.error as any}
                    title="Image Generation Failed"
                    onRetry={handleRetryGeneration}
                    onDismiss={handleDismissGenerationError}
                  />
                  <div className="error-context">
                    <p className="error-context-label">Your optimized prompts have been preserved. You can:</p>
                    <ul className="error-context-list">
                      <li>Click "Retry" to try generating again with the same prompts</li>
                      <li>Click "Dismiss" to go back and edit the prompts</li>
                      <li>Click "Back to Prompt" below to start over with a new prompt</li>
                    </ul>
                  </div>
                  <div className="step-actions">
                    <button
                      onClick={handleBackToPrompt}
                      className="secondary-btn"
                    >
                      Back to Prompt
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Comparison Results */}
              {currentStep === 'comparison' && generationResults.length > 0 && (
                <ErrorBoundary>
                  <section className="step-section">
                    <h2>Step 4: Compare Results</h2>
                    <p>View and compare the generated images from different models</p>
                    
                    <ComparisonView
                      originalPrompt={originalPrompt}
                      results={generationResults}
                      optimizedPrompts={optimizedPrompts}
                      onImageClick={handleImageClick}
                      onDownload={handleDownload}
                      onCopyPrompt={handleCopyPrompt}
                    />
                    
                    <div className="step-actions">
                      <button
                        onClick={handleViewInGallery}
                        className="secondary-btn"
                      >
                        View in Gallery
                      </button>
                      <button
                        onClick={handleStartOver}
                        className="primary-btn"
                      >
                        Generate New Images
                      </button>
                    </div>
                  </section>
                </ErrorBoundary>
              )}
            </>
          )}

          {currentView === 'gallery' && (
            <ErrorBoundary>
              <GalleryView 
                shouldRefresh={shouldRefreshGallery}
                onRefreshComplete={() => setShouldRefreshGallery(false)}
              />
            </ErrorBoundary>
          )}
        </main>

        {/* Footer */}
        <footer className="app-footer">
          <p>Powered by AWS Bedrock and Claude Sonnet 4.5</p>
        </footer>
        </div>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
