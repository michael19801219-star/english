
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty, ChatMessage, WrongQuestion } from "../types";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = JSON.stringify(error).toLowerCase();
    const isQuotaError = errorStr.includes('429') || errorStr.includes('quota');

    if (isQuotaError && retries > 0) {
      await delay(2000 * (4 - retries));
      return withRetry(fn, retries - 1);
    }
    throw error;
  }
}

// Select Gemini 3 models based on task type
const FLASH_MODEL = 'gemini-3-flash-preview';
const PRO_MODEL = 'gemini-3-pro-preview';

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
    // Always use named parameter for apiKey and direct process.env.API_KEY
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pointsDesc = targetPoints.length > 0 ? `考察考点：${targetPoints.join('、')}。` : "涵盖高考核心语法考点。";
    
    const prompt = `你是一位高考英语命题专家。请生成 ${count} 道单项填空练习题。
    难度：${difficulty}。
    考点：${pointsDesc}
    
    要求：
    1. 题目情景要贴近生活，逻辑性强。
    2. 提供详尽的中文解析。
    3. 选项 A, B, C, D 必须是 4 个。
    4. 严格按照 JSON 数组格式返回，不要包含任何 Markdown 说明文字。`;

    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        temperature: 0.7
      }
    });
    
    // Access response text directly from .text property
    const data = JSON.parse(response.text || "[]");
    return data.map((q: any) => ({
      ...q,
      id: q.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }));
  });
};

export const askFollowUpQuestion = async (
  questionContext: Question,
  history: ChatMessage[],
  userQuery: string
): Promise<string> => {
  return withRetry(async () => {
    // Always use named parameter for apiKey and direct process.env.API_KEY
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const contextPrompt = `上下文：题目是 "${questionContext.question}"，正确选项是 "${questionContext.options[questionContext.answerIndex]}"。
    学生问："${userQuery}"
    请用通俗易懂的方式解答，语气鼓励且专业。`;
    const response = await ai.models.generateContent({
      model: PRO_MODEL, // Use Pro model for complex educational Q&A
      contents: contextPrompt,
      config: { temperature: 0.6 }
    });
    // Access response text directly from .text property
    return response.text || "老师正在组织语言，请稍后再试。";
  });
};

export const getGrammarDeepDive = async (
  pointName: string,
  wrongQuestions: WrongQuestion[]
): Promise<{ lecture: string; mistakeAnalysis: string; tips: string[] }> => {
  return withRetry(async () => {
    // Always use named parameter for apiKey and direct process.env.API_KEY
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `请深度讲解高中语法考点：“${pointName}”。
    基于以下错题提供针对性建议：${wrongQuestions.slice(0, 2).map(q => q.question).join('|')}。
    要求返回 JSON 对象，包含讲义(lecture)、错因分析(mistakeAnalysis)和避坑技巧(tips)。`;
    
    const response = await ai.models.generateContent({
      model: PRO_MODEL, // Use Pro model for advanced reasoning and lecture generation
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
    // Access response text directly from .text property
    return JSON.parse(response.text || "{}");
  });
};
