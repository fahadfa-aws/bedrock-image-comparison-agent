import { useState } from 'react';
import { OptimizedPrompt } from '@shared/types';

interface OptimizationViewProps {
  originalPrompt: string;
  optimizedPrompts: OptimizedPrompt[];
  onConfirm: () => void;
  onEdit: (modelId: string, newPrompt: string) => void;
  onResolutionChange?: (modelId: string, width: number, height: number) => void;
}

// Resolution presets organized by category
const RESOLUTION_PRESETS = [
  // Square formats
  { label: '512x512 - Fast & Economical', width: 512, height: 512, category: 'square' },
  { label: '768x768 - Good Balance', width: 768, height: 768, category: 'square' },
  { label: '1024x1024 - Standard Quality', width: 1024, height: 1024, category: 'square' },
  { label: '1536x1536 - High Quality (Ultra/Core)', width: 1536, height: 1536, category: 'square' },
  { label: '2048x2048 - Maximum (Nova Canvas)', width: 2048, height: 2048, category: 'square' },
  
  // Landscape formats
  { label: '1024x768 - Landscape 4:3', width: 1024, height: 768, category: 'landscape' },
  { label: '1280x720 - HD 720p (16:9)', width: 1280, height: 720, category: 'landscape' },
  { label: '1536x864 - HD+ (16:9)', width: 1536, height: 864, category: 'landscape' },
  { label: '1920x1080 - Full HD (16:9)', width: 1920, height: 1080, category: 'landscape' },
  
  // Portrait formats
  { label: '768x1024 - Portrait 3:4', width: 768, height: 1024, category: 'portrait' },
  { label: '720x1280 - Portrait HD (9:16)', width: 720, height: 1280, category: 'portrait' },
  { label: '864x1536 - Portrait HD+ (9:16)', width: 864, height: 1536, category: 'portrait' },
  { label: '1080x1920 - Portrait Full HD (9:16)', width: 1080, height: 1920, category: 'portrait' },
];

const OptimizationView: React.FC<OptimizationViewProps> = ({
  originalPrompt,
  optimizedPrompts,
  onConfirm,
  onEdit,
  onResolutionChange,
}) => {
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editedPrompt, setEditedPrompt] = useState('');
  // Track resolution selection per model
  const [modelResolutions, setModelResolutions] = useState<Record<string, string>>({});

  const handleStartEdit = (modelId: string, currentPrompt: string) => {
    setEditingModelId(modelId);
    setEditedPrompt(currentPrompt);
  };

  const handleSaveEdit = (modelId: string) => {
    if (editedPrompt.trim()) {
      onEdit(modelId, editedPrompt.trim());
    }
    setEditingModelId(null);
    setEditedPrompt('');
  };

  const handleResolutionChange = (modelId: string, value: string) => {
    setModelResolutions(prev => ({ ...prev, [modelId]: value }));
    
    if (value !== 'default' && onResolutionChange) {
      const preset = RESOLUTION_PRESETS.find(p => `${p.width}x${p.height}` === value);
      if (preset) {
        onResolutionChange(modelId, preset.width, preset.height);
      }
    }
  };

  return (
    <div className="optimization-content">
      <div className="original-prompt-card">
        <h3 className="original-prompt-label">Your Original Prompt</h3>
        <p className="original-prompt-text">{originalPrompt}</p>
      </div>

      <div className="optimized-prompts-container">
        <div className="optimized-prompts-list">
          {optimizedPrompts.map((optimized) => {
            const isEditing = editingModelId === optimized.modelId;
            const currentResolution = modelResolutions[optimized.modelId] || 'default';

            return (
              <div key={optimized.modelId} className="optimized-prompt-card">
                <div className="prompt-card-header">
                  <span className="model-name">{optimized.modelName}</span>
                  {!isEditing && (
                    <button
                      onClick={() => handleStartEdit(optimized.modelId, optimized.optimizedPrompt)}
                      className="edit-btn"
                    >
                      Edit Prompt
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="edit-mode">
                    <textarea
                      value={editedPrompt}
                      onChange={(e) => setEditedPrompt(e.target.value)}
                      rows={4}
                      className="edit-textarea"
                      autoFocus
                    />
                    <div className="edit-actions">
                      <button
                        onClick={() => handleSaveEdit(optimized.modelId)}
                        className="primary-btn"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingModelId(null)}
                        className="secondary-btn"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="prompt-text">{optimized.optimizedPrompt}</p>
                    {optimized.reasoning && (
                      <div className="reasoning-section">
                        <h4 className="reasoning-label">Optimization Reasoning:</h4>
                        <p className="reasoning-text">{optimized.reasoning}</p>
                      </div>
                    )}
                    
                    {/* Per-model Resolution Selector */}
                    {onResolutionChange && (
                      <div className="model-resolution-selector">
                        <label className="resolution-label-small">
                          Resolution (Optional):
                        </label>
                        <select 
                          value={currentResolution} 
                          onChange={(e) => handleResolutionChange(optimized.modelId, e.target.value)}
                          className="resolution-select-small"
                        >
                          <option value="default">Use Claude's Choice</option>
                          
                          <optgroup label="Square">
                            {RESOLUTION_PRESETS.filter(p => p.category === 'square').map(preset => (
                              <option key={`${optimized.modelId}-${preset.width}x${preset.height}`} value={`${preset.width}x${preset.height}`}>
                                {preset.label}
                              </option>
                            ))}
                          </optgroup>
                          
                          <optgroup label="Landscape">
                            {RESOLUTION_PRESETS.filter(p => p.category === 'landscape').map(preset => (
                              <option key={`${optimized.modelId}-${preset.width}x${preset.height}`} value={`${preset.width}x${preset.height}`}>
                                {preset.label}
                              </option>
                            ))}
                          </optgroup>
                          
                          <optgroup label="Portrait">
                            {RESOLUTION_PRESETS.filter(p => p.category === 'portrait').map(preset => (
                              <option key={`${optimized.modelId}-${preset.width}x${preset.height}`} value={`${preset.width}x${preset.height}`}>
                                {preset.label}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                        <p className="resolution-hint-small">
                          <small>Dimensions will be adjusted if needed for this model's limits.</small>
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={onConfirm}
          disabled={editingModelId !== null}
          className="primary-btn generate-btn"
        >
          {editingModelId ? 'Save your edits first' : 'Generate Images'}
        </button>
      </div>
    </div>
  );
};

export default OptimizationView;
