import { useState, useEffect } from 'react';

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
  initialValue?: string;
}

const PromptInput: React.FC<PromptInputProps> = ({ onSubmit, isLoading, initialValue = '' }) => {
  const [prompt, setPrompt] = useState(initialValue);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  // Update prompt when initialValue changes (for error recovery)
  useEffect(() => {
    if (initialValue && initialValue !== prompt) {
      setPrompt(initialValue);
    }
  }, [initialValue]);

  const MAX_RECOMMENDED_LENGTH = 1000;
  const MIN_LENGTH = 10;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate prompt
    const trimmedPrompt = prompt.trim();
    
    if (!trimmedPrompt) {
      setError('Please enter a prompt to generate images');
      setTouched(true);
      return;
    }
    
    if (trimmedPrompt.length < MIN_LENGTH) {
      setError(`Prompt is too short. Please provide at least ${MIN_LENGTH} characters for better results`);
      setTouched(true);
      return;
    }
    
    setError('');
    onSubmit(trimmedPrompt);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    
    // Clear error when user starts typing
    if (error && touched) {
      setError('');
    }
  };

  const handleBlur = () => {
    setTouched(true);
    
    // Validate on blur if there's content
    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt && trimmedPrompt.length < MIN_LENGTH) {
      setError(`Prompt should be at least ${MIN_LENGTH} characters for better results`);
    }
  };

  const getCharacterCountClass = () => {
    if (prompt.length === 0) return 'character-count';
    if (prompt.length < MIN_LENGTH) return 'character-count warning';
    if (prompt.length > MAX_RECOMMENDED_LENGTH) return 'character-count warning';
    return 'character-count success';
  };

  const getCharacterCountMessage = () => {
    const count = prompt.length;
    
    if (count === 0) {
      return `${count} characters`;
    }
    
    if (count < MIN_LENGTH) {
      return `${count} characters (minimum ${MIN_LENGTH})`;
    }
    
    if (count > MAX_RECOMMENDED_LENGTH) {
      return `${count} characters (very long - consider shortening)`;
    }
    
    return `${count} characters`;
  };

  return (
    <div className="prompt-input">
      <form onSubmit={handleSubmit} noValidate>
        <div className="prompt-input-container">
          <label htmlFor="prompt-textarea" className="prompt-label">
            Describe the image you want to generate
          </label>
          <textarea
            id="prompt-textarea"
            value={prompt}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Example: A serene mountain landscape at sunset with snow-capped peaks reflecting in a crystal-clear alpine lake, surrounded by pine trees and wildflowers..."
            rows={6}
            className={`prompt-textarea ${error && touched ? 'error' : ''} ${prompt.length >= MIN_LENGTH && prompt.length <= MAX_RECOMMENDED_LENGTH ? 'valid' : ''}`}
            disabled={isLoading}
            aria-invalid={!!(error && touched)}
            aria-describedby={error && touched ? 'prompt-error prompt-hint' : 'prompt-hint'}
            aria-required="true"
          />
          
          <div className="prompt-input-footer">
            <span 
              className={getCharacterCountClass()}
              aria-live="polite"
              aria-atomic="true"
            >
              {getCharacterCountMessage()}
            </span>
            
            {error && touched && (
              <span id="prompt-error" className="error-message" role="alert">
                {error}
              </span>
            )}
          </div>
          
          <p id="prompt-hint" className="prompt-hint">
            Provide a detailed description for best results. The AI will optimize your prompt for each selected model.
          </p>
        </div>
        
        <button
          type="submit"
          disabled={!prompt.trim() || isLoading}
          className="submit-button primary-btn"
          aria-busy={isLoading}
        >
          {isLoading && <span className="spinner" aria-hidden="true"></span>}
          {isLoading ? 'Optimizing Prompts...' : 'Continue to Optimization'}
        </button>
      </form>
    </div>
  );
};

export default PromptInput;
