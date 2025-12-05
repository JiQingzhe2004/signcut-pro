import React from 'react';
import { Button } from './Button';
import { Theme } from '../types';
import { X, Check } from 'lucide-react';

interface AiHelpModalProps {
  onClose: () => void;
  theme: Theme;
}

export const AiHelpModal: React.FC<AiHelpModalProps> = ({ onClose, theme }) => {
  const isCyber = theme === 'cyberpunk';
  const bgClass = isCyber ? 'bg-slate-900 border border-slate-800 text-slate-300' : 'bg-white text-slate-600';
  const titleClass = isCyber ? 'text-cyan-400' : 'text-slate-900';
  const codeClass = isCyber ? 'bg-slate-950 text-cyan-300 border-slate-800' : 'bg-slate-100 text-slate-800 border-slate-200';
  const scrollbarClass = isCyber 
    ? 'scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900' 
    : 'scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
      <div className={`relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden ${bgClass}`}>
        <div className="flex items-center justify-between p-6 pb-4 shrink-0 border-b border-slate-200/10">
          <h2 className={`text-xl font-bold ${titleClass}`}>如何配置通用 AI？</h2>
          <button onClick={onClose} className="p-2 hover:bg-black/10 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className={`p-6 pt-4 overflow-y-auto ${scrollbarClass}`}>
          <div className="space-y-6 text-sm leading-relaxed">
            <section>
              <h3 className={`text-base font-bold mb-2 ${isCyber ? 'text-white' : 'text-slate-800'}`}>1. 什么是通用 AI 配置？</h3>
              <p>
                本工具支持接入任何兼容 OpenAI 接口标准的 AI 模型服务。
              </p>
              <p className="mt-2 font-medium">
                🤖 <strong>工作原理：</strong> AI 仅充当"视觉专家"，分析签名图片的噪点和笔迹粗细，<strong>返回最佳的提取参数</strong>（如二值化阈值），而非直接返回处理后的图片。最终的抠图处理仍由本地算法极速完成。
              </p>
            </section>

            <section>
              <h3 className={`text-base font-bold mb-2 ${isCyber ? 'text-white' : 'text-slate-800'}`}>2. 推荐配置 (以豆包 Doubao 为例)</h3>
              <p className="mb-3">
                豆包 (Doubao) 是字节跳动推出的高性能 AI 模型，具有优秀的视觉理解能力。
              </p>
              
              <div className="mb-4 p-4 rounded-lg border border-dashed border-slate-300/50 bg-slate-50/50">
                <div className="mb-3">
                  <div className={`font-bold mb-1 ${isCyber ? 'text-cyan-500' : 'text-blue-600'}`}>API Endpoint (接口地址)</div>
                  <div className="text-xs opacity-70 mb-1">火山引擎 (Volcengine) 提供的接入点：</div>
                  <code className={`block w-full px-2 py-1.5 rounded border break-all ${codeClass}`}>
                    https://ark.cn-beijing.volces.com/api/v3/chat/completions
                  </code>
                </div>

                <div className="mb-3">
                  <div className={`font-bold mb-1 ${isCyber ? 'text-cyan-500' : 'text-blue-600'}`}>Model Name (模型名称)</div>
                  <div className="text-xs opacity-70 mb-1">请确保选择支持 Vision (视觉) 的版本：</div>
                  <div className="flex flex-wrap gap-2">
                    <code className={`px-2 py-1 rounded border ${codeClass}`}>doubao-seed-1-6-251015</code>
                    <span className="text-xs self-center opacity-50">或</span>
                    <code className={`px-2 py-1 rounded border ${codeClass}`}>doubao-lite-4k-vision</code>
                  </div>
                  <div className="text-[10px] mt-1 text-red-500 opacity-80">
                    * 注意：必须填写您在火山引擎控制台创建的推理接入点 ID (Endpoint ID)，而非模型名称，通常格式为 `ep-2024...`
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 className={`text-base font-bold mb-2 ${isCyber ? 'text-white' : 'text-slate-800'}`}>3. 其他模型要求</h3>
              <div className={`p-3 rounded border-l-4 ${isCyber ? 'bg-yellow-900/20 border-yellow-500 text-yellow-200' : 'bg-yellow-50 border-yellow-500 text-yellow-800'}`}>
                <strong>关键提示：</strong> 您选择的模型必须支持 <strong>图片输入 (Vision)</strong> 能力。
              </div>
              <p className="mt-2">
                因为本工具需要将签名图片发送给 AI 进行分析，不支持视觉能力的纯文本模型（如 gpt-3.5-turbo, doubao-lite 等）将无法正常工作并会报错。
              </p>
              <p className="mt-2">
                <strong>2025 最新视觉模型推荐：</strong>
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs mt-1">
                <div className={`p-2 rounded border ${codeClass}`}>
                  <div className="font-bold">gpt-5</div>
                  <div className="opacity-70 scale-90 origin-left">OpenAI 旗舰视觉</div>
                </div>
                <div className={`p-2 rounded border ${codeClass}`}>
                  <div className="font-bold">claude-opus-4.5</div>
                  <div className="opacity-70 scale-90 origin-left">Anthropic 极致细节</div>
                </div>
                <div className={`p-2 rounded border ${codeClass}`}>
                  <div className="font-bold">gemini-2.5-pro</div>
                  <div className="opacity-70 scale-90 origin-left">Google 原生多模态</div>
                </div>
                <div className={`p-2 rounded border ${codeClass}`}>
                  <div className="font-bold">qwen-3-max</div>
                  <div className="opacity-70 scale-90 origin-left">通义千问 顶尖视觉</div>
                </div>
                <div className={`p-2 rounded border ${codeClass} col-span-2`}>
                  <div className="font-bold">grok-4-vision</div>
                  <div className="opacity-70 scale-90 origin-left">xAI 强力视觉推理</div>
                </div>
              </div>
            </section>

            <section>
              <h3 className={`text-base font-bold mb-2 ${isCyber ? 'text-white' : 'text-slate-800'}`}>4. 常见问题</h3>
              <ul className="list-disc pl-5 space-y-2 opacity-90">
                <li>如果豆包报错 400 Bad Request，通常是因为模型名称填错了（请填写 endpoint ID `ep-xxxxx`）。</li>
                <li>如果报错 "Image input not supported"，说明该模型不支持视觉功能。</li>
                <li>请确保 API Key 有足够的余额。</li>
              </ul>
            </section>
          </div>
        </div>

        <div className="p-6 pt-4 border-t border-slate-200/10 flex justify-end shrink-0">
           <Button onClick={onClose} theme={theme}>
             <Check className="w-4 h-4 mr-1" />
             明白了
           </Button>
        </div>
      </div>
    </div>
  );
};
