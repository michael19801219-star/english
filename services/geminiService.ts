
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty, ChatMessage, WrongQuestion } from "../types";

// 检测是否有个人选择的 Key
const hasUserSelectedKey = async () => {
  if (typeof window !== 'undefined' && (window as any).aistudio?.hasSelectedApiKey) {
    return await (window as any).aistudio.hasSelectedApiKey();
  }
  return false;
};

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
      const waitTime = (4 - retries) * 5000 + Math.random() * 3000;
      console.warn(`[API] 配额受限，${Math.round(waitTime/1000)}s 后重试...`);
      await delay(waitTime);
      return withRetry(fn, retries - 1);
    }
    
    if (isQuotaError) throw new Error("QUOTA_EXCEEDED");
    throw error;
  }
}

const TARGET_MODEL = 'gemini-flash-lite-latest';

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
  const apiKey = getActiveApiKey();
  if (!apiKey) throw new Error("API_KEY_MISSING");

  return withRetry(async () => {
    // 每次调用都重新实例化以确保获取最新的 Key
    const ai = new GoogleGenAI({ apiKey: getActiveApiKey() });
    const pointsDesc = targetPoints.length > 0 ? `专项考点：${targetPoints.join('、')}。` : "涵盖高中核心考点。";
    
    const prompt = `你是高考英语专家。请生成 ${count} 道单项填空题，难度：${difficulty}。${pointsDesc} 
    要求：符合高考命题逻辑，使用中文解析含翻译，正确答案分布均衡（A/B/C/D 概率均等）。
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
  const apiKey = getActiveApiKey();
  if (!apiKey) throw new Error("API_KEY_MISSING");

  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getActiveApiKey() });
    const contextPrompt = `针对高考英语题：${questionContext.question}\n正确答案：${questionContext.options[questionContext.answerIndex]}\n学生疑问：${userQuery}\n请作为名师提供简洁易懂的中文回答。`;
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
  const apiKey = getActiveApiKey();
  if (!apiKey) throw new Error("API_KEY_MISSING");

  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getActiveApiKey() });
    const prompt = `深入讲解考点：“${pointName}”。参考学生错题：${wrongQuestions.slice(0, 3).map(q => q.question).join('|')}。
    要求：全部中文返回，包含 lecture, mistakeAnalysis, 3条 tips。返回标准 JSON。`;
    
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
