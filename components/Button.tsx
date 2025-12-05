import React from 'react';
import { Theme } from '../types';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  isLoading?: boolean;
  theme?: Theme;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  isLoading, 
  className = '', 
  disabled,
  theme = 'cyberpunk',
  ...props 
}) => {
  const isCyber = theme === 'cyberpunk';

  // Base styles
  const baseStyle = isCyber
    ? "px-4 sm:px-6 py-2.5 sm:py-3 font-mono text-xs sm:text-sm font-bold tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 border relative overflow-hidden group rounded-2xl touch-manipulation min-h-[44px]"
    : "px-4 sm:px-6 py-2.5 sm:py-3 font-sans text-xs sm:text-sm font-semibold tracking-wide transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shadow-sm border rounded-full hover:shadow-md touch-manipulation min-h-[44px]";
  
  const variants = {
    primary: isCyber 
      ? "bg-cyan-950/40 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500 hover:text-black hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]"
      : "bg-black text-white border-transparent hover:bg-gray-800 hover:shadow-lg shadow-black/20",
    
    secondary: isCyber
      ? "bg-slate-900/80 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200 hover:bg-slate-800"
      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300",
    
    danger: isCyber
      ? "bg-red-950/30 border-red-600/50 text-red-500 hover:bg-red-600 hover:text-black hover:shadow-[0_0_20px_rgba(220,38,38,0.4)]"
      : "bg-red-50 text-red-600 border-red-100 hover:bg-red-100 hover:border-red-200",
    
    ghost: isCyber
      ? "bg-transparent border-transparent text-slate-500 hover:text-cyan-400 hover:bg-cyan-950/10"
      : "bg-transparent border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <Loader2 className="animate-spin h-4 w-4 text-current" />
      )}
      {children}
    </button>
  );
};
