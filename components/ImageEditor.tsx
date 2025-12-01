import React, { useRef, useState, useEffect } from 'react';
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
  theme
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State
  const [boxes, setBoxes] = useState<SelectionBox[]>(initialBoxes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<InteractionMode>('IDLE');
  
  // Interaction State
  const [startPoint, setStartPoint] = useState<{ x: number, y: number } | null>(null);
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [startRotation, setStartRotation] = useState<number>(0);
  
  // Temp state for drawing/modifying
  const [tempBox, setTempBox] = useState<SelectionBox | null>(null);
  const [initialBoxSnapshot, setInitialBoxSnapshot] = useState<SelectionBox | null>(null);

  const [isPreviewMode, setIsPreviewMode] = useState(false);
  
  const isCyber = theme === 'cyberpunk';
  const SNAP_THRESHOLD = 20;

  // --- Helpers ---

  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

  // Convert Mouse/Touch Event to Image Coordinates
  const getRelativeCoords = (e: React.MouseEvent | MouseEvent | React.TouchEvent | TouchEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    
    let clientX: number, clientY: number;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX - rect.left;
      clientY = e.touches[0].clientY - rect.top;
    } else {
      clientX = e.clientX - rect.left;
      clientY = e.clientY - rect.top;
    }

    const scaleX = originalWidth / rect.width;
    const scaleY = originalHeight / rect.height;

    // Clamp coords to image bounds so we can't select outside
    const x = clamp(clientX * scaleX, 0, originalWidth);
    const y = clamp(clientY * scaleY, 0, originalHeight);

    return { x, y };
  };

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
    if (isPreviewMode) return;
    
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

    if (mode !== 'IDLE') {
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
  }, [mode, startPoint, tempBox, initialBoxSnapshot, selectedId, activeHandle, originalWidth, originalHeight, boxes]);


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
    ? 'bg-slate-900/80 backdrop-blur border border-slate-800 shadow-2xl rounded-2xl'
    : 'bg-white/70 backdrop-blur-xl border border-white/60 shadow-xl rounded-[2rem] shadow-slate-200/50';
  const titleClass = isCyber ? 'font-mono font-bold text-cyan-400 tracking-wider' : 'font-sans font-bold text-slate-800 tracking-tight';

  return (
    <div className={`flex flex-col h-full animate-fade-in ${containerBgClass}`}>
      
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
             <button 
               onClick={() => setIsPreviewMode(!isPreviewMode)}
               className={`p-2 rounded-lg transition-colors touch-manipulation active:scale-95 ${isPreviewMode ? (isCyber ? 'bg-cyan-500 text-black' : 'bg-blue-500 text-white') : (isCyber ? 'bg-slate-800 text-slate-400 active:text-cyan-400' : 'bg-slate-100 text-slate-500 active:bg-slate-200')}`}
               title={isPreviewMode ? "切换回编辑模式" : "切换到预览模式"}
             >
               {isPreviewMode ? (
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
               ) : (
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
               )}
             </button>
             
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

      {/* Canvas Area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-2 sm:p-4 pt-36 sm:pt-28">
        <div 
          className="relative shadow-2xl select-none cursor-crosshair touch-none"
          style={{ width: 'fit-content', height: 'fit-content' }}
          onMouseDown={handleContainerMouseDown}
          onTouchStart={handleContainerMouseDown}
        >
          {/* Main Image */}
          <img 
            ref={containerRef as any}
            src={imageUrl} 
            alt="Source" 
            className={`max-h-[70vh] sm:max-h-[75vh] max-w-full object-contain pointer-events-none ${isCyber ? 'border border-slate-700' : 'rounded-lg shadow-lg'}`}
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
             />
          ))}

          {/* Render Temp Box while drawing */}
          {tempBox && (
            <div 
              className={`absolute border-2 pointer-events-none ${isCyber ? 'border-cyan-400 bg-cyan-400/10' : 'border-blue-500 bg-blue-500/10'}`}
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
      <div className={`pb-4 sm:pb-6 px-4 text-center text-[10px] sm:text-xs ${isCyber ? 'text-slate-500 font-mono' : 'text-slate-400'}`}>
        {isPreviewMode ? '预览模式下无法编辑' : (isCyber ? '[操作指南] 拖拽绘制 / 点击选中 / 拖动边缘调整 / delete删除' : '提示：拖拽框选，点击选中可调整大小，Delete键删除')}
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
}

const BoxOverlay: React.FC<BoxOverlayProps> = ({ 
  box, index, isSelected, showControls, onMouseDown, onRemove, onResizeStart, onRotateStart, originalWidth, originalHeight, theme 
}) => {
  const isCyber = theme === 'cyberpunk';
  
  // Cyber Style
  const borderClass = isSelected 
    ? (isCyber ? 'border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.5)] z-20' : 'border-blue-500 shadow-[0_0_0_2px_rgba(59,130,246,0.3)] z-20')
    : (isCyber ? 'border-cyan-800/80 hover:border-cyan-500/80 z-10' : 'border-white/80 outline outline-1 outline-blue-500/50 z-10');
  
  const bgClass = isSelected
    ? (isCyber ? 'bg-cyan-400/10' : 'bg-blue-500/10')
    : 'bg-transparent';

  const labelClass = isSelected
    ? (isCyber ? 'bg-cyan-500 text-black' : 'bg-blue-500 text-white')
    : (isCyber ? 'bg-slate-800 border border-slate-700 text-cyan-500' : 'bg-white text-blue-600 shadow-sm');

  // Resize Handles
  const handles: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  // Check if rotation is snapped (close to multiple of 45)
  const currentRotation = box.rotation || 0;
  const isSnapped = Math.abs(currentRotation % 45) < 0.1;

  return (
    <div
      className={`absolute border-2 cursor-move transition-colors selection-box ${borderClass} ${bgClass}`}
      style={{
        left: `${(box.x / originalWidth) * 100}%`,
        top: `${(box.y / originalHeight) * 100}%`,
        width: `${(box.width / originalWidth) * 100}%`,
        height: `${(box.height / originalHeight) * 100}%`,
        transform: `rotate(${box.rotation || 0}deg)`,
      }}
      onMouseDown={onMouseDown}
    >
      {/* Label (Outside Top Left, right edge aligned to box left edge) */}
      <div 
        className={`absolute -top-7 left-0 -translate-x-full px-2 py-0.5 text-[10px] font-bold tracking-wider rounded select-none whitespace-nowrap ${labelClass}`}
      >
        {isCyber ? `TARGET_${String(index + 1).padStart(2, '0')}` : `签名 ${index + 1}`}
      </div>

      {/* Rotation Handle */}
      {isSelected && showControls && (
        <div
          className={`absolute -top-8 left-1/2 -translate-x-1/2 w-6 h-6 flex items-center justify-center rounded-full cursor-pointer touch-manipulation transition-colors ${
            isSnapped 
              ? (isCyber ? 'bg-green-500 text-black border border-green-400 shadow-[0_0_10px_lime]' : 'bg-green-500 text-white border border-green-600 shadow-md')
              : (isCyber ? 'bg-cyan-900/80 text-cyan-400 border border-cyan-500' : 'bg-white text-blue-600 border border-blue-500 shadow-sm')
          }`}
          style={{ cursor: 'grab' }}
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
          className={`absolute -top-7 right-0 w-6 h-6 sm:w-5 sm:h-5 flex items-center justify-center rounded cursor-pointer transition-colors touch-manipulation active:scale-95 ${isCyber ? 'bg-red-900/80 text-red-400 border border-red-800 active:bg-red-600 active:text-white' : 'bg-red-500 text-white shadow-sm active:bg-red-600'}`}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onRemove();
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
          className={`absolute w-4 h-4 sm:w-2.5 sm:h-2.5 z-30 transform -translate-x-1/2 -translate-y-1/2 touch-manipulation ${isCyber ? 'bg-cyan-400 border border-cyan-950 shadow-[0_0_5px_cyan]' : 'bg-white border border-blue-500 rounded-full shadow-sm'}`}
          style={{
            top: handle.includes('n') ? '0%' : handle.includes('s') ? '100%' : '50%',
            left: handle.includes('w') ? '0%' : handle.includes('e') ? '100%' : '50%',
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