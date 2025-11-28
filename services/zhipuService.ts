/**
 * Service to interact with Zhipu AI (GLM-4V)
 */
export const enhanceSignatureWithZhipu = async (
  base64Image: string,
  apiKey: string,
  model: string
): Promise<string> => {
  if (!apiKey) throw new Error("请在设置中配置智谱 AI API Key");
  
  // Guard: CogView is for Text-to-Image generation, not Chat/Vision analysis.
  if (model.toLowerCase().includes('cogview')) {
    throw new Error("CogView 模型用于‘文生图’，不支持图片修复/分析功能。请使用 glm-4v-flash 或其他视觉模型。");
  }

  const cleanApiKey = apiKey.trim();
  const ENDPOINT = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

  const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");
  const imageUrl = `data:image/png;base64,${cleanBase64}`;

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cleanApiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: imageUrl
                }
              },
              {
                type: "text",
                text: `任务：手写签名矢量化提取。
请提取这张图片中的黑色手写笔迹。
要求：
1. 输出一段标准的SVG代码 (<svg>...</svg>)。
2. SVG背景必须透明 (background: none)。
3. 笔迹颜色必须为纯黑色 (#000000)。
4. 仅返回SVG代码，不要包含Markdown格式或其他解释性文字。`
              }
            ]
          }
        ],
        max_tokens: 2048,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `智谱API请求失败: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    const svgMatch = content.match(/<svg[\s\S]*?<\/svg>/);
    
    if (svgMatch) {
      const svgString = svgMatch[0];
      const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
      return `data:image/svg+xml;base64,${svgBase64}`;
    }

    console.warn("Zhipu output not SVG:", content);
    throw new Error("模型未能生成有效的SVG图像数据，请重试或检查图片质量。");

  } catch (error: any) {
    console.error("Zhipu Enhancement Failed:", error);
    if (error.message.includes("ISO-8859-1")) {
      throw new Error("API Key 包含非法字符，请检查是否有多余空格。");
    }
    throw error;
  }
};

export const recognizeSignatureTextWithZhipu = async (
  base64Image: string,
  apiKey: string,
  model: string
): Promise<string> => {
  if (!apiKey) throw new Error("请在设置中配置智谱 AI API Key");

  // Guard against using generation models for analysis
  if (model.toLowerCase().includes('cogview')) {
    throw new Error("请使用 glm-4v 系列模型进行文字识别 (例如 glm-4v-flash)");
  }

  const cleanApiKey = apiKey.trim();
  const ENDPOINT = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
  const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");
  const imageUrl = `data:image/png;base64,${cleanBase64}`;

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cleanApiKey}`
      },
      body: JSON.stringify({
        model: model, 
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: imageUrl
                }
              },
              {
                type: "text",
                text: "请识别这张图片中的中文手写名字。只返回名字文本，不要包含任何标点符号、前缀或后缀。如果无法识别，请返回空字符串。"
              }
            ]
          }
        ],
        max_tokens: 100,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `识别请求失败: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    return text.replace(/['".,;。，：: ]/g, '').trim();

  } catch (error: any) {
    console.error("Zhipu Recognition Failed:", error);
    throw error;
  }
};