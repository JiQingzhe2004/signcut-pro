import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['logo.svg', 'logo.ico', 'opencv.js'],
          manifest: {
            name: 'SignCut Pro - 专业签名提取工具',
            short_name: 'SignCut',
            description: '专业的在线签名提取与编辑工具，支持AI自动识别、智能去背与手动精修，让您的电子签名清晰完美。',
            theme_color: '#ffffff',
            background_color: '#ffffff',
            display: 'standalone',
            icons: [
              {
                src: 'logo.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'any maskable'
              },
              {
                src: 'logo.ico',
                sizes: '64x64 32x32 24x24 16x16',
                type: 'image/x-icon'
              }
            ]
          },
          workbox: {
            maximumFileSizeToCacheInBytes: 12 * 1024 * 1024 // 12MB to accommodate opencv.js
          }
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
