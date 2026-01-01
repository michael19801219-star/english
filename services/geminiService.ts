
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty, ChatMessage, WrongQuestion } from "../types";

// 获取当前有效的 API Key
const getActiveApiKey = () => {
  return process.env.API_KEY || (window as any).process?.env?.API_KEY || "";
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = JSON.stringify(error).toLowerCase();
    const errorMsg = error.message?.toLowerCase() || "";
    
    // 如果是实体未找到，可能是 Key 权限问题，抛出特定错误触发重新选 Key
    if (errorStr.includes('requested entity was not found') || errorMsg.includes('not found')) {
      throw new Error("KEY_INVALID_OR_NOT_FOUND");
    }

    const isQuotaError = errorStr.includes('429') || 
                        errorStr.includes('quota') || 
                        errorStr.includes('exhausted') ||
                        errorMsg.includes('429');

    if (isQuotaError && retries > 0) {
      const waitTime = (4 - retries) * 3000 + Math.random() * 2000;
      console.warn(`[API] 频率受限，${Math.round(waitTime/1000)}s 后重试...`);
      await delay(waitTime);
      return withRetry(fn, retries - 1);
    }
    
    if (isQuotaError) throw new Error("QUOTA_EXCEEDED");
    throw error;
  }
}

// 切换至 gemini-3 系列模型以获得更佳性能
const TARGET_MODEL = 'gemini-3-flash-preview';

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
    // 强制每次调用时新建实例，确保捕获最新的 API Key
    const ai = new GoogleGenAI({ apiKey: getActiveApiKey() });
    const pointsDesc = targetPoints.length > 0 ? `专项考点：${targetPoints.join('、')}。` : "涵盖高中核心考点（时态、从句、非谓语等）。";
    
    const prompt = `你是高考英语专家。请生成 ${count} 道单项填空题。
    难度：${difficulty}。
    内容：${pointsDesc}
    要求：符合最新高考英语命题逻辑，选项具有迷惑性，解析需精炼且包含中文翻译。
    返回标准 JSON 数组。`;

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
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getActiveApiKey() });
    const contextPrompt = `上下文题目：${questionContext.question}\n解析：${questionContext.explanation}\n学生追问：${userQuery}\n请作为名师提供专业的中文解答，字数控制在100字以内。`;
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
    const ai = new GoogleGenAI({ apiKey: getActiveApiKey() });
    const prompt = `深入讲解高中英语考点：“${pointName}”。
    学生最近错题参考：${wrongQuestions.slice(0, 2).map(q => q.question).join(' | ')}。
    请生成 JSON，包含：
    1. lecture (核心逻辑讲解)
    2. mistakeAnalysis (针对错题的典型陷阱分析)
    3. tips (3条高考抢分技巧)`;
    
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
