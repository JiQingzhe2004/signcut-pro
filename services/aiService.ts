
export const AI_CONFIG_STORAGE_KEY = 'ai_config';

export interface AIConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

export const getAIConfig = (): AIConfig => {
  const stored = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to parse AI config", e);
    }
  }
  return {
    endpoint: '',
    apiKey: '',
    model: ''
  };
};

export const saveAIConfig = (config: AIConfig) => {
  localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(config));
};

/**
 * Uses a generic OpenAI-compatible API to analyze the signature image.
 */
export const analyzeImageWithAI = async (
  imageFile: File | Blob
): Promise<{ recommendedSensitivity: number; reasoning: string }> => {
  
  const config = getAIConfig();
  if (!config.apiKey) {
    throw new Error("请先在设置中配置 AI API Key");
  }

  // Convert Blob/File to Base64
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      // Remove data:image/jpeg;base64, prefix if present for some APIs, 
      // but OpenAI format expects the full data url or just the base64 depending on implementation.
      // Standard OpenAI image_url supports "data:image/jpeg;base64,{base64_image}"
      resolve(res); 
    };
    reader.onerror = reject;
    reader.readAsDataURL(imageFile);
  });

  const systemPrompt = `
    You are an expert in image processing and handwritten signature extraction.
    I have a photo of a handwritten signature that needs to be binarized (background removed).
    
    Please analyze this image for:
    1. Lighting conditions (uniform, shadows, low contrast?)
    2. Ink contrast (faint, strong, bleeding?)
    3. Background noise (paper texture, lines, artifacts?)
    
    Based on this, suggest an optimal "sensitivity" threshold for an adaptive thresholding algorithm.
    - Range: 0 to 100.
    - 20 is standard.
    - Higher value (e.g. 40) = More aggressive background removal (good for noisy/shadowy images, but might lose faint strokes).
    - Lower value (e.g. 10) = Gentle removal (keeps faint strokes, but might keep noise).
    
    Return your response in pure JSON format without markdown code blocks:
    {
      "reasoning": "Brief explanation of what you see",
      "recommendedSensitivity": <number>
    }
  `;

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: systemPrompt },
              {
                type: "image_url",
                image_url: {
                  url: base64Data
                }
              }
            ]
          }
        ],
        max_tokens: 300,
        temperature: 0.1,
        response_format: { type: "json_object" } // Try to enforce JSON if supported
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI API Request Failed: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("AI returned empty response");
    }

    // Parse JSON
    let result;
    try {
        // Try parsing directly
        result = JSON.parse(content);
    } catch (e) {
        // If failed, try to extract from markdown code blocks
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            result = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        } else {
            throw new Error("Failed to parse AI response as JSON");
        }
    }

    return {
        recommendedSensitivity: typeof result.recommendedSensitivity === 'number' ? result.recommendedSensitivity : 20,
        reasoning: result.reasoning || "AI analysis completed."
    };

  } catch (error) {
    console.error("AI Analysis Failed:", error);
    throw error;
  }
};
