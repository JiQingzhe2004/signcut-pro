import React, { useState, useEffect, useCallback } from 'react';
import { ProcessedSignature, Theme } from '../types';

interface SignatureLightboxProps {
  signatures: ProcessedSignature[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
}

export const SignatureLightbox: React.FC<SignatureLightboxProps> = ({
  signatures,
  currentIndex,
  isOpen,
  onClose,
  theme
}) => {
  const isCyber = theme === 'cyberpunk';
  const [activeIndex, setActiveIndex] = useState(currentIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setActiveIndex(currentIndex);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex, isOpen]);

  // Reset zoom when changing images
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [activeIndex]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;
      // Disable body scroll
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Restore scroll position when closing
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        setActiveIndex(prev => (prev > 0 ? prev - 1 : signatures.length - 1));
      } else if (e.key === 'ArrowRight') {
        setActiveIndex(prev => (prev < signatures.length - 1 ? prev + 1 : 0));
      }
    };

    // Prevent wheel scroll on background
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [isOpen, signatures.length, onClose]);

  const handlePrevious = useCallback(() => {
    setActiveIndex(prev => (prev > 0 ? prev - 1 : signatures.length - 1));
  }, [signatures.length]);

  const handleNext = useCallback(() => {
    setActiveIndex(prev => (prev < signatures.length - 1 ? prev + 1 : 0));
  }, [signatures.length]);

  // Zoom and Pan handlers
  const handleZoomIn = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setScale(prev => Math.min(prev + 0.5, 5));
  };

  const handleZoomOut = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setScale(prev => Math.max(prev - 0.5, 0.5));
  };

  const handleResetZoom = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleImageWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    // Allow normal scroll if not zoomed? No, we want to zoom.
    if (e.ctrlKey || scale > 1 || true) { 
      // Always zoom on wheel inside the image container
      // But we removed preventDefault from passive listener? 
      // This is a React event, it's fine to call preventDefault if it's not passive. 
      // However, React 18 wheel events might be passive. 
      // Let's just adjust scale.
      const delta = e.deltaY * -0.001;
      setScale(prev => Math.min(Math.max(prev + delta, 0.5), 5));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      e.preventDefault();
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!isOpen || signatures.length === 0) return null;

  const currentSignature = signatures[activeIndex];

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex items-center justify-center ${
        isCyber 
          ? 'bg-gradient-to-br from-slate-950/95 via-black/90 to-slate-950/95' 
          : 'bg-black/70'
      } backdrop-blur-md animate-fade-in overflow-hidden`}
      onClick={onClose}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={(e) => {
        // Prevent touch scrolling on background
        if (e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
    >
      {/* Background Pattern (Cyber Theme) */}
      {isCyber && (
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.1)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
        </div>
      )}

      {/* Main Content Container */}
      <div 
        className="relative w-full h-full flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 pt-24 sm:pt-28 pb-20 sm:pb-24"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Info Bar - Moved to Top, below header */}
        <div className={`absolute top-20 sm:top-24 left-1/2 -translate-x-1/2 w-full max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 z-[10000] ${
          isCyber 
            ? 'px-4 sm:px-6 py-3 sm:py-4 bg-slate-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.2)]' 
            : 'px-4 sm:px-6 py-3 sm:py-4 bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl'
        }`}>
          {/* Left: Annotation */}
          <div className="flex-1 text-center sm:text-left">
            {currentSignature.annotation ? (
              <div className={`text-base sm:text-lg font-semibold ${
                isCyber ? 'text-cyan-400 font-mono' : 'text-slate-900 font-sans'
              }`}>
                {currentSignature.annotation}
              </div>
            ) : (
              <div className={`text-sm sm:text-base ${
                isCyber ? 'text-cyan-300/70 font-mono' : 'text-slate-500 font-sans'
              }`}>
                签名 {activeIndex + 1}
              </div>
            )}
          </div>

          {/* Right: Size & Index */}
          <div className={`flex items-center gap-4 sm:gap-6 text-xs sm:text-sm ${
            isCyber ? 'text-cyan-200/80 font-mono' : 'text-slate-600 font-sans'
          }`}>
            <div className="flex items-center gap-2">
              <span className="opacity-60">尺寸</span>
              <span className="font-bold">
                {currentSignature.width} × {currentSignature.height}px
              </span>
            </div>
            {signatures.length > 1 && (
              <>
                <div className={`h-4 w-px ${isCyber ? 'bg-cyan-500/30' : 'bg-slate-300'}`}></div>
                <div className="flex items-center gap-2">
                  <span className="opacity-60">索引</span>
                  <span className="font-bold">
                    {activeIndex + 1} / {signatures.length}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Close Button */}
        <button 
          onClick={onClose}
          className={`absolute top-20 sm:top-24 right-4 sm:right-6 p-3 rounded-full transition-all duration-300 z-[10000] group/close touch-manipulation active:scale-95 ${
            isCyber 
              ? 'bg-slate-900/80 hover:bg-slate-800/90 text-cyan-400 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]' 
              : 'bg-white/95 hover:bg-white text-slate-800 shadow-xl hover:shadow-2xl'
          }`}
        >
          <svg className="w-6 h-6 group-active/close:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {/* Navigation Buttons */}
        {signatures.length > 1 && (
          <>
            {/* Previous Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrevious();
              }}
              className={`absolute left-4 sm:left-6 md:left-8 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full transition-all duration-300 z-[10000] group/prev touch-manipulation active:scale-95 ${
                isCyber
                  ? 'bg-slate-900/80 hover:bg-slate-800/90 text-cyan-400 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]'
                  : 'bg-white/95 hover:bg-white text-slate-800 shadow-xl hover:shadow-2xl'
              }`}
            >
              <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Next Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className={`absolute right-4 sm:right-6 md:right-8 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full transition-all duration-300 z-[10000] group/next touch-manipulation active:scale-95 ${
                isCyber
                  ? 'bg-slate-900/80 hover:bg-slate-800/90 text-cyan-400 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]'
                  : 'bg-white/95 hover:bg-white text-slate-800 shadow-xl hover:shadow-2xl'
              }`}
            >
              <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Zoom Controls */}
        <div className={`absolute bottom-24 sm:bottom-32 right-4 sm:right-6 flex flex-col gap-2 z-[10000] ${
          isCyber ? 'text-cyan-400' : 'text-slate-700'
        }`}>
          <button
            onClick={handleZoomIn}
            className={`p-2 rounded-full transition-all ${
              isCyber ? 'bg-slate-900/80 border border-cyan-500/30 hover:bg-slate-800' : 'bg-white/90 shadow-lg hover:bg-white'
            }`}
            title="放大"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={handleZoomOut}
            className={`p-2 rounded-full transition-all ${
              isCyber ? 'bg-slate-900/80 border border-cyan-500/30 hover:bg-slate-800' : 'bg-white/90 shadow-lg hover:bg-white'
            }`}
            title="缩小"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={handleResetZoom}
            className={`p-2 rounded-full transition-all ${
              isCyber ? 'bg-slate-900/80 border border-cyan-500/30 hover:bg-slate-800' : 'bg-white/90 shadow-lg hover:bg-white'
            }`}
            title="重置"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Image Container - Maximized to fill available space */}
        <div 
          className="flex-1 w-full flex items-center justify-center min-h-0 overflow-hidden"
          onWheel={handleImageWheel}
        >
          <div 
            className={`relative w-full h-full max-w-[95vw] max-h-[calc(100vh-280px)] flex items-center justify-center ${
              isCyber ? 'p-4 sm:p-6' : 'p-2 sm:p-4'
            }`}
          >
            <img
              src={currentSignature.processedDataUrl}
              alt={currentSignature.annotation || `签名 ${activeIndex + 1}`}
              className={`max-w-full max-h-full w-auto h-auto object-contain select-none transition-transform duration-100 ${
                scale > 1 ? 'cursor-move' : 'cursor-default'
              }`}
              style={{
                // Fill available space while maintaining aspect ratio
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              draggable={false}
            />
            
            {/* Image Glow Effect (Cyber Theme) */}
            {isCyber && (
              <div className="absolute inset-0 -z-10 bg-gradient-radial from-cyan-500/20 via-transparent to-transparent blur-3xl pointer-events-none"></div>
            )}
          </div>
        </div>

        {/* Thumbnail Strip (if multiple signatures) - Fixed at bottom */}
        {signatures.length > 1 && (
          <div className="absolute bottom-8 sm:bottom-12 left-1/2 -translate-x-1/2 w-full max-w-4xl">
            <style>{`
              .thumbnail-scroll::-webkit-scrollbar {
                display: none;
              }
              .thumbnail-scroll {
                -ms-overflow-style: none;
                scrollbar-width: none;
              }
            `}</style>
            <div className="flex gap-2 sm:gap-3 justify-center px-2 overflow-x-auto thumbnail-scroll items-center py-2 sm:py-3">
              {signatures.map((sig, idx) => (
                <button
                  key={sig.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveIndex(idx);
                  }}
                  className={`relative flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg transition-all duration-300 touch-manipulation ${
                    idx === activeIndex
                      ? isCyber
                        ? 'ring-2 ring-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.5)] scale-110'
                        : 'ring-2 ring-blue-500 shadow-lg scale-110'
                      : isCyber
                        ? 'opacity-60 hover:opacity-80 border border-cyan-500/20'
                        : 'opacity-60 hover:opacity-80 border border-slate-200'
                  }`}
                  style={{
                    overflow: idx === activeIndex ? 'visible' : 'hidden',
                  }}
                >
                  <div className="w-full h-full rounded-lg overflow-hidden">
                    <img
                      src={sig.processedDataUrl}
                      alt={sig.annotation || `签名 ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {idx === activeIndex && (
                      <div className={`absolute inset-0 ${
                        isCyber ? 'bg-cyan-400/20' : 'bg-blue-500/20'
                      }`}></div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

