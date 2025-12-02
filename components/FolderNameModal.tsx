import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Theme } from '../types';

interface FolderNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
  initialValue?: string;
  theme: Theme;
}

export const FolderNameModal: React.FC<FolderNameModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  initialValue,
  theme 
}) => {
  const [value, setValue] = useState(initialValue);
  const isCyber = theme === 'cyberpunk';
  
  // Reset value when modal opens
  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const bgClass = isCyber ? 'bg-slate-900 border border-slate-800 text-slate-300' : 'bg-white text-slate-600';
  const titleClass = isCyber ? 'text-cyan-400' : 'text-slate-900';
  const inputClass = isCyber 
    ? 'bg-slate-950 border-slate-800 text-cyan-100 focus:border-cyan-500 placeholder-slate-600' 
    : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500 placeholder-slate-400';

  const handleConfirm = () => {
    if (value.trim()) {
      onConfirm(value.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className={`relative w-full max-w-md flex flex-col rounded-2xl shadow-2xl overflow-hidden ${bgClass}`}>
        <div className="p-6 pb-0">
          <h2 className={`text-xl font-bold mb-2 ${titleClass}`}>保存</h2>
          <p className="text-sm opacity-70">请输入文件夹名称，我们将为您一次性打包所有签名并下载。</p>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isCyber ? 'text-slate-500' : 'text-slate-400'}`}>
              文件夹名称
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${inputClass}`}
              placeholder="例如：XXX签名"
              autoFocus
            />
          </div>
        </div>

        <div className="p-6 pt-0 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} theme={theme}>
            取消
          </Button>
          <Button variant="primary" onClick={handleConfirm} theme={theme}>
            确认
          </Button>
        </div>
      </div>
    </div>
  );
};
