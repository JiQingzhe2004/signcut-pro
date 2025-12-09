import React from 'react';
import { Theme } from '../types';
import { Download } from 'lucide-react';

interface DownloadProgressProps {
  isDownloading: boolean;
  progress: number;
  total: number;
  theme: Theme;
}

export const DownloadProgress: React.FC<DownloadProgressProps> = ({
  isDownloading,
  progress,
  total,
  theme,
}) => {
  if (!isDownloading) return null;

  const isCyber = theme === 'cyberpunk';
  const percentage = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div
        className={`p-8 rounded-2xl shadow-2xl w-96 max-w-[90%] ${
          isCyber
            ? 'bg-slate-900 border border-cyan-500/30'
            : 'bg-white border border-slate-200'
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className={`p-3 rounded-full ${
              isCyber
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'bg-blue-100 text-blue-600'
            }`}
          >
            <Download className="w-6 h-6" />
          </div>
          <div>
            <h3
              className={`text-lg font-bold ${
                isCyber ? 'text-white' : 'text-slate-900'
              }`}
            >
              {isCyber ? '正在打包下载' : '批量下载中'}
            </h3>
            <p
              className={`text-sm ${
                isCyber ? 'text-cyan-300/70' : 'text-slate-500'
              }`}
            >
              {progress} / {total}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div
            className={`h-2 rounded-full overflow-hidden ${
              isCyber
                ? 'bg-slate-800 border border-cyan-500/20'
                : 'bg-slate-200 border border-slate-300'
            }`}
          >
            <div
              className={`h-full transition-all duration-300 ${
                isCyber
                  ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                  : 'bg-gradient-to-r from-blue-500 to-blue-400'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Percentage Text */}
        <div className="text-center">
          <p
            className={`text-2xl font-bold ${
              isCyber ? 'text-cyan-400' : 'text-blue-600'
            }`}
          >
            {percentage}%
          </p>
          <p
            className={`text-xs mt-2 ${
              isCyber ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {isCyber ? '正在处理文件...' : '正在处理文件...'}
          </p>
        </div>

        {/* Animated dots */}
        <div className="flex justify-center gap-1 mt-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${
                isCyber ? 'bg-cyan-500' : 'bg-blue-500'
              }`}
              style={{
                animation: `pulse 1.5s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }
      `}</style>
    </div>
  );
};
