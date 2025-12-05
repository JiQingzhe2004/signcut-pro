import React from 'react';
import { ProcessedSignature, Theme } from '../types';
import { Button } from './Button';
import { ZoomIn, Download } from 'lucide-react';

interface SignatureCardProps {
  signature: ProcessedSignature;
  index: number;
  onUpdateAnnotation: (id: string, text: string) => void;
  onPreview: (index: number) => void;
  theme: Theme;
  isUpdating?: boolean;
}

export const SignatureCard: React.FC<SignatureCardProps> = ({ 
  signature, 
  index, 
  onUpdateAnnotation,
  onPreview,
  theme,
  isUpdating = false
}) => {
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
    ? "bg-slate-900/0 backdrop-blur-md rounded-3xl border border-slate-800/50 hover:border-cyan-500/30 transition-all duration-500 group relative overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]"
    : "bg-white/0 backdrop-blur-xl rounded-[2rem] border border-white/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group shadow-lg shadow-slate-200/50 overflow-hidden";

  const headerClasses = isCyber
    ? "px-5 py-4 bg-white/0 border-b border-white/5 flex justify-between items-center rounded-t-[inherit] backdrop-blur-sm"
    : "px-6 py-4 border-b border-slate-100/50 flex justify-between items-center bg-white/0 rounded-t-[inherit]";

  const indexClasses = isCyber
    ? "text-sm font-mono text-cyan-400 font-bold tracking-wider drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]"
    : "text-sm font-sans text-slate-900 font-bold";

  const badgeClasses = isCyber
    ? "text-[10px] text-cyan-200/70 font-mono border border-cyan-500/20 px-2 py-1 rounded-lg bg-cyan-950/30"
    : "text-[10px] text-slate-500 font-sans bg-slate-100 px-2 py-1 rounded-full";

  const imageContainerClasses = isCyber
    ? "relative p-8 flex-1 flex items-center justify-center bg-transparent cursor-pointer overflow-hidden"
    : "relative p-8 flex-1 flex items-center justify-center bg-transparent cursor-pointer overflow-hidden";

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
        <div className={`${imageContainerClasses} touch-manipulation`} onClick={() => onPreview(index)} title="点击预览大图">
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
            className={`max-w-full h-auto bg-white relative z-0 transition-all duration-300 transform group-hover:scale-105 ${isUpdating ? 'opacity-80' : 'opacity-100'} ${isCyber ? 'border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)] rounded-lg' : 'rounded-xl shadow-sm'}`}
            style={{ 
              aspectRatio: `${signature.width}/${signature.height}`
            }}
          />
          
          {/* Hover Hint - 确保在图片上层 */}
          <div className={`absolute bottom-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`}>
            <div className={`p-1.5 rounded-full ${isCyber ? 'bg-cyan-500/20 text-cyan-400 backdrop-blur' : 'bg-black/10 text-slate-600 backdrop-blur'}`}>
               <ZoomIn className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Annotation Input */}
        <div className={`px-4 sm:px-5 z-10 relative`}>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={signature.annotation || ''} 
              onChange={(e) => onUpdateAnnotation(signature.id, e.target.value)}
              placeholder="添加备注名称..." 
              className={`${inputClasses} text-sm sm:text-base`}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 sm:p-5 mt-auto z-10 relative">
          <Button onClick={handleDownload} className="w-full text-xs sm:text-sm py-2.5 sm:py-3 touch-manipulation" theme={theme} variant={downloadBtnVariant}>
            <Download className="w-4 h-4 mr-1" />
            {isCyber ? '下载数据 / DOWNLOAD' : '保存图片'}
          </Button>
        </div>
      </div>

    </>
  );
};
