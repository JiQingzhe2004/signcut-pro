import React from 'react';
import { Theme } from '../types';

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
    ? "px-6 py-3 font-mono text-sm font-bold tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 border relative overflow-hidden group rounded-2xl"
    : "px-6 py-3 font-sans text-sm font-semibold tracking-wide transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shadow-sm border rounded-full hover:shadow-md";
  
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
        <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  );
};
