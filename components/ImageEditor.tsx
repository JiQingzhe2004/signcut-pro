import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { SelectionBox, Theme } from '../types';
import { Button } from './Button';
import { Logo } from './Logo';

interface ImageEditorProps {
  imageUrl: string;
  initialBoxes: SelectionBox[];
  originalWidth: number;
  originalHeight: number;
  onConfirm: (boxes: SelectionBox[]) => void;
  onProcessWithAI: (boxes: SelectionBox[]) => void;
  onCancel: () => void;
  onBoxesChange?: (boxes: SelectionBox[]) => void;
  theme: Theme;
}

type InteractionMode = 'IDLE' | 'DRAWING' | 'MOVING' | 'RESIZING' | 'ROTATING';
type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export const ImageEditor: React.FC<ImageEditorProps> = ({
  imageUrl,
  initialBoxes,
  originalWidth,
  originalHeight,
  onConfirm,
  onProcessWithAI,
  onCancel,
  onBoxesChange,
  theme
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  
  // State
  const [boxes, setBoxes] = useState<SelectionBox[]>(initialBoxes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<InteractionMode>('IDLE');
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef(pan);

  // Keep refs in sync
  useEffect(() => {
    panRef.current = pan;
    zoomRef.current = zoom;
  }, [pan, zoom]);

  // Sync boxes to parent
  useEffect(() => {
    if (onBoxesChange) {
      onBoxesChange(boxes);
    }
  }, [boxes, onBoxesChange]);

  // Interaction State
  const [startPoint, setStartPoint] = useState<{ x: number, y: number } | null>(null);
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [startRotation, setStartRotation] = useState<number>(0);
  
  // Temp state for drawing/modifying
  const [tempBox, setTempBox] = useState<SelectionBox | null>(null);
  const [initialBoxSnapshot, setInitialBoxSnapshot] = useState<SelectionBox | null>(null);

  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{x: number, y: number, initialPanX: number, initialPanY: number} | null>(null);

  const isCyber = theme === 'cyberpunk';
  const SNAP_THRESHOLD = 20;

  // Initialize zoom to fit
  useEffect(() => {
    if (viewportRef.current && originalWidth && originalHeight) {
      // Use the viewport dimensions directly (it fills the screen minus toolbars now)
      const viewportWidth = viewportRef.current.clientWidth; 
      const viewportHeight = viewportRef.current.clientHeight; 
      
      const scaleX = (viewportWidth - 40) / originalWidth;
      const scaleY = (viewportHeight - 160) / originalHeight; // Account for toolbar space
      
      // Initial fit zoom
      const fitZoom = Math.min(scaleX, scaleY, 1);
      
      // Center the image
      const centerX = (viewportWidth - originalWidth * fitZoom) / 2;
      const centerY = (viewportHeight - originalHeight * fitZoom) / 2;

      setZoom(fitZoom);
      setPan({ x: centerX, y: centerY });
    }
  }, [originalWidth, originalHeight]);

  // --- Helpers ---

  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

  // Convert Mouse/Touch Event to Image Coordinates
  const getRelativeCoords = (e: React.MouseEvent | MouseEvent | React.TouchEvent | TouchEvent) => {
    if (!viewportRef.current) return { x: 0, y: 0 };
    const rect = viewportRef.current.getBoundingClientRect();
    
    let clientX: number, clientY: number;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    // Calculate coordinates relative to the viewport
    const viewportX = clientX - rect.left;
    const viewportY = clientY - rect.top;

    // Convert to image coordinates using current transform
    // Formula: imageX = (viewportX - panX) / zoom
    const x = (viewportX - panRef.current.x) / zoomRef.current;
    const y = (viewportY - panRef.current.y) / zoomRef.current;

    return { 
      x: clamp(x, 0, originalWidth), 
      y: clamp(y, 0, originalHeight) 
    };
  };

  // Handle Wheel Zoom (Map-like)
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;
      
      const delta = Math.max(Math.min(e.deltaY, 50), -50);
      
      const ZOOM_SPEED = 0.0008; 
      const zoomFactor = Math.exp(-delta * ZOOM_SPEED);
      
      const safeZoomFactor = Math.max(Math.min(zoomFactor, 1.05), 0.95);
      
      const newZoom = Math.min(Math.max(currentZoom * safeZoomFactor, 0.1), 20);

      if (Math.abs(newZoom - currentZoom) < 0.0001) return;

      // Calculate cursor position relative to the viewport
      const viewportRect = viewport.getBoundingClientRect();
      const cursorX = e.clientX - viewportRect.left;
      const cursorY = e.clientY - viewportRect.top;

      // Calculate the point on the image that is currently under the cursor
      // cursorX = panX + imagePointX * currentZoom
      // imagePointX = (cursorX - panX) / currentZoom
      const imagePointX = (cursorX - currentPan.x) / currentZoom;
      const imagePointY = (cursorY - currentPan.y) / currentZoom;

      // Calculate new Pan to keep the image point under the cursor
      // cursorX = newPanX + imagePointX * newZoom
      // newPanX = cursorX - imagePointX * newZoom
      const newPanX = cursorX - (imagePointX * newZoom);
      const newPanY = cursorY - (imagePointY * newZoom);

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [originalWidth, originalHeight]);

  // Find the closest snap target within threshold
  const getSnappedValue = (currentVal: number, targets: number[]) => {
    let closest = currentVal;
    let minDiff = SNAP_THRESHOLD;

    for (const t of targets) {
      const diff = Math.abs(currentVal - t);
      if (diff < minDiff) {
        minDiff = diff;
        closest = t;
      }
    }
    return closest;
  };

  // --- Handlers ---

  // 1. Mouse/Touch Down on Container (Start Drawing or Deselect)
  const handleContainerMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    // Panning Logic: Active if in Preview Mode OR Right Click
    const isRightClick = 'button' in e && e.button === 2;
    
    if (isPreviewMode || isRightClick) {
      // Start Panning Logic
      if (viewportRef.current) {
        let clientX: number, clientY: number;
        if ('touches' in e && e.touches.length > 0) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
        } else {
          clientX = (e as React.MouseEvent).clientX;
          clientY = (e as React.MouseEvent).clientY;
        }

        setIsPanning(true);
        setPanStart({
          x: clientX,
          y: clientY,
          initialPanX: pan.x,
          initialPanY: pan.y
        });
      }
      return;
    }
    
    // Only start drawing if clicking directly on the image/overlay container, not on a box
    if ((e.target as HTMLElement).closest('.selection-box')) return;

    e.preventDefault();
    setSelectedId(null); // Deselect
    
    const coords = getRelativeCoords(e);
    setStartPoint(coords);
    setMode('DRAWING');
    setTempBox({
      id: 'temp',
      x: coords.x,
      y: coords.y,
      width: 0,
      height: 0
    });
  };

  // 2. Mouse Down on Box (Start Moving)
  const handleBoxMouseDown = (e: React.MouseEvent, id: string) => {
    if (isPreviewMode) return;
    e.stopPropagation(); 
    e.preventDefault();

    setSelectedId(id);
    const box = boxes.find(b => b.id === id);
    if (!box) return;

    setMode('MOVING');
    setStartPoint(getRelativeCoords(e));
    setInitialBoxSnapshot({ ...box });
  };

  // 3. Mouse Down on Resize Handle (Start Resizing)
  const handleResizeMouseDown = (e: React.MouseEvent, id: string, handle: ResizeHandle) => {
    if (isPreviewMode) return;
    e.stopPropagation();
    e.preventDefault();

    setSelectedId(id);
    const box = boxes.find(b => b.id === id);
    if (!box) return;

    setMode('RESIZING');
    setActiveHandle(handle);
    setStartPoint(getRelativeCoords(e));
    setInitialBoxSnapshot({ ...box });
  };

  // 3.5 Mouse Down on Rotate Handle (Start Rotating)
  const handleRotateMouseDown = (e: React.MouseEvent, id: string) => {
    if (isPreviewMode) return;
    e.stopPropagation();
    e.preventDefault();

    setSelectedId(id);
    const box = boxes.find(b => b.id === id);
    if (!box) return;

    setMode('ROTATING');
    setStartPoint(getRelativeCoords(e));
    setInitialBoxSnapshot({ ...box });
  };

  // 4. Global Mouse/Touch Move
  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent | TouchEvent) => {
      if (isPanning && panStart) {
        e.preventDefault();
        let clientX: number, clientY: number;
        if ('touches' in e && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as MouseEvent).clientX;
            clientY = (e as MouseEvent).clientY;
        }
        
        const dx = clientX - panStart.x;
        const dy = clientY - panStart.y;
        
        setPan({
          x: panStart.initialPanX + dx,
          y: panStart.initialPanY + dy
        });
        return;
      }

      if (mode === 'IDLE' || !startPoint) return;

      const current = getRelativeCoords(e);
      const deltaX = current.x - startPoint.x;
      const deltaY = current.y - startPoint.y;

      // Prepare Snap Targets (Image Bounds + Edges of OTHER boxes)
      const otherBoxes = boxes.filter(b => b.id !== selectedId);
      const vTargets = [0, originalWidth, ...otherBoxes.flatMap(b => [b.x, b.x + b.width])];
      const hTargets = [0, originalHeight, ...otherBoxes.flatMap(b => [b.y, b.y + b.height])];

      if (mode === 'DRAWING' && tempBox) {
        let newX = startPoint.x;
        let newY = startPoint.y;
        let newWidth = current.x - startPoint.x;
        let newHeight = current.y - startPoint.y;

        // If dragging left/up, adjust origin
        if (newWidth < 0) {
          newX = current.x;
          newWidth = Math.abs(newWidth);
        }
        if (newHeight < 0) {
          newY = current.y;
          newHeight = Math.abs(newHeight);
        }

        // Clamp
        newX = clamp(newX, 0, originalWidth);
        newY = clamp(newY, 0, originalHeight);
        const maxWidth = originalWidth - newX;
        const maxHeight = originalHeight - newY;
        newWidth = clamp(newWidth, 0, maxWidth);
        newHeight = clamp(newHeight, 0, maxHeight);
        
        setBoxes(prev => {
            // If we are drawing, we might need to create the box first? 
            // The logic in original code was modifying tempBox, not boxes.
            return prev; 
        });
        setTempBox({
          ...tempBox,
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
          rotation: 0
        });
      } 
      else if (mode === 'ROTATING' && initialBoxSnapshot) {
         const cx = initialBoxSnapshot.x + initialBoxSnapshot.width / 2;
         const cy = initialBoxSnapshot.y + initialBoxSnapshot.height / 2;
         
         const getAngle = (p: {x: number, y: number}) => Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI;
         
         const angleStart = getAngle(startPoint);
         const angleCurrent = getAngle(current);
         const deltaAngle = angleCurrent - angleStart;
         
         let newRotation = (initialBoxSnapshot.rotation || 0) + deltaAngle;
         
         // Rotation Snapping Logic
         const ROTATION_SNAP_THRESHOLD = 5; // degrees
         const ROTATION_SNAP_INTERVAL = 45; // degrees
         
         const nearestMultiple = Math.round(newRotation / ROTATION_SNAP_INTERVAL) * ROTATION_SNAP_INTERVAL;
         
         if (Math.abs(newRotation - nearestMultiple) < ROTATION_SNAP_THRESHOLD) {
           newRotation = nearestMultiple;
         }
         
         setBoxes(prev => prev.map(b => 
           b.id === selectedId 
             ? { ...b, rotation: newRotation }
             : b
         ));
      }
      else if (mode === 'MOVING' && initialBoxSnapshot) {
        const rawX = initialBoxSnapshot.x + deltaX;
        const rawY = initialBoxSnapshot.y + deltaY;
        const width = initialBoxSnapshot.width;
        const height = initialBoxSnapshot.height;

        // Snapping Logic for Move:
        // Check Left edge
        const snappedLeft = getSnappedValue(rawX, vTargets);
        // Check Right edge (if we snapped right, what would X be?)
        const snappedRightX = getSnappedValue(rawX + width, vTargets) - width;
        
        // Determine which X snap is stronger (closer)
        const diffLeft = Math.abs(snappedLeft - rawX);
        const diffRight = Math.abs(snappedRightX - rawX);
        
        let finalX = rawX;
        if (Math.abs(snappedLeft - rawX) < 0.01 && Math.abs(snappedRightX - rawX) > 0.01) {
             finalX = snappedLeft;
        } else if (Math.abs(snappedRightX - rawX) < 0.01 && Math.abs(snappedLeft - rawX) > 0.01) {
             finalX = snappedRightX;
        } else {
             const isLeftSnap = Math.abs(snappedLeft - rawX) < SNAP_THRESHOLD;
             const isRightSnap = Math.abs((snappedRightX + width) - (rawX + width)) < SNAP_THRESHOLD;

             if (isLeftSnap && isRightSnap) {
                finalX = diffLeft < diffRight ? snappedLeft : snappedRightX;
             } else if (isLeftSnap) {
                finalX = snappedLeft;
             } else if (isRightSnap) {
                finalX = snappedRightX;
             }
        }

        // Same for Y
        const snappedTop = getSnappedValue(rawY, hTargets);
        const snappedBottomY = getSnappedValue(rawY + height, hTargets) - height;
        const diffTop = Math.abs(snappedTop - rawY);
        const diffBottom = Math.abs(snappedBottomY - rawY);
        
        const isTopSnap = Math.abs(snappedTop - rawY) < SNAP_THRESHOLD;
        const isBottomSnap = Math.abs((snappedBottomY + height) - (rawY + height)) < SNAP_THRESHOLD;

        let finalY = rawY;
        if (isTopSnap && isBottomSnap) {
             finalY = diffTop < diffBottom ? snappedTop : snappedBottomY;
        } else if (isTopSnap) {
             finalY = snappedTop;
        } else if (isBottomSnap) {
             finalY = snappedBottomY;
        }
        
        // Clamp Final
        const maxX = originalWidth - width;
        const maxY = originalHeight - height;
        finalX = clamp(finalX, 0, maxX);
        finalY = clamp(finalY, 0, maxY);
        
        setBoxes(prev => prev.map(b => 
          b.id === selectedId 
            ? { ...b, x: finalX, y: finalY }
            : b
        ));
      }
      else if (mode === 'RESIZING' && initialBoxSnapshot && activeHandle) {
        let { x, y, width, height } = initialBoxSnapshot;

        // Apply Delta first
        if (activeHandle.includes('e')) width += deltaX;
        if (activeHandle.includes('w')) { x += deltaX; width -= deltaX; }
        if (activeHandle.includes('s')) height += deltaY;
        if (activeHandle.includes('n')) { y += deltaY; height -= deltaY; }

        // Apply Snapping
        if (activeHandle.includes('e')) {
            const snappedRight = getSnappedValue(x + width, vTargets);
            width = snappedRight - x;
        }
        if (activeHandle.includes('w')) {
            const snappedLeft = getSnappedValue(x, vTargets);
            const diff = snappedLeft - x;
            x = snappedLeft;
            width -= diff; 
        }
        if (activeHandle.includes('s')) {
            const snappedBottom = getSnappedValue(y + height, hTargets);
            height = snappedBottom - y;
        }
        if (activeHandle.includes('n')) {
            const snappedTop = getSnappedValue(y, hTargets);
            const diff = snappedTop - y;
            y = snappedTop;
            height -= diff;
        }

        // Normalization (handling negative width/height)
        if (width < 0) {
          x += width;
          width = Math.abs(width);
        }
        if (height < 0) {
          y += height;
          height = Math.abs(height);
        }

        // Clamp
        x = clamp(x, 0, originalWidth);
        y = clamp(y, 0, originalHeight);
        width = clamp(width, 0, originalWidth - x);
        height = clamp(height, 0, originalHeight - y);

        setBoxes(prev => prev.map(b => 
          b.id === selectedId 
            ? { ...b, x, y, width, height } 
            : b
        ));
      }
    };

    const handleWindowMouseUp = () => {
      if (isPanning) {
        setIsPanning(false);
        setPanStart(null);
        return;
      }

      if (mode === 'DRAWING' && tempBox) {
        if (tempBox.width > 10 && tempBox.height > 10) {
          const newBox = { ...tempBox, id: crypto.randomUUID() };
          setBoxes(prev => [...prev, newBox]);
          setSelectedId(newBox.id);
        }
        setTempBox(null);
      }
      setMode('IDLE');
      setStartPoint(null);
      setInitialBoxSnapshot(null);
      setActiveHandle(null);
    };

    const handleWindowTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleWindowMouseMove(e);
    };

    const handleWindowTouchEnd = () => {
      handleWindowMouseUp();
    };

    if (mode !== 'IDLE' || isPanning) {
      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
      window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
      window.addEventListener('touchend', handleWindowTouchEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleWindowTouchEnd);
    };
  }, [mode, startPoint, tempBox, initialBoxSnapshot, selectedId, activeHandle, originalWidth, originalHeight, boxes, isPanning, panStart, isPreviewMode]);


  const removeBox = (id: string) => {
    setBoxes(boxes.filter(b => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleClear = () => {
    setBoxes([]);
    setSelectedId(null);
  };

  const containerBgClass = isCyber ? 'bg-slate-950' : 'bg-[#F2F2F7]';
  const toolbarClass = isCyber
    ? 'bg-slate-900/0 backdrop-blur-md border border-slate-800/50 shadow-2xl rounded-2xl'
    : 'bg-white/0 backdrop-blur-xl border border-white/40 shadow-xl rounded-[2rem] shadow-slate-200/50';
  const titleClass = isCyber ? 'font-mono font-bold text-cyan-400 tracking-wider' : 'font-sans font-bold text-slate-800 tracking-tight';

  return (
    <div className={`flex flex-col h-full fixed inset-0 ${containerBgClass}`}>
      
      {/* Floating Toolbar / Header */}
      <div className={`fixed top-4 sm:top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-6xl px-3 sm:px-4 lg:px-6`}>
        <div className={`${toolbarClass} p-3 sm:p-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-3 sm:gap-4`}>
           
           {/* Left: Branding & Stats */}
           <div className="flex items-center gap-3 sm:gap-6">
             <Logo theme={theme} collapsed={true} />
             
             <div className="h-6 sm:h-8 w-px bg-current opacity-10"></div>
             
             <div className="flex items-center gap-2 sm:gap-3">
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs sm:text-sm ${isCyber ? 'bg-cyan-900 text-cyan-400' : 'bg-blue-100 text-blue-600'}`}>
                  {boxes.length}
                </div>
                <div className="hidden sm:block">
                  <h3 className={`text-sm leading-tight ${titleClass}`}>
                    {isCyber ? '目标锁定系统' : '选择签名区域'}
                  </h3>
                  <p className={`text-[10px] ${isCyber ? 'text-slate-500 font-mono' : 'text-slate-400'}`}>
                    {isPreviewMode ? 'PREVIEW MODE' : 'DRAG TO SELECT'}
                  </p>
                </div>
             </div>
           </div>

           {/* Right: Controls */}
           <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
             {!isPreviewMode && boxes.length > 0 && (
               <Button variant="danger" onClick={handleClear} className="text-xs px-2 sm:px-3 py-2 touch-manipulation" theme={theme}>
                 {isCyber ? '清除' : '清空'}
               </Button>
             )}
             
             <div className={`h-6 w-px mx-1 sm:mx-2 ${isCyber ? 'bg-slate-700' : 'bg-slate-300'}`}></div>

             <Button variant="ghost" onClick={onCancel} className="text-xs px-2 sm:px-3 py-2 touch-manipulation flex-1 sm:flex-none" theme={theme}>
               取消
             </Button>
             
             <Button variant="secondary" onClick={() => onProcessWithAI(boxes)} className="text-xs px-3 sm:px-4 py-2 min-w-[80px] sm:min-w-[90px] touch-manipulation flex-1 sm:flex-none border-purple-200 text-purple-700 hover:bg-purple-50" theme={theme}>
               {isCyber ? 'AI 加速' : 'AI 处理'}
             </Button>

             <Button onClick={() => onConfirm(boxes)} className="text-xs px-3 sm:px-4 py-2 min-w-[80px] sm:min-w-[100px] touch-manipulation flex-1 sm:flex-none" theme={theme}>
               {boxes.length === 0 ? '本地处理' : (isCyber ? '标准提取' : '确认选择')}
             </Button>
           </div>
        </div>
      </div>

      {/* Floating Bottom Right Tools */}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-3">
        {/* Zoom Controls */}
        <div className={`flex flex-col items-center rounded-full p-1 shadow-lg ${isCyber ? 'bg-slate-900/0 border border-slate-700/50' : 'bg-white/0 border border-slate-200/50'} backdrop-blur-md`}>
          <button 
            onClick={() => setZoom(prev => Math.min(prev * 1.1, 5))}
            className={`p-2 rounded-full transition-colors active:scale-95 ${isCyber ? 'text-cyan-400 hover:bg-cyan-900/30' : 'text-slate-600 hover:bg-slate-100'}`}
            title="放大"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
          </button>
          
          <div className={`w-full h-px my-1 ${isCyber ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
          
          <span className={`text-[10px] py-1 font-mono select-none ${isCyber ? 'text-slate-400' : 'text-slate-500'}`}>
            {Math.round(zoom * 100)}%
          </span>
          
          <div className={`w-full h-px my-1 ${isCyber ? 'bg-slate-700' : 'bg-slate-200'}`}></div>

          <button 
            onClick={() => setZoom(prev => Math.max(prev * 0.9, 0.1))}
            className={`p-2 rounded-full transition-colors active:scale-95 ${isCyber ? 'text-cyan-400 hover:bg-cyan-900/30' : 'text-slate-600 hover:bg-slate-100'}`}
            title="缩小"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg>
          </button>
        </div>

        {/* Mode Toggle */}
        <button 
          onClick={() => setIsPreviewMode(!isPreviewMode)}
          className={`p-3 rounded-full shadow-lg transition-all active:scale-95 backdrop-blur-md ${isPreviewMode ? (isCyber ? 'bg-cyan-500/80 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-blue-500/80 text-white shadow-blue-500/30') : (isCyber ? 'bg-slate-900/0 text-slate-400 border border-slate-700/50 hover:text-cyan-400' : 'bg-white/0 text-slate-500 border border-slate-200/50 hover:text-blue-600')}`}
          title={isPreviewMode ? "切换回编辑模式" : "切换到预览模式"}
        >
          {isPreviewMode ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          )}
        </button>
      </div>

      {/* Canvas Area */}
      <div 
        ref={viewportRef}
        className={`flex-1 overflow-hidden relative flex w-full h-full ${isCyber ? 'bg-slate-950' : 'bg-slate-50/50'}`}
      >
        <div 
          className={`absolute top-0 left-0 shadow-2xl select-none touch-none origin-top-left transition-transform duration-75 ease-out ${(isPreviewMode || isPanning) ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-crosshair'}`}
          style={{ 
            width: originalWidth, 
            height: originalHeight,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
          onMouseDown={handleContainerMouseDown}
          onTouchStart={handleContainerMouseDown}
          onContextMenu={(e) => e.preventDefault()} // Disable context menu for right-click drag
        >
          {/* Main Image */}
          <img 
            ref={containerRef as any}
            src={imageUrl} 
            alt="Source" 
            className={`w-full h-full object-contain pointer-events-none ${isCyber ? 'border border-slate-700' : 'rounded-lg shadow-lg'}`}
            draggable={false}
          />
          
          {/* Cyber Grid Overlay */}
          {isCyber && <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.1)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none opacity-20"></div>}

          {/* Render Boxes */}
          {boxes.map((box, idx) => (
             <BoxOverlay 
               key={box.id} 
               box={box} 
               index={idx}
               isSelected={selectedId === box.id}
               showControls={!isPreviewMode}
               onMouseDown={(e) => handleBoxMouseDown(e, box.id)}
               onRemove={() => removeBox(box.id)}
               onResizeStart={handleResizeMouseDown}
               onRotateStart={handleRotateMouseDown}
               originalWidth={originalWidth}
               originalHeight={originalHeight}
               theme={theme}
               zoom={zoom}
             />
          ))}

          {/* Render Temp Box while drawing */}
          {tempBox && (
            <div 
              className={`absolute border-2 pointer-events-none ${isCyber ? 'border-cyan-400 bg-cyan-500/20' : 'border-blue-500 bg-blue-500/10'}`}
              style={{
                left: `${(tempBox.x / originalWidth) * 100}%`,
                top: `${(tempBox.y / originalHeight) * 100}%`,
                width: `${(tempBox.width / originalWidth) * 100}%`,
                height: `${(tempBox.height / originalHeight) * 100}%`,
              }}
            />
          )}
        </div>
      </div>
      
      {/* Help Text */}
      <div className={`absolute bottom-0 w-full pb-4 sm:pb-6 px-4 text-center text-[10px] sm:text-xs z-40 pointer-events-none select-none ${isCyber ? 'text-white font-mono' : 'text-black'}`}>
        <div className="bg-white/0 backdrop-blur-sm inline-block px-3 py-1 rounded-full">
          {isPreviewMode ? '预览模式：按住鼠标拖动查看，滑动滚轮缩放' : (isCyber ? '[操作指南] 左键绘制 / 右键拖动' : '提示：左键框选，右键拖动画面，滑动滚轮缩放')}
        </div>
      </div>
    </div>
  );
};

interface BoxOverlayProps {
  box: SelectionBox;
  index: number;
  isSelected: boolean;
  showControls: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onRemove: () => void;
  onResizeStart: (e: React.MouseEvent, id: string, handle: ResizeHandle) => void;
  onRotateStart: (e: React.MouseEvent, id: string) => void;
  originalWidth: number;
  originalHeight: number;
  theme: Theme;
  zoom: number;
}

const BoxOverlay: React.FC<BoxOverlayProps> = ({ 
  box, index, isSelected, showControls, onMouseDown, onRemove, onResizeStart, onRotateStart, originalWidth, originalHeight, theme, zoom 
}) => {
  const isCyber = theme === 'cyberpunk';
  
  // Cyber Style
  const borderClass = isSelected 
    ? (isCyber ? 'border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.5)] z-20' : 'border-blue-500 shadow-[0_0_0_2px_rgba(59,130,246,0.3)] z-20')
    : (isCyber ? 'border-cyan-800/80 hover:border-cyan-500/80 z-10' : 'border-white/80 outline outline-1 outline-blue-500/50 z-10');
  
  const bgClass = isSelected
    ? (isCyber ? 'bg-cyan-500/20' : 'bg-blue-500/10')
    : 'bg-transparent';

  const labelClass = isSelected
    ? (isCyber ? 'bg-cyan-500 text-black' : 'bg-blue-500 text-white')
    : (isCyber ? 'bg-slate-800 border border-slate-700 text-cyan-500' : 'bg-white text-blue-600 shadow-sm');

  // Resize Handles
  const handles: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  // Check if rotation is snapped (close to multiple of 45)
  const currentRotation = box.rotation || 0;
  const isSnapped = Math.abs(currentRotation % 45) < 0.1;

  // Scale correction for UI elements
  const scaleStyle = { transform: `scale(${1 / zoom})` };
  const handleSize = Math.max(10 / zoom, 4); // Minimum visible size

  return (
    <div
      className={`absolute cursor-move transition-colors selection-box ${borderClass} ${bgClass}`}
      style={{
        left: `${(box.x / originalWidth) * 100}%`,
        top: `${(box.y / originalHeight) * 100}%`,
        width: `${(box.width / originalWidth) * 100}%`,
        height: `${(box.height / originalHeight) * 100}%`,
        transform: `rotate(${box.rotation || 0}deg)`,
        borderWidth: `${2 / zoom}px`,
      }}
      onMouseDown={onMouseDown}
    >
      {/* Label (Outside Top Left, right edge aligned to box left edge) */}
      <div 
        className={`absolute -top-7 left-0 -translate-x-full px-2 py-0.5 text-[10px] font-bold tracking-wider rounded select-none whitespace-nowrap origin-bottom-right ${labelClass}`}
        style={{
          transform: `scale(${1 / zoom}) translate(0, 0)`,
          marginBottom: `${4 / zoom}px`,
          marginRight: `${4 / zoom}px`
        }}
      >
        {isCyber ? `TARGET_${String(index + 1).padStart(2, '0')}` : `签名 ${index + 1}`}
      </div>

      {/* Rotation Handle */}
      {isSelected && showControls && (
        <div
          className={`absolute -top-8 left-1/2 -translate-x-1/2 w-6 h-6 flex items-center justify-center rounded-full cursor-pointer touch-manipulation transition-colors origin-bottom ${
            isSnapped 
              ? (isCyber ? 'bg-green-500 text-black border border-green-400 shadow-[0_0_10px_lime]' : 'bg-green-500 text-white border border-green-600 shadow-md')
              : (isCyber ? 'bg-cyan-900/80 text-cyan-400 border border-cyan-500' : 'bg-white text-blue-600 border border-blue-500 shadow-sm')
          }`}
          style={{ 
            cursor: 'grab',
            transform: `translate(-50%, 0) scale(${1 / zoom})`,
            marginBottom: `${12 / zoom}px`
          }}
          onMouseDown={(e) => onRotateStart(e, box.id)}
          onTouchStart={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (e.touches.length === 1) {
              const syntheticEvent = {
                ...e,
                clientX: e.touches[0].clientX,
                clientY: e.touches[0].clientY,
                stopPropagation: () => e.stopPropagation(),
                preventDefault: () => e.preventDefault()
              } as any;
              onRotateStart(syntheticEvent, box.id);
            }
          }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
      )}

      {/* Close Button */}
      {isSelected && showControls && (
        <div 
          className={`absolute -top-7 right-0 w-6 h-6 sm:w-5 sm:h-5 flex items-center justify-center rounded cursor-pointer transition-colors touch-manipulation active:scale-95 origin-bottom-left ${isCyber ? 'bg-red-900/80 text-red-400 border border-red-800 active:bg-red-600 active:text-white' : 'bg-red-500 text-white shadow-sm active:bg-red-600'}`}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onRemove();
          }}
          style={{
            transform: `scale(${1 / zoom})`,
            marginBottom: `${4 / zoom}px`,
            marginLeft: `${4 / zoom}px`
          }}
        >
          <svg className="w-3.5 h-3.5 sm:w-3 sm:h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      )}

      {/* Resize Handles */}
      {isSelected && showControls && handles.map(handle => (
        <div
          key={handle}
          className={`absolute z-30 touch-manipulation ${isCyber ? 'bg-cyan-400 border border-cyan-950 shadow-[0_0_5px_cyan]' : 'bg-white border border-blue-500 rounded-full shadow-sm'}`}
          style={{
            top: handle.includes('n') ? '0%' : handle.includes('s') ? '100%' : '50%',
            left: handle.includes('w') ? '0%' : handle.includes('e') ? '100%' : '50%',
            width: `${10 / zoom}px`,
            height: `${10 / zoom}px`,
            transform: 'translate(-50%, -50%)', // No scale needed here as we set width/height directly
            borderWidth: `${1 / zoom}px`,
            cursor: `${handle}-resize`
          }}
          onMouseDown={(e) => onResizeStart(e, box.id, handle)}
          onTouchStart={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (e.touches.length === 1) {
              // Create a synthetic mouse event for compatibility
              const syntheticEvent = {
                ...e,
                clientX: e.touches[0].clientX,
                clientY: e.touches[0].clientY,
                stopPropagation: () => e.stopPropagation(),
                preventDefault: () => e.preventDefault()
              } as any;
              onResizeStart(syntheticEvent, box.id, handle);
            }
          }}
        />
      ))}
    </div>
  );
};