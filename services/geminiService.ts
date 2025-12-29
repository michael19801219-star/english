
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") throw new Error("API_KEY_MISSING");
  return new GoogleGenAI({ apiKey });
};

const SCHEMA = {
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
};

export const generateGrammarQuestions = async (count: number, targetPoints?: string[]): Promise<Question[]> => {
  const ai = getAI();
  
  let targetDesc = targetPoints && targetPoints.length > 0 
    ? `特别针对以下语法弱项进行命题：${targetPoints.join('、')}。` 
    : "涵盖时态、语态、非谓语、从句等高考核心考点。";

  const prompt = `你是一位高考英语名师。请生成 ${count} 道英语语法单选题。
  要求：
  1. 难度符合中国高考标准。
  2. 每道题必须有一个明确的考点。
  3. ${targetDesc}
  4. 重点：解析 (explanation) 部分必须使用中文，且逻辑清晰，指出考点、句意分析及为什么其他选项错误。
  5. 语法考点 (grammarPoint) 也请使用中文描述（例如：定语从句、现在完成时）。
  
  请直接返回符合 JSON 格式的数据。`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error: any) {
    console.error("Gemini Error:", error);
    if (error.message?.includes("fetch")) throw new Error("NETWORK_ERROR");
    throw error;
  }
};
