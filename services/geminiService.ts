
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty, ChatMessage, WrongQuestion } from "../types";

const getActiveApiKey = () => {
  const localKey = localStorage.getItem('user_custom_gemini_key');
  if (localKey && localKey.startsWith('AIza')) return localKey;
  return process.env.API_KEY || (window as any).process?.env?.API_KEY || "";
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = JSON.stringify(error).toLowerCase();
    if ((errorStr.includes('429') || errorStr.includes('quota')) && retries > 0) {
      await delay(2000);
      return withRetry(fn, retries - 1);
    }
    throw error;
  }
}

const TARGET_MODEL = 'gemini-3-flash-preview';

const SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      question: { type: Type.STRING },
      translation: { type: Type.STRING }, // 新增
      options: { type: Type.ARRAY, items: { type: Type.STRING } },
      answerIndex: { type: Type.INTEGER },
      explanation: { type: Type.STRING },
      grammarPoint: { type: Type.STRING },
      difficulty: { type: Type.STRING }
    },
    required: ["id", "question", "translation", "options", "answerIndex", "explanation", "grammarPoint", "difficulty"]
  }
};

export const generateGrammarQuestions = async (
  count: number, 
  targetPoints: string[], 
  difficulty: Difficulty
): Promise<Question[]> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getActiveApiKey() });
    const pointsDesc = targetPoints.length > 0 ? `考点：${targetPoints.join('、')}。` : "涵盖高中考纲核心内容。";
    
    const prompt = `你是一位资深高考英语名师。请生成 ${count} 道英语语法填空选择题。
    要求：
    1. 难度：${difficulty}。
    2. ${pointsDesc}
    3. 解析必须使用【纯中文】，且深入浅出。
    4. 必须提供题目完整的【中文译文】(translation字段)。
    5. 选项和干扰项需具有高考迷惑性。`;

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
    const response = await ai.models.generateContent({
      model: TARGET_MODEL,
      contents: `针对该题目进行中文答疑：\n题目：${questionContext.question}\n译文：${questionContext.translation}\n学生的问题：${userQuery}`,
      config: { temperature: 0.5, systemInstruction: "你是一位耐心的英语老师，请使用中文回答。" }
    });
    return response.text || "请稍等，老师正在组织语言...";
  });
};

export const getGrammarDeepDive = async (
  pointName: string,
  wrongQuestions: WrongQuestion[]
): Promise<{ lecture: string; mistakeAnalysis: string; tips: string[] }> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getActiveApiKey() });
    const response = await ai.models.generateContent({
      model: TARGET_MODEL,
      contents: `请对考点“${pointName}”进行深度总结。结合这些错题：${wrongQuestions.map(q => q.question).join('\n')}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lecture: { type: Type.STRING, description: "核心考点精讲（中文）" },
            mistakeAnalysis: { type: Type.STRING, description: "常见错误原因分析（中文）" },
            tips: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3条高考解题技巧（中文）" }
          },
          required: ["lecture", "mistakeAnalysis", "tips"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  });
};
