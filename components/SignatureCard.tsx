import React, { useState } from 'react';
import { ProcessedSignature, Theme } from '../types';
import { Button } from './Button';

interface SignatureCardProps {
  signature: ProcessedSignature;
  index: number;
  onUpdateAnnotation: (id: string, text: string) => void;
  theme: Theme;
  isUpdating?: boolean;
}

export const SignatureCard: React.FC<SignatureCardProps> = ({ 
  signature, 
  index, 
  onUpdateAnnotation,
  theme,
  isUpdating = false
}) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const isCyber = theme === 'cyberpunk';

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = signature.processedDataUrl;
    const name = signature.annotation ? signature.annotation : `签名_${index + 1}`;
    link.download = `电子签名_${name}_${signature.width}x${signature.height}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Theme Styles
  const containerClasses = isCyber
    ? "bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-900/60 backdrop-blur-2xl rounded-3xl border border-white/10 hover:border-cyan-500/30 transition-all duration-500 group relative overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]"
    : "bg-white/60 backdrop-blur-xl rounded-[2rem] border border-white/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group shadow-lg shadow-slate-200/50 overflow-hidden";

  const headerClasses = isCyber
    ? "px-5 py-4 bg-white/5 border-b border-white/5 flex justify-between items-center rounded-t-[inherit] backdrop-blur-sm"
    : "px-6 py-4 border-b border-slate-100/50 flex justify-between items-center bg-white/40 rounded-t-[inherit]";

  const indexClasses = isCyber
    ? "text-sm font-mono text-cyan-400 font-bold tracking-wider drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]"
    : "text-sm font-sans text-slate-900 font-bold";

  const badgeClasses = isCyber
    ? "text-[10px] text-cyan-200/70 font-mono border border-cyan-500/20 px-2 py-1 rounded-lg bg-cyan-950/30"
    : "text-[10px] text-slate-500 font-sans bg-slate-100 px-2 py-1 rounded-full";

  const imageContainerClasses = isCyber
    ? "relative p-8 flex-1 flex items-center justify-center bg-black/20 cursor-pointer overflow-hidden"
    : "relative p-8 flex-1 flex items-center justify-center bg-slate-50/50 cursor-pointer overflow-hidden";

  const inputClasses = isCyber
    ? "flex-1 text-sm px-4 py-3 bg-black/20 border border-white/10 text-cyan-50 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all placeholder:text-slate-500 font-mono rounded-xl backdrop-blur-md"
    : "flex-1 text-sm px-4 py-3 bg-slate-100/50 border border-transparent text-slate-800 focus:outline-none focus:bg-white focus:shadow-inner transition-all placeholder:text-slate-400 font-sans rounded-2xl";

  const downloadBtnVariant = isCyber ? 'primary' : 'secondary';

  return (
    <>
      <div className={containerClasses}>
        {/* Cyber Liquid Sheen & Decor */}
        {isCyber && (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/40 pointer-events-none"></div>
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent opacity-50"></div>
            <div className="absolute -inset-full top-0 block h-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-10 group-hover:animate-shine" />
          </>
        )}

        {/* Header */}
        <div className={headerClasses}>
          <span className={indexClasses}>编号 {String(index + 1).padStart(2, '0')}</span>
          <span className={badgeClasses}>
            {signature.width} × {signature.height}
          </span>
        </div>

        {/* Image Display */}
        <div className={imageContainerClasses} onClick={() => setIsPreviewOpen(true)} title="点击预览大图">
           {isCyber && (
             <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-900/20 to-transparent pointer-events-none"></div>
           )}
           
           {/* Loading Overlay */}
           {isUpdating && (
             <div className="absolute inset-0 z-20 flex items-center justify-center backdrop-blur-[2px] bg-white/10 rounded-lg transition-all">
               <div className={`w-8 h-8 border-2 rounded-full animate-spin ${isCyber ? 'border-cyan-500 border-t-transparent' : 'border-blue-500 border-t-transparent'}`}></div>
             </div>
           )}

           <img 
            src={signature.processedDataUrl} 
            alt={`Signature ${index + 1}`}
            className={`max-w-full h-auto bg-white z-10 transition-all duration-300 transform group-hover:scale-105 ${isUpdating ? 'opacity-80' : 'opacity-100'} ${isCyber ? 'border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)] rounded-lg' : 'rounded-xl shadow-sm'}`}
            style={{ 
              aspectRatio: `${signature.width}/${signature.height}`
            }}
          />
          
          {/* Hover Hint */}
          <div className={`absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`}>
            <div className={`p-1.5 rounded-full ${isCyber ? 'bg-cyan-500/20 text-cyan-400 backdrop-blur' : 'bg-black/10 text-slate-600 backdrop-blur'}`}>
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
               </svg>
            </div>
          </div>
        </div>

        {/* Annotation Input */}
        <div className={`px-5 pt-4 z-10 relative ${isCyber ? 'border-t border-white/5' : 'border-t border-slate-100/50'}`}>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={signature.annotation || ''} 
              onChange={(e) => onUpdateAnnotation(signature.id, e.target.value)}
              placeholder="添加备注名称..." 
              className={inputClasses}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="p-5 mt-auto z-10 relative">
          <Button onClick={handleDownload} className="w-full text-xs" theme={theme} variant={downloadBtnVariant}>
            {isCyber ? '下载数据 / DOWNLOAD' : '保存图片'}
          </Button>
        </div>
      </div>

      {/* Full Screen Preview Modal */}
      {isPreviewOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in cursor-zoom-out"
          onClick={(e) => {
            e.stopPropagation();
            setIsPreviewOpen(false);
          }}
        >
          {/* Close Button */}
          <button 
            onClick={() => setIsPreviewOpen(false)}
            className="absolute top-8 right-8 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all z-[101] group/close"
          >
            <svg className="w-8 h-8 group-hover/close:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Image Container */}
          <div 
            className="relative max-w-[90vw] max-h-[85vh] p-1"
            onClick={(e) => e.stopPropagation()} 
          >
            <img 
              src={signature.processedDataUrl} 
              alt="Full Preview" 
              className={`max-w-full max-h-[80vh] object-contain select-none shadow-2xl ${isCyber ? 'drop-shadow-[0_0_50px_rgba(6,182,212,0.3)]' : 'drop-shadow-[0_0_50px_rgba(255,255,255,0.3)]'}`}
            />
            {signature.annotation && (
               <div className={`mt-6 text-center`}>
                  <span className={`inline-block px-6 py-2 rounded-full backdrop-blur-md font-medium text-lg tracking-wide border ${isCyber ? 'bg-cyan-950/50 border-cyan-500/30 text-cyan-400 font-mono' : 'bg-white/20 border-white/20 text-white font-sans'}`}>
                    {signature.annotation}
                  </span>
               </div>
            )}
            <div className={`mt-4 text-center text-xs opacity-50 ${isCyber ? 'text-cyan-200 font-mono' : 'text-white font-sans'}`}>
               {signature.width}px × {signature.height}px
            </div>
          </div>
        </div>
      )}
    </>
  );
};
