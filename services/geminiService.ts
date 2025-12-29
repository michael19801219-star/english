
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

export const generateGrammarQuestions = async (count: number): Promise<Question[]> => {
  // 检查环境变量
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    console.error("Critical: API_KEY is missing from environment.");
    throw new Error("API_KEY_MISSING");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `你是一位高考英语命题专家。请生成 ${count} 道难度符合高考标准的英语语法单选题。
  覆盖：时态、语态、非谓语、从句。
  请直接返回 JSON 数组，解析部分使用中文且必须详尽。`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              answerIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING },
              grammarPoint: { type: Type.STRING }
            },
            required: ["id", "question", "options", "answerIndex", "explanation", "grammarPoint"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("EMPTY_RESPONSE");
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Gemini API Error details:", error);
    // 捕获网络错误
    if (error.message?.includes("fetch") || error.message?.includes("network")) {
      throw new Error("NETWORK_ERROR");
    }
    throw error;
  }
};
