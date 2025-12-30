
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty } from "../types";

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

export const generateGrammarQuestions = async (
  count: number, 
  targetPoints: string[], 
  difficulty: Difficulty
): Promise<Question[]> => {
  const ai = getAI();
  
  const difficultyMap: Record<Difficulty, string> = {
    '简单': '基础高频考点，题干简短，干扰项特征明显。',
    '中等': '标准高考难度，包含综合考点和适度干扰。',
    '较难': '高难模拟难度，题干较长且包含复杂从句，考查细微语法区别。'
  };

  const pointsDesc = targetPoints.length > 0 
    ? `特别针对以下语法点进行命题：${targetPoints.join('、')}。` 
    : "涵盖高考全考点。";

  const prompt = `你是一位高考英语命题专家。请生成 ${count} 道英语语法单选题。
  要求：
  1. 难度设定为：${difficulty}。要求：${difficultyMap[difficulty]}
  2. ${pointsDesc}
  3. 考点 (grammarPoint) 必须使用中文。
  4. 解析 (explanation) 必须包含：【考点直击】、【句意翻译】、【选项剖析】。
  5. 返回纯 JSON 格式。`;

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
    throw error;
  }
};
