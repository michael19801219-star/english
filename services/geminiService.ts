
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty, ChatMessage, WrongQuestion } from "../types";

// 获取 API Key 的稳健方法
const getApiKey = () => {
  // 优先级：VITE_API_KEY > API_KEY > window.process
  const key = process.env.API_KEY || (window as any).process?.env?.API_KEY;
  
  if (!key || key === "undefined" || key === "" || key.includes("process.env")) {
    console.error("检测到 API_KEY 缺失或未正确注入 Vercel 环境变量");
    return null;
  }
  return key;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
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
      console.warn(`[API] 频率受限，${Math.round(waitTime/1000)}s 后自动重试...`);
      await delay(waitTime);
      return withRetry(fn, retries - 1);
    }
    
    if (isQuotaError) throw new Error("QUOTA_EXCEEDED");
    throw error;
  }
}

// 修正后的模型名称
const TARGET_MODEL = 'gemini-flash-lite-latest';

// 高考英语语法题 JSON 结构定义
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
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API_KEY_MISSING");

  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey });
    const pointsDesc = targetPoints.length > 0 ? `专项考点：${targetPoints.join('、')}。` : "涵盖高中核心考点。";
    const prompt = `你是高考英语专家。请生成 ${count} 道单项填空题，难度：${difficulty}。${pointsDesc} 要求：符合高考命题逻辑，解析详尽且含翻译。返回标准 JSON 数组。`;

    const response = await ai.models.generateContent({
      model: TARGET_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        temperature: 0.7
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
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API_KEY_MISSING");

  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey });
    const contextPrompt = `针对高考英语题：${questionContext.question}\n正确答案：${questionContext.options[questionContext.answerIndex]}\n学生疑问：${userQuery}\n请作为名师提供简洁、易懂的回答。`;
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
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API_KEY_MISSING");

  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `深入讲解考点：“${pointName}”。参考学生之前的错题：${wrongQuestions.slice(0, 3).map(q => q.question).join('|')}。返回包含 lecture(核心逻辑), mistakeAnalysis(针对性错因), tips(3条避坑指南) 的 JSON。`;
    
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
