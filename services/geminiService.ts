
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

export const generateGrammarQuestions = async (count: number): Promise<Question[]> => {
  // 直接从 process.env.API_KEY 读取，系统会自动注入
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined") {
    throw new Error("API_KEY_MISSING");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `你是一位高考英语名师。请生成 ${count} 道难度适中的英语语法单选题（符合中国高考标准）。
  涵盖核心考点：时态、非谓语、从句。
  返回纯 JSON 格式。`;

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

    return JSON.parse(response.text || "[]");
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
