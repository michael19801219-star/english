
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

export const generateGrammarQuestions = async (count: number): Promise<Question[]> => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined") {
    console.error("API_KEY is missing! Please check your Vercel Environment Variables.");
    throw new Error("API密钥未配置，请在Vercel后台设置环境变量 API_KEY");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `Generate ${count} professional high school level English grammar multiple-choice questions suitable for China's GaoKao (National College Entrance Examination). 
  Focus on common test points: Verb Tenses, Non-finite Verbs, Relative Clauses, Noun Clauses, Prepositions, and Conjunctions. 
  Each question must have exactly 4 options. 
  Return a JSON array of objects.
  The explanation must be in Chinese and very detailed.`;

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
              options: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                minItems: 4,
                maxItems: 4
              },
              answerIndex: { type: Type.INTEGER, description: "0-3 index of correct option" },
              explanation: { type: Type.STRING, description: "Detailed explanation in Chinese" },
              grammarPoint: { type: Type.STRING, description: "The specific grammar rule tested" }
            },
            required: ["id", "question", "options", "answerIndex", "explanation", "grammarPoint"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("AI 返回了空内容");
    
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    // 捕获 API 具体的错误信息并抛出
    throw new Error(error?.message || "请求 AI 失败");
  }
};
