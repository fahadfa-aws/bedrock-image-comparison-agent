import React from 'react';
import { ModelInfo } from '@shared/types';

interface ModelSelectorProps {
  availableModels: ModelInfo[];
  selectedModels: string[];
  onSelectionChange: (modelIds: string[]) => void;
  isLoading?: boolean;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  availableModels,
  selectedModels,
  onSelectionChange,
  isLoading = false,
}) => {
  const handleToggleModel = (modelId: string) => {
    const isSelected = selectedModels.includes(modelId);
    let newSelection: string[];

    if (isSelected) {
      // Allow deselection only if more than 2 models are selected
      if (selectedModels.length > 2) {
        newSelection = selectedModels.filter(id => id !== modelId);
      } else {
        return;
      }
    } else {
      // Allow selection only if less than 6 models are selected
      if (selectedModels.length < 6) {
        newSelection = [...selectedModels, modelId];
      } else {
        return;
      }
    }

    onSelectionChange(newSelection);
  };

  if (isLoading) {
    return (
      <div className="model-selector loading">
        <p>Loading available models...</p>
      </div>
    );
  }

  return (
    <div className="model-selector">
      <div className="model-selector-info">
        <p className="model-selector-instructions">
          Choose 2-6 models to compare. Click on a model card to select or deselect it.
        </p>
        <div className="model-selector-count">
          <span className="count-badge">
            {selectedModels.length} of 6 models selected
          </span>
        </div>
      </div>

      <div className="model-grid">
        {availableModels.map((model) => {
          const isSelected = selectedModels.includes(model.modelId);
          const isDisabled = !isSelected && selectedModels.length >= 6;

          return (
            <button
              key={model.modelId}
              onClick={() => handleToggleModel(model.modelId)}
              disabled={isDisabled}
              className={`model-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
              aria-pressed={isSelected}
              aria-label={`${model.modelName} - ${isSelected ? 'Selected' : 'Not selected'}`}
            >
              <div className="model-card-header">
                <div className="model-checkbox">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    disabled={isDisabled}
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                </div>
                <div className="model-info">
                  <h3 className="model-name">{model.modelName}</h3>
                  <p className="model-provider">{model.provider}</p>
                  <p className="model-id">{model.modelId}</p>
                </div>
              </div>

              <div className="model-details">
                <div className="detail-item">
                  <span className="detail-label">Region:</span>
                  <span className="detail-value region-badge">{model.region}</span>
                </div>
                <div className="detail-item pricing">
                  <span className="detail-label">Price per image:</span>
                  <span className="detail-value price">${model.pricing.perImage.toFixed(3)}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {availableModels.length === 0 && (
        <div className="no-models">
          <p>No image models available. Please check your configuration.</p>
        </div>
      )}

      {selectedModels.length < 2 && availableModels.length > 0 && (
        <div className="model-selector-warning">
          <span className="warning-icon">⚠️</span>
          <p>Please select at least 2 models to continue</p>
        </div>
      )}

      {selectedModels.length >= 6 && (
        <div className="model-selector-info-message">
          <span className="info-icon">ℹ️</span>
          <p>Maximum of 6 models selected. Deselect a model to choose a different one.</p>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
