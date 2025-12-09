import React from 'react';
import { Theme } from '../types';

interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  theme?: Theme;
}

export const Slider: React.FC<SliderProps> = ({
  theme = 'cyberpunk',
  className = '',
  ...props
}) => {
  const isCyber = theme === 'cyberpunk';

  return (
    <input
      type="range"
      {...props}
      className={`
        appearance-none h-2 sm:h-1.5 rounded-lg cursor-pointer touch-manipulation transition-all
        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:transition-all
        ${isCyber 
          ? 'bg-slate-700 accent-cyan-500 [&::-webkit-slider-thumb]:bg-cyan-500 [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(6,182,212,0.5)] [&::-webkit-slider-thumb]:hover:scale-110' 
          : 'bg-slate-200 accent-blue-500 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500 [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:hover:scale-110'
        }
        ${className}
      `}
    />
  );
};
