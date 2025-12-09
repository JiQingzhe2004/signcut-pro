import React, { useState, useRef, useEffect } from 'react';
import { Theme } from '../types';
import { Settings, X, HelpCircle, Save } from 'lucide-react';
import { Button } from './Button';

interface AIConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

interface SettingsMenuProps {
  aiConfig: AIConfig;
  setAiConfig: React.Dispatch<React.SetStateAction<AIConfig>>;
  onSave: (config: AIConfig) => void;
  theme?: Theme;
  onHelp?: () => void;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({
  aiConfig,
  setAiConfig,
  onSave,
  theme = 'cyberpunk',
  onHelp
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isCyber = theme === 'cyberpunk';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate content height
  // Title (40) + Text (40) + 3 inputs (3 * 70) + Footer (50) + Padding (32)
  // Approx 380px
  const expandedHeight = 420;
  const expandedWidth = '20rem'; // 320px

  return (
    <div className="relative w-10 h-10 sm:w-10 sm:h-10 z-50" ref={containerRef}>
      <div
        onClick={(e) => {
           if (!isOpen) {
               setIsOpen(true);
               e.stopPropagation();
           }
        }}
        className={`
          absolute right-0 top-0 flex flex-col overflow-hidden transition-all duration-500
          origin-top-right
          ${isOpen 
            ? 'shadow-2xl' 
            : 'shadow-sm hover:shadow-md hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center'
          }
          ${isCyber 
            ? `bg-slate-900 border ${isOpen ? 'border-slate-700' : 'border-slate-800 hover:border-cyan-500'} text-cyan-400`
            : `bg-white border ${isOpen ? 'border-slate-200' : 'border-slate-200 hover:border-blue-400'} text-slate-800`
          }
        `}
        style={{
             width: isOpen ? expandedWidth : '2.5rem', // 2.5rem = 10 (tailwind)
             height: isOpen ? `${expandedHeight}px` : '2.5rem',
             borderRadius: '2rem', // Increased for rounder look
             transitionTimingFunction: 'cubic-bezier(0.34, 1.25, 0.64, 1)'
        }}
      >
        {/* Closed State: Icon */}
        <div className={`
          absolute inset-0 flex items-center justify-center transition-all duration-300
          ${isOpen ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100'}
        `}>
           <Settings className="w-5 h-5" />
        </div>

        {/* Open State: Content */}
        <div className={`
           flex flex-col w-full h-full p-5 transition-all duration-300 delay-75
           ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none absolute'}
        `}>
          {/* Header */}
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <h3 className="text-base font-bold whitespace-nowrap">通用 AI 设置</h3>
            <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); onHelp?.(); }}
                  className={`p-1 rounded-full transition-colors ${isCyber ? 'hover:bg-slate-800 text-cyan-500' : 'hover:bg-slate-100 text-blue-500'}`}
                  title="查看配置帮助"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                  className={`p-1 rounded-full transition-colors ${isCyber ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}
                >
                  <X className="w-4 h-4" />
                </button>
            </div>
          </div>

          <p className={`text-xs mb-4 flex-shrink-0 ${isCyber ? 'text-slate-400' : 'text-slate-500'}`}>
            配置兼容 OpenAI 接口的 API 端点和密钥。仅保存在本地。
          </p>

          <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar">
              <div>
                <label className={`text-xs block mb-1 ${isCyber ? 'text-slate-500' : 'text-slate-500'}`}>API Endpoint</label>
                <input 
                  type="text" 
                  value={aiConfig.endpoint}
                  onChange={(e) => setAiConfig(prev => ({ ...prev, endpoint: e.target.value }))}
                  placeholder="https://api.openai.com/v1/chat/completions"
                  className={`w-full p-2 rounded-lg outline-none border text-xs ${isCyber ? 'bg-slate-950 border-slate-800 focus:border-cyan-500 text-white' : 'bg-slate-50 border-slate-200 focus:border-blue-500 text-slate-900'}`}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <div>
                <label className={`text-xs block mb-1 ${isCyber ? 'text-slate-500' : 'text-slate-500'}`}>API Key</label>
                <input 
                  type="password" 
                  value={aiConfig.apiKey}
                  onChange={(e) => setAiConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="sk-..."
                  className={`w-full p-2 rounded-lg outline-none border text-xs ${isCyber ? 'bg-slate-950 border-slate-800 focus:border-cyan-500 text-white' : 'bg-slate-50 border-slate-200 focus:border-blue-500 text-slate-900'}`}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <div>
                <label className={`text-xs block mb-1 ${isCyber ? 'text-slate-500' : 'text-slate-500'}`}>Model Name</label>
                <input 
                  type="text" 
                  value={aiConfig.model}
                  onChange={(e) => setAiConfig(prev => ({ ...prev, model: e.target.value }))}
                  placeholder="gpt-4o / gemini-1.5-flash"
                  className={`w-full p-2 rounded-lg outline-none border text-xs ${isCyber ? 'bg-slate-950 border-slate-800 focus:border-cyan-500 text-white' : 'bg-slate-50 border-slate-200 focus:border-blue-500 text-slate-900'}`}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
          </div>

          <div className="mt-4 pt-2 flex justify-end flex-shrink-0">
             <Button 
                onClick={(e) => {
                    e.stopPropagation();
                    onSave(aiConfig);
                    setIsOpen(false);
                }} 
                theme={theme}
                className="w-full justify-center py-2 text-xs"
             >
                <Save className="w-3 h-3 mr-2" />
                保存配置
             </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
