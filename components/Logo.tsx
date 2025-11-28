import React from 'react';
import { Theme } from '../types';

interface LogoProps {
  theme: Theme;
  className?: string;
  collapsed?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ theme, className = '', collapsed = false }) => {
  const isCyber = theme === 'cyberpunk';
  
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Logo Image */}
      <img 
        src="/logo.svg" 
        alt="SignCut Pro Logo"
        className={`shrink-0 transition-all duration-500 ${collapsed ? 'w-8 h-8' : 'w-10 h-10'} ${
          isCyber ? 'brightness-0 invert' : ''
        }`}
      />
      
      {/* Text */}
      {!collapsed && (
        <div className="flex flex-col justify-center">
          <h1 className={`font-bold leading-none tracking-tight ${isCyber ? 'text-white font-mono text-lg' : 'text-slate-900 font-sans text-xl'}`}>
            SignCut <span className={isCyber ? 'text-cyan-400' : 'text-blue-600'}>PRO</span>
          </h1>
          <span className={`text-[9px] uppercase tracking-[0.2em] mt-0.5 ${isCyber ? 'text-slate-500 font-mono' : 'text-slate-400 font-sans'}`}>
            {isCyber ? 'VECTORIZE // SYS' : 'Digital Signature'}
          </span>
        </div>
      )}
    </div>
  );
};