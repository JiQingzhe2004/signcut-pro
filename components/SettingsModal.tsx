import React, { useState, useEffect } from 'react';
import { AISettings, AIProvider, DEFAULT_GEMINI_MODEL, DEFAULT_ZHIPU_MODEL } from '../types';
import { Button } from './Button';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AISettings;
  onSave: (settings: AISettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState<AISettings>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value as AIProvider;
    setLocalSettings(prev => ({
      ...prev,
      provider: newProvider,
      // Reset model name to default when switching providers
      modelName: newProvider === 'gemini' ? DEFAULT_GEMINI_MODEL : DEFAULT_ZHIPU_MODEL
    }));
  };

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800">AI 模型设置</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 space-y-5">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">选择 AI 服务商</label>
            <div className="relative">
              <select 
                value={localSettings.provider}
                onChange={handleProviderChange}
                className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none bg-white"
              >
                <option value="gemini">Google Gemini</option>
                <option value="zhipu">智谱 AI (ZhipuGLM)</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Model Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">模型名称 (Model)</label>
            <input 
              type="text" 
              value={localSettings.modelName}
              onChange={(e) => setLocalSettings(prev => ({ ...prev, modelName: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-600 bg-slate-50"
            />
            <p className="text-xs text-slate-400 mt-1">
              {localSettings.provider === 'gemini' ? '推荐: gemini-2.5-flash-image' : '推荐: glm-4v-flash'}
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              API Key
            </label>
            <input 
              type="password" 
              value={localSettings.apiKey}
              onChange={(e) => setLocalSettings(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder={localSettings.provider === 'gemini' ? "AIzaSy..." : "例如 3624... (id.secret)"}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
            />
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              {localSettings.provider === 'gemini' ? (
                <>
                  需要在 Google AI Studio 获取 API Key。<br/>
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">点击获取 Gemini Key &rarr;</a>
                </>
              ) : (
                <>
                  需要在智谱 AI 开放平台获取 API Key。<br/>
                  <a href="https://bigmodel.cn/usercenter/apikeys" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">点击获取智谱 API Key &rarr;</a>
                </>
              )}
            </p>
          </div>
          
          <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100">
             <p className="text-xs text-yellow-700 flex gap-2">
               <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
               您的 API Key 仅存储在本地浏览器中，不会上传到任何服务器。
             </p>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={handleSave}>保存配置</Button>
        </div>
      </div>
    </div>
  );
};
