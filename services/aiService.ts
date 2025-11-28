import { AISettings } from '../types';
import { enhanceSignatureWithGemini, recognizeSignatureTextWithGemini } from './geminiService';
import { enhanceSignatureWithZhipu, recognizeSignatureTextWithZhipu } from './zhipuService';

export const enhanceSignature = async (
  base64Image: string,
  settings: AISettings
): Promise<string> => {
  if (!settings.apiKey) {
    throw new Error("请点击右上角设置图标，配置您的 API Key");
  }

  switch (settings.provider) {
    case 'gemini':
      return enhanceSignatureWithGemini(base64Image, settings.apiKey, settings.modelName);
    case 'zhipu':
      return enhanceSignatureWithZhipu(base64Image, settings.apiKey, settings.modelName);
    default:
      throw new Error("不支持的 AI 服务商");
  }
};

export const recognizeSignatureText = async (
  base64Image: string,
  settings: AISettings
): Promise<string> => {
  if (!settings.apiKey) {
    throw new Error("请先配置 API Key");
  }

  switch (settings.provider) {
    case 'gemini':
      return recognizeSignatureTextWithGemini(base64Image, settings.apiKey, settings.modelName);
    case 'zhipu':
      return recognizeSignatureTextWithZhipu(base64Image, settings.apiKey, settings.modelName);
    default:
      return "";
  }
};