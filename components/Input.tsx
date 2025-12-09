import React, { useRef } from 'react';
import { Theme } from '../types';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  theme?: Theme;
  label?: string; // Optional suffix label (e.g., "px", "宽")
  labelPrefix?: string; // Optional prefix label
}

export const Input: React.FC<InputProps> = ({
  theme = 'cyberpunk',
  className = '',
  label,
  labelPrefix,
  type,
  ...props
}) => {
  const isCyber = theme === 'cyberpunk';
  const inputRef = useRef<HTMLInputElement>(null);

  // Wrapper Styles (Container that looks like the input)
  // We extract width-related classes from className to apply to container if possible,
  // but simpler is to apply sizing to container and let input fill it.
  // Given usage: className="w-16 sm:w-20" passed from App.tsx.
  
  const containerBase = "relative flex items-center rounded-lg transition-all border overflow-hidden group";
  const containerTheme = isCyber
    ? "bg-slate-950 border-slate-700 focus-within:border-cyan-500 focus-within:shadow-[0_0_10px_rgba(6,182,212,0.2)]"
    : "bg-slate-100 border-transparent focus-within:bg-white focus-within:border-blue-300 focus-within:shadow-sm focus-within:ring-2 focus-within:ring-blue-100";

  // Input Styles (Invisible but functional)
  const inputBase = "w-full min-w-0 bg-transparent border-none outline-none px-2 py-1.5 text-xs text-center appearance-none";
  const inputTheme = isCyber
    ? "text-cyan-50 placeholder-slate-600 font-mono"
    : "text-slate-800 placeholder-slate-400 font-sans";

  // Helper to trigger change event
  const triggerChange = (step: number) => {
    if (inputRef.current) {
      const currentValue = parseFloat(inputRef.current.value) || 0;
      const newValue = currentValue + step;
      
      // Respect min/max if present
      if (props.min !== undefined && newValue < Number(props.min)) return;
      if (props.max !== undefined && newValue > Number(props.max)) return;

      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(inputRef.current, newValue.toString());
        const event = new Event('input', { bubbles: true });
        inputRef.current.dispatchEvent(event);
      }
    }
  };

  const isNumber = type === 'number';

  // Spinner Button Styles
  const spinnerBtnBase = "flex items-center justify-center w-5 h-1/2 cursor-pointer transition-colors active:scale-90";
  const spinnerContainer = `flex flex-col border-l w-5 h-full absolute right-0 top-0 bottom-0 z-10 ${
    isCyber ? "border-slate-800" : "border-slate-200"
  }`;
  
  const spinnerUp = isCyber 
    ? "hover:bg-slate-800 text-slate-500 hover:text-cyan-400 border-b border-slate-800"
    : "hover:bg-slate-200 text-slate-400 hover:text-blue-500 border-b border-slate-200";
    
  const spinnerDown = isCyber
    ? "hover:bg-slate-800 text-slate-500 hover:text-cyan-400"
    : "hover:bg-slate-200 text-slate-400 hover:text-blue-500";

  return (
    <div className="flex items-center gap-2">
      {labelPrefix && (
        <span className={`text-[10px] whitespace-nowrap ${isCyber ? 'text-slate-600 font-mono' : 'text-slate-400'}`}>
          {labelPrefix}
        </span>
      )}
      
      <div className={`${containerBase} ${containerTheme} ${className}`}>
        <input
          ref={inputRef}
          type={type}
          {...props}
          className={`${inputBase} ${inputTheme} ${isNumber ? 'pr-5' : ''} [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]`}
        />
        
        {isNumber && (
          <div className={spinnerContainer}>
            <div 
              className={`${spinnerBtnBase} ${spinnerUp}`}
              onClick={(e) => {
                e.preventDefault();
                triggerChange(1);
              }}
            >
              <ChevronUp className="w-3 h-3" />
            </div>
            <div 
              className={`${spinnerBtnBase} ${spinnerDown}`}
              onClick={(e) => {
                e.preventDefault();
                triggerChange(-1);
              }}
            >
              <ChevronDown className="w-3 h-3" />
            </div>
          </div>
        )}
      </div>

      {label && (
        <span className="text-slate-400 text-xs whitespace-nowrap">{label}</span>
      )}
    </div>
  );
};
