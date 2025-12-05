import React, { useState, useRef, useEffect } from 'react';
import { Theme } from '../types';

interface TooltipProps {
  content: string;
  children: React.ReactElement;
  theme: Theme;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, theme, position = 'left' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const isCyber = theme === 'cyberpunk';

  const tooltipClasses = isCyber
    ? 'bg-slate-900/90 text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
    : 'bg-slate-800 text-white shadow-lg';

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div 
      className="relative flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className={`absolute z-[100] px-2 py-1 text-xs font-medium whitespace-nowrap rounded pointer-events-none animate-in fade-in zoom-in-95 duration-200 ${tooltipClasses} ${positionClasses[position]}`}>
          {content}
          {/* Arrow */}
          <div className={`absolute w-1.5 h-1.5 rotate-45 ${position === 'left' ? 'top-1/2 -translate-y-1/2 -right-0.5' : ''} ${isCyber ? 'bg-slate-900 border-r border-b border-cyan-500/30' : 'bg-slate-800'}`}></div>
        </div>
      )}
    </div>
  );
};
