import { useState } from 'react';
import { ImageGenerationResult } from '@shared/types';

interface ImageResultCardProps {
  result: ImageGenerationResult;
  optimizedPrompt: string;
  onImageClick: () => void;
  onDownload: () => void;
  onCopyPrompt: () => void;
}

const ImageResultCard: React.FC<ImageResultCardProps> = ({
  result,
  optimizedPrompt,
  onImageClick,
  onDownload,
  onCopyPrompt,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopyPrompt();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!result.success) {
    return (
      <div className="bg-white border border-[#dee2e6] rounded-lg p-4 shadow-sm">
        <div className="aspect-square bg-[#f8f9fa] rounded-lg flex items-center justify-center mb-3">
          <p className="text-sm text-[#6c757d]">Generation failed</p>
        </div>
        <p className="text-sm font-medium text-[#212529]">{result.modelName}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-[#e2e8f0] rounded-xl overflow-hidden shadow-xl card-3d hover:border-[#3b82f6] transition-all">
      <div 
        className="relative cursor-pointer group image-container"
        onClick={onImageClick}
      >
        {result.imageBase64 && (
          <img
            src={`data:image/${result.imageFormat || 'png'};base64,${result.imageBase64}`}
            alt={result.modelName}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end justify-center pb-6 gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            className="px-5 py-2.5 bg-white text-[#1a202c] rounded-lg hover:bg-[#f8fafc] font-bold text-sm shadow-2xl transform hover:scale-105 transition-all"
          >
            Download
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            className="px-5 py-2.5 bg-[#3b82f6] text-white rounded-lg hover:bg-[#2563eb] font-bold text-sm shadow-2xl transform hover:scale-105 transition-all"
          >
            {copied ? '✓ Copied!' : 'Copy Prompt'}
          </button>
        </div>
      </div>
      
      <div className="p-5">
        <div className="mb-4">
          <h3 className="font-black text-[#1a202c] mb-3 text-lg text-3d">{result.modelName}</h3>
          
          {/* Generation Stats */}
          <div className="flex items-center gap-4 mb-3">
            <div className="px-3 py-1.5 bg-[#dbeafe] rounded-lg">
              <span className="text-[#718096] font-medium text-xs">Time:</span>
              <span className="ml-1 text-[#1a202c] font-bold text-xs">{(result.generationTime / 1000).toFixed(1)}s</span>
            </div>
            {result.resolution && (
              <div className="px-3 py-1.5 bg-[#dbeafe] rounded-lg">
                <span className="text-[#718096] font-medium text-xs">Size:</span>
                <span className="ml-1 text-[#1a202c] font-bold text-xs">{result.resolution.width}×{result.resolution.height}</span>
              </div>
            )}
          </div>
          
          {/* Region Badge */}
          <div className="inline-block px-4 py-2 bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-white rounded-lg text-xs font-black shadow-lg text-3d-white">
            📍 {result.region}
          </div>
        </div>
        
        {optimizedPrompt && (
          <details className="mt-4 group/details">
            <summary className="cursor-pointer text-xs text-[#3b82f6] hover:text-[#2563eb] font-bold list-none">
              <span className="inline-block transform group-open/details:rotate-90 transition-transform">▸</span> View optimized prompt
            </summary>
            <p className="mt-3 text-xs text-[#718096] leading-relaxed bg-gradient-to-br from-[#f8fafc] to-[#f1f5f9] p-4 rounded-xl border-2 border-[#e2e8f0]">{optimizedPrompt}</p>
          </details>
        )}
      </div>
    </div>
  );
};

export default ImageResultCard;
