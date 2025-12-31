
// DO NOT use or import the types below from `@google/genai`; these are deprecated APIs and no longer work.
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty, ChatMessage, WrongQuestion } from "../types";

const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") throw new Error("API_KEY_MISSING");
  return new GoogleGenAI({ apiKey });
};

// 辅助函数：延迟执行
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 带有自动重试机制的请求封装
async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isQuotaError = error.message?.includes('429') || error.message?.includes('quota');
    if (isQuotaError && retries > 0) {
      // 遇到配额限制，等待时间随重试次数递增 (2s, 5s)
      const waitTime = retries === 2 ? 2000 : 5000;
      await delay(waitTime);
      return withRetry(fn, retries - 1);
    }
    throw error;
  }
}

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
    const ai = getAI();
    const pointsDesc = targetPoints.length > 0 ? `专项考点：${targetPoints.join('、')}。` : "全考点。";
    const prompt = `生成 ${count} 道高考英语语法单选题，难度：${difficulty}。${pointsDesc} 解析需包含翻译。返回纯 JSON。`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA
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
    const ai = getAI();
    const contextPrompt = `针对题目：${questionContext.question}，回答学生疑问：${userQuery}。简洁专业。`;
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: contextPrompt
    });
    return response.text || "老师正在组织语言...";
  });
};

export const getGrammarDeepDive = async (
  pointName: string,
  wrongQuestions: WrongQuestion[]
): Promise<{ lecture: string; mistakeAnalysis: string; tips: string[] }> => {
  return withRetry(async () => {
    const ai = getAI();
    const prompt = `分析考点“${pointName}”。错题参考：${wrongQuestions.map(q => q.question).join('|')}。返回核心逻辑、错因、3条Tips的JSON。`;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite-latest",
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
