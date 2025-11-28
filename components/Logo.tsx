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
      {/* Icon */}
      <div className={`relative flex items-center justify-center shrink-0 transition-all duration-500 overflow-hidden ${collapsed ? 'w-8 h-8 rounded-lg' : 'w-10 h-10 rounded-xl'} ${isCyber ? 'bg-slate-900 border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/30'}`}>
        {/* Cyberpunk Icon Graphic */}
        {isCyber && (
          <svg className="w-full h-full p-2 text-cyan-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19.5 4.5L16.5 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="square"/>
            <path d="M4 20L8 16" stroke="currentColor" strokeWidth="2" strokeLinecap="square"/>
            <path d="M14 10L10 14" stroke="currentColor" strokeWidth="2" strokeLinecap="square" className="animate-pulse"/>
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" className="opacity-50"/>
          </svg>
        )}
        
        {/* iOS Icon Graphic */}
        {!isCyber && (
          <svg className="w-full h-full p-2 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15.5 3.5L4.5 15.5V20.5H9.5L20.5 8.5L15.5 3.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M13.5 5.5L18.5 10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      
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