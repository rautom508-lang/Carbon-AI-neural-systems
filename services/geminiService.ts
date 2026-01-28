
import { GoogleGenAI, Type } from "@google/genai";
import { CarbonPrediction } from "../types";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMsg = error?.message || "";
      const isRetryable = errorMsg.includes('429') || 
                          errorMsg.includes('RESOURCE_EXHAUSTED') ||
                          errorMsg.includes('500') ||
                          errorMsg.includes('503');
      if (isRetryable && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export const transformImage = async (base64Data: string, prompt: string): Promise<string | null> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: "image/jpeg" } },
          { text: prompt }
        ]
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  });
};

export interface MLForecast {
  predictedMonths: { month: string; value: number }[];
  confidenceScore: number;
  anomalyDetected: boolean;
  anomalyReason?: string;
  recommendation?: string;
}

export const getNeuralForecast = async (prediction: CarbonPrediction, history: CarbonPrediction[]): Promise<MLForecast | null> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const historicalContext = history
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-12)
      .map(h => ({ total: h.total, date: new Date(h.timestamp).toISOString().split('T')[0] }));

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Predict next 6 months. Input: ${prediction.total} kg. History: ${JSON.stringify(historicalContext)}. JSON format.`,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            predictedMonths: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  month: { type: Type.STRING },
                  value: { type: Type.NUMBER }
                },
                required: ["month", "value"]
              }
            },
            confidenceScore: { type: Type.NUMBER },
            anomalyDetected: { type: Type.BOOLEAN },
            anomalyReason: { type: Type.STRING },
            recommendation: { type: Type.STRING }
          },
          required: ["predictedMonths", "confidenceScore", "anomalyDetected"]
        }
      }
    });
    const text = response.text?.trim();
    return text ? JSON.parse(text) : null;
  });
};

export const getWhatIfSimulation = async (basePrediction: CarbonPrediction, variables: { evTransition: number, renewableEnergy: number, remoteWork: number }): Promise<any> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Simulation: Base ${basePrediction.total}kg. EV:${variables.evTransition}%, Renew:${variables.renewableEnergy}%, Work:${variables.remoteWork}%. 5yr JSON path.`,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            projectedPath: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  year: { type: Type.STRING },
                  currentTrajectory: { type: Type.NUMBER },
                  optimizedTrajectory: { type: Type.NUMBER }
                },
                required: ["year", "currentTrajectory", "optimizedTrajectory"]
              }
            },
            summary: { type: Type.STRING }
          },
          required: ["projectedPath", "summary"]
        }
      }
    });
    const text = response.text?.trim() || "{}";
    return JSON.parse(text);
  });
};

export const getLocationSustainability = async (query: string, location?: { lat: number, lng: number }): Promise<any> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Find and analyze sustainability facilities or recycling centers at: ${query}.`,
      config: {
        tools: [{ googleMaps: {} }, { googleSearch: {} }],
        toolConfig: location ? {
          retrievalConfig: {
            latLng: {
              latitude: location.lat,
              longitude: location.lng
            }
          }
        } : undefined
      },
    });
    return {
      text: response.text,
      groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks
    };
  });
};

export const processReceiptImage = async (base64Data: string): Promise<any> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: "image/jpeg" } },
          { text: "Extract: Vendor, Date, Category, Amount. JSON." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            vendor: { type: Type.STRING },
            date: { type: Type.STRING },
            category: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            currency: { type: Type.STRING },
            confidence: { type: Type.NUMBER }
          },
          required: ["vendor", "amount", "category", "confidence"]
        }
      }
    });
    const text = response.text?.trim();
    return text ? JSON.parse(text) : {};
  });
};

export const processUtilityBill = async (base64Data: string, mimeType: string = "image/jpeg"): Promise<any> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: "Extract kWh. JSON." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            provider: { type: Type.STRING },
            units: { type: Type.NUMBER },
            confidence: { type: Type.NUMBER }
          },
          required: ["provider", "units", "confidence"]
        }
      }
    });
    const text = response.text?.trim();
    return text ? JSON.parse(text) : {};
  });
};

export const processPUCCertificate = async (base64Data: string): Promise<any> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: "image/jpeg" } },
          { text: "Extract PUC Number and Certificate Number. JSON." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            pucNumber: { type: Type.STRING },
            certificateNo: { type: Type.STRING },
            confidence: { type: Type.NUMBER }
          },
          required: ["pucNumber", "certificateNo", "confidence"]
        }
      }
    });
    const text = response.text?.trim();
    return text ? JSON.parse(text) : {};
  });
};

export const getCarbonInsights = async (prediction: CarbonPrediction, history: CarbonPrediction[]): Promise<string> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze: ${JSON.stringify(prediction)}. Professional brief. Markdown.`,
    });
    return response.text || "Analysis interrupted.";
  });
};
