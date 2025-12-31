
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty, ChatMessage, WrongQuestion } from "../types";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  // 预检 API KEY
  if (!process.env.API_KEY) {
    throw new Error("API_KEY_MISSING");
  }

  try {
    return await fn();
  } catch (error: any) {
    const errorStr = JSON.stringify(error).toLowerCase();
    
    // 处理 404 错误（模型名称错误）
    if (errorStr.includes('404') || errorStr.includes('not_found')) {
      throw new Error("MODEL_NOT_FOUND");
    }

    const isQuotaError = errorStr.includes('429') || 
                        errorStr.includes('quota') || 
                        errorStr.includes('exhausted') ||
                        (error.message && error.message.includes('429'));

    if (isQuotaError && retries > 0) {
      const waitTime = (4 - retries) * 4000 + Math.random() * 2000;
      await delay(waitTime);
      return withRetry(fn, retries - 1);
    }
    
    if (isQuotaError) throw new Error("QUOTA_EXCEEDED");
    
    // 如果 SDK 抛出 Key 相关的原始错误也进行转换
    if (error.message && error.message.includes("API Key")) {
      throw new Error("API_KEY_MISSING");
    }

    throw error;
  }
}

const TARGET_MODEL = 'gemini-3-pro-preview';

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
      grammarPoint: { type: Type.STRING },
      difficulty: { type: Type.STRING }
    },
    required: ["id", "question", "options", "answerIndex", "explanation", "grammarPoint", "difficulty"]
  }
};

export const generateGrammarQuestions = async (
  count: number, 
  targetPoints: string[], 
  difficulty: Difficulty
): Promise<Question[]> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const pointsDesc = targetPoints.length > 0 ? `专项考点：${targetPoints.join('、')}。` : "涵盖高中核心考点。";
    
    const prompt = `你是高考英语专家。请生成 ${count} 道单项填空题，难度：${difficulty}。${pointsDesc} 
    要求：
    1. 符合高考命题逻辑。
    2. 请务必使用中文提供详尽的解析且含翻译。
    3. 特别注意：确保正确答案（answerIndex）在 0-3 之间分布均衡。
    返回标准 JSON 数组。`;

    const response = await ai.models.generateContent({
      model: TARGET_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        temperature: 0.8
      }
    });
    return JSON.parse(response.text || "[]");
  });
};

export const askFollowUpQuestion = async (
  questionContext: Question,
  history: ChatMessage[],
  userQuery: string
): Promise<string> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const contextPrompt = `针对高考英语题：${questionContext.question}\n正确答案：${questionContext.options[questionContext.answerIndex]}\n学生疑问：${userQuery}\n请作为名师提供简洁易懂的中文答疑。`;
    const response = await ai.models.generateContent({
      model: TARGET_MODEL,
      contents: contextPrompt,
      config: { temperature: 0.5 }
    });
    return response.text || "老师正在组织语言...";
  });
};

export const getGrammarDeepDive = async (
  pointName: string,
  wrongQuestions: WrongQuestion[]
): Promise<{ lecture: string; mistakeAnalysis: string; tips: string[] }> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const prompt = `深入讲解高中英语考点：“${pointName}”。参考错题：${wrongQuestions.slice(0, 3).map(q => q.question).join('|')}。
    要求：全部使用中文。包含核心讲义、错因分析和3条避坑指南。
    返回标准 JSON 对象。`;
    
    const response = await ai.models.generateContent({
      model: TARGET_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lecture: { type: Type.STRING },
            mistakeAnalysis: { type: Type.STRING },
            tips: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["lecture", "mistakeAnalysis", "tips"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  });
};
