import React, { useState, useRef, useEffect } from 'react';
import { Theme } from '../types';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  theme?: Theme;
  className?: string;
  disabled?: boolean;
  direction?: 'up' | 'down';
  variant?: 'default' | 'fab';
  icon?: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  theme = 'cyberpunk',
  className = '',
  disabled = false,
  direction = 'down',
  variant = 'default',
  icon
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isCyber = theme === 'cyberpunk';

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (newValue: string) => {
    onChange(newValue);
    setIsOpen(false);
  };

  if (variant === 'fab') {
    // Calculate approximate height: 
    // Container padding (py-2 -> 16px) + Options (40px each: text-xs/16px + py-3/24px)
    // Note: This is an estimation. For pixel-perfect dynamic height, we'd need useLayoutEffect/ResizeObserver,
    // but for this specific component with known styling, calculation is performant and sufficient.
    const expandedHeight = options.length * 40 + 16;
    
    return (
      <div className={`relative w-12 h-12 ${className}`} ref={containerRef}>
        <div
          onClick={(e) => {
             if (disabled) return;
             if (!isOpen) {
                 setIsOpen(true);
                 e.stopPropagation();
             }
          }}
          className={`
            absolute right-0 flex flex-col overflow-hidden transition-all duration-500
            ${direction === 'up' ? 'bottom-0 origin-bottom-right' : 'top-0 origin-top-right'}
            ${isOpen 
              ? 'shadow-2xl' 
              : 'shadow-lg hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center'
            }
            ${isCyber 
              ? `bg-slate-900 border ${isOpen ? 'border-slate-700' : 'border-slate-700 hover:border-cyan-500'} text-cyan-400`
              : `bg-white border ${isOpen ? 'border-slate-200' : 'border-slate-200 hover:border-blue-400'} text-slate-700`
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          style={{
               width: isOpen ? '12rem' : '3rem',
               height: isOpen ? `${expandedHeight}px` : '3rem',
               borderRadius: '2rem',
               transitionTimingFunction: 'cubic-bezier(0.34, 1.25, 0.64, 1)'
            }}
          >
            {/* Closed State: Icon */}
          <div className={`
            absolute inset-0 flex items-center justify-center transition-all duration-300
            ${isOpen ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100'}
          `}>
             {icon || <ChevronDown className="w-5 h-5" />}
          </div>

          {/* Open State: Options */}
          <div className={`
             flex flex-col w-full py-2 transition-all duration-300 delay-75
             ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none absolute'}
          `}>
            {options.map((option) => (
              <div
                key={option.value}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(option.value);
                }}
                className={`
                  px-4 py-3 text-xs cursor-pointer flex items-center justify-between transition-colors whitespace-nowrap
                  ${isCyber
                    ? (option.value === value 
                        ? "bg-cyan-950/30 text-cyan-400 font-bold" 
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-200")
                    : (option.value === value
                        ? "bg-blue-50 text-blue-600 font-bold"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")
                  }
                `}
              >
                <span className={isCyber ? "font-mono" : "font-sans"}>{option.label}</span>
                {option.value === value && (
                  <Check className="w-3.5 h-3.5 flex-shrink-0 ml-2" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Styles
  const containerBase = "relative min-w-[120px]";
  
  const triggerBase = isCyber
    ? "w-full flex items-center justify-between px-3 py-2 text-xs font-mono font-bold rounded-xl border transition-all cursor-pointer select-none"
    : "w-full flex items-center justify-between px-3 py-2 text-xs font-sans font-medium rounded-xl border transition-all cursor-pointer select-none shadow-sm";

  const triggerState = isOpen
    ? (isCyber ? "bg-slate-900 border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]" : "bg-white border-blue-500 text-blue-600 ring-2 ring-blue-100")
    : (isCyber ? "bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-600 hover:bg-slate-900 hover:text-cyan-400" : "bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-600 hover:bg-slate-50");

  const dropdownBase = isCyber
    ? `absolute z-50 min-w-[160px] py-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in duration-200 ${direction === 'up' ? 'bottom-full mb-3 slide-in-from-bottom-2 right-0' : 'top-full mt-2 slide-in-from-top-2 w-full'}`
    : `absolute z-50 min-w-[160px] py-1 bg-white border border-slate-100 rounded-xl shadow-xl overflow-hidden animate-in fade-in duration-200 ${direction === 'up' ? 'bottom-full mb-3 slide-in-from-bottom-2 right-0' : 'top-full mt-2 slide-in-from-top-2 w-full'}`;

  const optionBase = isCyber
    ? "px-3 py-2 text-xs font-mono cursor-pointer flex items-center justify-between transition-colors"
    : "px-3 py-2 text-xs font-sans cursor-pointer flex items-center justify-between transition-colors";

  const getOptionState = (isSelected: boolean) => {
    if (isCyber) {
      return isSelected 
        ? "bg-cyan-950/30 text-cyan-400" 
        : "text-slate-400 hover:bg-slate-800 hover:text-slate-200";
    }
    return isSelected
      ? "bg-blue-50 text-blue-600 font-medium"
      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900";
  };

  return (
    <div className={`${containerBase} ${className}`} ref={containerRef}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`${triggerBase} ${triggerState} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className="truncate mr-2">{selectedOption.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className={dropdownBase}>
          {options.map((option) => (
            <div
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`${optionBase} ${getOptionState(option.value === value)}`}
            >
              <span className="truncate">{option.label}</span>
              {option.value === value && (
                <Check className="w-3 h-3 flex-shrink-0 ml-2" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
