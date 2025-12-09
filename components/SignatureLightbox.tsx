import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ProcessedSignature, Theme } from '../types';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

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
  const thumbnailScrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

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

  // Check if thumbnail scroll is needed and auto-scroll to active image
  useEffect(() => {
    const checkScroll = () => {
      if (thumbnailScrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = thumbnailScrollRef.current;
        const isScrollable = scrollWidth > clientWidth;
        setShowLeftArrow(isScrollable && scrollLeft > 0);
        setShowRightArrow(isScrollable && scrollLeft < scrollWidth - clientWidth - 10);
      }
    };

    // Use a small delay to ensure DOM is fully rendered
    const timer = setTimeout(checkScroll, 100);
    const scrollElement = thumbnailScrollRef.current;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => {
        clearTimeout(timer);
        scrollElement.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
    return () => clearTimeout(timer);
  }, [signatures.length, isOpen]);

  // Auto-scroll to active thumbnail
  useEffect(() => {
    if (thumbnailScrollRef.current) {
      const activeButton = thumbnailScrollRef.current.querySelector(`button:nth-child(${activeIndex + 1})`);
      if (activeButton) {
        const { scrollLeft, clientWidth, scrollWidth } = thumbnailScrollRef.current;
        const { offsetLeft, offsetWidth } = activeButton as HTMLElement;
        
        // If it's the last image, scroll to show it on the right
        if (activeIndex === signatures.length - 1) {
          thumbnailScrollRef.current.scrollTo({
            left: scrollWidth - clientWidth,
            behavior: 'smooth'
          });
        } else if (offsetLeft < scrollLeft) {
          // If image is off the left, scroll left
          thumbnailScrollRef.current.scrollTo({
            left: Math.max(0, offsetLeft - 16),
            behavior: 'smooth'
          });
        } else if (offsetLeft + offsetWidth > scrollLeft + clientWidth) {
          // If image is off the right, scroll right
          thumbnailScrollRef.current.scrollTo({
            left: offsetLeft + offsetWidth - clientWidth + 16,
            behavior: 'smooth'
          });
        }
        
        // Update arrow visibility after scroll
        setTimeout(() => {
          if (thumbnailScrollRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = thumbnailScrollRef.current;
            const isScrollable = scrollWidth > clientWidth;
            setShowLeftArrow(isScrollable && scrollLeft > 0);
            setShowRightArrow(isScrollable && scrollLeft < scrollWidth - clientWidth - 10);
          }
        }, 100);
      }
    }
  }, [activeIndex, signatures.length]);

  // Scroll thumbnail strip
  const scrollThumbnails = (direction: 'left' | 'right') => {
    if (thumbnailScrollRef.current) {
      const scrollAmount = 200;
      const newScrollLeft = thumbnailScrollRef.current.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);
      thumbnailScrollRef.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      });
    }
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
        className="relative w-full h-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Info Bar & Close Button Wrapper */}
        <div className="absolute top-4 sm:top-6 left-1/2 -translate-x-1/2 w-full max-w-4xl z-[10000] px-4 flex items-stretch gap-3">
        {/* Info Bar - Moved to Top, below header */}
        <div className={`flex-1 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 ${
          isCyber 
            ? 'px-6 sm:px-8 py-3 sm:py-4 bg-slate-900/60 backdrop-blur-2xl border border-cyan-500/20 rounded-full shadow-[0_0_30px_rgba(6,182,212,0.2)]' 
            : 'px-6 sm:px-8 py-3 sm:py-4 bg-white/60 backdrop-blur-2xl rounded-full shadow-xl'
        }`}>
          {/* Left: Annotation */}
          <div className="flex-1 text-center sm:text-left">
          {currentSignature.annotation ? (
              <div className={`text-base sm:text-lg font-semibold ${
                isCyber ? 'text-white font-mono' : 'text-slate-900 font-sans'
              }`}>
                {currentSignature.annotation}
              </div>
            ) : (
              <div className={`text-sm sm:text-base ${
                isCyber ? 'text-cyan-200 font-mono' : 'text-slate-800 font-sans'
              }`}>
                签名 {activeIndex + 1}
              </div>
            )}
          </div>

          {/* Right: Size & Index */}
          <div className={`flex items-center gap-4 sm:gap-6 text-xs sm:text-sm ${
            isCyber ? 'text-white font-mono' : 'text-slate-900 font-sans'
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

        {/* Close Button - Attached to right */}
        <button 
          onClick={onClose}
          className={`w-10 h-10 sm:w-14 sm:h-14 flex-shrink-0 flex items-center justify-center rounded-full transition-all duration-300 group/close touch-manipulation active:scale-95 ${
            isCyber 
              ? 'bg-slate-900/60 hover:bg-slate-800/80 text-cyan-400 border border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.2)] backdrop-blur-2xl' 
              : 'bg-white/60 hover:bg-white/80 text-slate-800 shadow-xl backdrop-blur-2xl'
          }`}
        >
          <X className="w-6 h-6 group-active/close:rotate-90 transition-transform duration-300" />
        </button>
        </div>


        {/* Navigation Buttons */}
        {signatures.length > 1 && (
          <>
            {/* Previous Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrevious();
              }}
              className={`absolute left-4 sm:left-6 md:left-8 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full transition-all duration-300 z-[10000] group/prev touch-manipulation active:scale-95 backdrop-blur-2xl ${
                isCyber
                  ? 'bg-slate-900/60 hover:bg-slate-800/80 text-cyan-400 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]'
                  : 'bg-white/60 hover:bg-white/80 text-slate-800 shadow-xl hover:shadow-2xl'
              }`}
            >
              <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>

            {/* Next Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className={`absolute right-4 sm:right-6 md:right-8 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full transition-all duration-300 z-[10000] group/next touch-manipulation active:scale-95 backdrop-blur-2xl ${
                isCyber
                  ? 'bg-slate-900/60 hover:bg-slate-800/80 text-cyan-400 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]'
                  : 'bg-white/60 hover:bg-white/80 text-slate-800 shadow-xl hover:shadow-2xl'
              }`}
            >
              <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>
          </>
        )}

        {/* Zoom Controls */}
        <div className={`absolute bottom-28 sm:bottom-36 right-4 sm:right-8 flex flex-col gap-3 z-[10000] ${
          isCyber ? 'text-cyan-400' : 'text-slate-700'
        }`}>
          <button
            onClick={handleZoomIn}
            className={`p-3 sm:p-4 rounded-full transition-all backdrop-blur-2xl ${
              isCyber ? 'bg-slate-900/60 border border-cyan-500/30 hover:bg-slate-800/80 hover:shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-white/60 shadow-lg hover:bg-white/80 hover:shadow-xl'
            }`}
            title="放大"
          >
            <ZoomIn className="w-6 h-6" />
          </button>
          <button
            onClick={handleZoomOut}
            className={`p-3 sm:p-4 rounded-full transition-all backdrop-blur-2xl ${
              isCyber ? 'bg-slate-900/60 border border-cyan-500/30 hover:bg-slate-800/80 hover:shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-white/60 shadow-lg hover:bg-white/80 hover:shadow-xl'
            }`}
            title="缩小"
          >
            <ZoomOut className="w-6 h-6" />
          </button>
          <button
            onClick={handleResetZoom}
            className={`p-3 sm:p-4 rounded-full transition-all backdrop-blur-2xl ${
              isCyber ? 'bg-slate-900/60 border border-cyan-500/30 hover:bg-slate-800/80 hover:shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-white/60 shadow-lg hover:bg-white/80 hover:shadow-xl'
            }`}
            title="重置"
          >
            <RotateCcw className="w-6 h-6" />
          </button>
        </div>

        {/* Image Container - Full Screen */}
        <div 
          className="absolute inset-0 flex items-center justify-center overflow-hidden z-0"
          onWheel={handleImageWheel}
        >
          <div 
            className="relative w-full h-full flex items-center justify-center"
          >
            <img
              src={currentSignature.processedDataUrl}
              alt={currentSignature.annotation || `签名 ${activeIndex + 1}`}
              className={`max-w-full max-h-full w-auto h-auto object-contain select-none transition-transform duration-100 ${
                scale > 1 ? 'cursor-move' : 'cursor-default'
              }`}
              style={{
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
          <div className="absolute bottom-8 sm:bottom-12 left-1/2 -translate-x-1/2 w-full max-w-4xl px-2 sm:px-0">
            <style>{`
              .thumbnail-scroll::-webkit-scrollbar {
                display: none;
              }
              .thumbnail-scroll {
                -ms-overflow-style: none;
                scrollbar-width: none;
              }
            `}</style>
            <div className="relative flex items-center justify-center">
              {/* Thumbnail Container with rounded corners */}
              <div 
                className="relative rounded-2xl overflow-hidden flex-1"
              >
                {/* Left Arrow - on border */}
                {showLeftArrow && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      scrollThumbnails('left');
                    }}
                    className={`absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full transition-all duration-300 ${
                      isCyber
                        ? 'bg-slate-900/90 hover:bg-slate-800 text-cyan-400 border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                        : 'bg-white/90 hover:bg-white text-slate-800 border border-slate-300 shadow-lg'
                    }`}
                    title="向左滚动"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}

                {/* Thumbnail Container */}
                <div 
                  ref={thumbnailScrollRef}
                  className="flex gap-2 sm:gap-3 px-8 sm:px-12 overflow-x-auto thumbnail-scroll items-center py-2 sm:py-3"
                >
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

                {/* Right Arrow - on border */}
                {showRightArrow && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      scrollThumbnails('right');
                    }}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full transition-all duration-300 ${
                      isCyber
                        ? 'bg-slate-900/90 hover:bg-slate-800 text-cyan-400 border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                        : 'bg-white/90 hover:bg-white text-slate-800 border border-slate-300 shadow-lg'
                    }`}
                    title="向右滚动"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

