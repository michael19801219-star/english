
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty, ChatMessage, WrongQuestion } from "../types";

// Removed getApiKey as process.env.API_KEY should be used directly per guidelines
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

// Updated to gemini-3-pro-preview for complex reasoning tasks (High School Exam Questions)
const TARGET_MODEL = 'gemini-3-pro-preview';

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
  return withRetry(async () => {
    // Initializing with process.env.API_KEY directly as required by guidelines
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const pointsDesc = targetPoints.length > 0 ? `专项考点：${targetPoints.join('、')}。` : "涵盖高中核心考点。";
    
    // 明确要求中文解析，并增加答案均衡性的指令
    const prompt = `你是高考英语专家。请生成 ${count} 道单项填空题，难度：${difficulty}。${pointsDesc} 
    要求：
    1. 符合高考命题逻辑。
    2. 请务必使用中文提供详尽的解析且含翻译。
    3. 特别注意：确保正确答案（answerIndex）在 0, 1, 2, 3 (即 A, B, C, D) 之间分布均衡，严禁所有题目或大部分题目的答案都集中在同一个选项位置。
    返回标准 JSON 数组。`;

    const response = await ai.models.generateContent({
      model: TARGET_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        temperature: 0.8 // 稍微调高温度有助于答案分布的随机性
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
    // 明确要求中文答疑
    const contextPrompt = `针对高考英语题：${questionContext.question}\n正确答案：${questionContext.options[questionContext.answerIndex]}\n学生疑问：${userQuery}\n请作为名师提供简洁、易懂的中文回答。不要使用英文回复（除非是举例）。`;
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
    // 重点：要求 JSON 内容必须是中文
    const prompt = `深入讲解考点：“${pointName}”。参考学生之前的错题：${wrongQuestions.slice(0, 3).map(q => q.question).join('|')}。
    要求：
    1. 所有返回的内容（lecture, mistakeAnalysis, tips）必须全部使用中文。
    2. lecture 需包含核心语法逻辑。
    3. mistakeAnalysis 需分析学生为什么会错。
    4. tips 提供3条避坑指南。
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
