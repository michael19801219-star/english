
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty, ChatMessage, WrongQuestion } from "../types";

// 兼容多种环境变量写法，确保 Vercel 注入成功
const getApiKey = () => {
  const key = process.env.API_KEY;
  if (!key || key === "undefined" || key === "") return null;
  return key;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = JSON.stringify(error).toLowerCase();
    const isQuotaError = errorStr.includes('429') || 
                        errorStr.includes('quota') || 
                        errorStr.includes('exhausted') ||
                        (error.message && error.message.includes('429'));

    if (isQuotaError && retries > 0) {
      // 阶梯式重试：3s -> 6s -> 12s
      const waitTime = (4 - retries) * 3000;
      console.log(`检测到频率限制，${waitTime/1000}秒后进行第 ${4-retries} 次重试...`);
      await delay(waitTime);
      return withRetry(fn, retries - 1);
    }
    
    if (isQuotaError) throw new Error("QUOTA_EXCEEDED");
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
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API_KEY_MISSING");

  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey });
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
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API_KEY_MISSING");

  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey });
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
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API_KEY_MISSING");

  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `分析考点“${pointName}”。错题参考：${wrongQuestions.map(q => q.question).join('|')}。返回核心逻辑、错因、3条Tips的JSON。`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
