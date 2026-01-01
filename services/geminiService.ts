
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty, ChatMessage, WrongQuestion } from "../types";

/**
 * 严格锁定 2.5 Lite 模型 ('gemini-flash-lite-latest')
 */
const TEXT_MODEL = 'gemini-flash-lite-latest';

const SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      question: { type: Type.STRING },
      translation: { type: Type.STRING }, 
      options: { type: Type.ARRAY, items: { type: Type.STRING } },
      answerIndex: { type: Type.INTEGER },
      explanation: { type: Type.STRING },
      grammarPoint: { type: Type.STRING },
      difficulty: { type: Type.STRING }
    },
    required: ["question", "translation", "options", "answerIndex", "explanation", "grammarPoint", "difficulty"]
  }
};

async function silentRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (i < attempts) {
        await new Promise(resolve => setTimeout(resolve, 800 * (i + 1)));
      }
    }
  }
  throw lastError;
}

/**
 * 获取 AI 实例的辅助函数，确保每次都从当前环境变量读取最新的 Key
 */
const getAIInstance = () => {
  // Fix: Strictly follow SDK guidelines for initializing GoogleGenAI with process.env.API_KEY
  return new GoogleGenAI({ apiKey: process.env.API_KEY as string });
};

export const generateGrammarQuestions = async (
  count: number, 
  targetPoints: string[], 
  difficulty: Difficulty,
  onProgress?: (msg: string) => void
): Promise<Question[]> => {
  return silentRetry(async () => {
    const ai = getAIInstance();
    const pointsDesc = targetPoints.length > 0 ? `重点考察：${targetPoints.join('、')}。` : "涵盖高考核心考点。";
    
    if (onProgress) onProgress("AI 正在构思题目...");

    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: `Generate ${count} multiple-choice English grammar questions for High School Students. Difficulty: ${difficulty}. ${pointsDesc}`,
      config: {
        systemInstruction: `You are a master English teacher. 
        Return a JSON array of objects. Output ONLY raw JSON. No markdown tags.`,
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        temperature: 0.5
      }
    });
    
    const text = response.text || "[]";
    try {
      const data = JSON.parse(text);
      return data.map((q: any, index: number) => ({
        ...q,
        id: `gen_${Date.now()}_${index}`
      }));
    } catch (e) {
      throw new Error("FORMAT_ERROR");
    }
  });
};

export const askFollowUpQuestion = async (
  questionContext: Question,
  history: ChatMessage[],
  userQuery: string
): Promise<string> => {
  return silentRetry(async () => {
    const ai = getAIInstance();
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: `Context: ${questionContext.question}. Query: "${userQuery}"`,
      config: { 
        systemInstruction: `You are an English tutor. Explain in Chinese.`,
        temperature: 0.7 
      }
    });
    return response.text || "抱歉，请再试一次。";
  }, 1);
};

export const getGrammarDeepDive = async (
  pointName: string,
  wrongQuestions: WrongQuestion[]
): Promise<{ lecture: string; mistakeAnalysis: string; tips: string[] }> => {
  return silentRetry(async () => {
    const ai = getAIInstance();
    const context = wrongQuestions.slice(0, 2).map(q => q.question).join('|');
    
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: `Point: "${pointName}". Examples: ${context}`,
      config: {
        systemInstruction: `Output JSON: lecture, mistakeAnalysis, tips (array). Use Chinese.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lecture: { type: Type.STRING },
            mistakeAnalysis: { type: Type.STRING },
            tips: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["lecture", "mistakeAnalysis", "tips"]
        },
        temperature: 0.3
      }
    });
    return JSON.parse(response.text || "{}");
  }, 1);
};
