
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

// 使用最新推荐模型
const FLASH_MODEL = 'gemini-3-flash-preview';

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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pointsDesc = targetPoints.length > 0 ? `考察考点：${targetPoints.join('、')}。` : "涵盖高考核心语法考点。";
    
    const prompt = `你是一位高考英语命题专家。请生成 ${count} 道单项填空练习题。
    难度：${difficulty}。
    考点：${pointsDesc}
    
    要求：
    1. 题目情景要贴近生活，逻辑性强。
    2. 提供详尽的中文解析。
    3. 选项 A, B, C, D 必须是 4 个。
    4. 严格按照 JSON 数组格式返回。`;

    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        temperature: 0.7
      }
    });
    
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const contextPrompt = `上下文：题目是 "${questionContext.question}"，正确选项是 "${questionContext.options[questionContext.answerIndex]}"。
    学生问："${userQuery}"
    请作为一位富有耐心的英语老师进行解答。`;
    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents: contextPrompt,
      config: { temperature: 0.6 }
    });
    return response.text || "老师正在组织语言，请稍后再试。";
  });
};

export const getGrammarDeepDive = async (
  pointName: string,
  wrongQuestions: WrongQuestion[]
): Promise<{ lecture: string; mistakeAnalysis: string; tips: string[] }> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `你是高考英语名师。请针对语法考点“${pointName}”生成深度复习讲义。
    已知学生的典型错题情景：${wrongQuestions.slice(0, 3).map(q => q.question).join('|')}。
    要求返回 JSON 对象，必须包含：
    1. lecture: 系统讲解该语法规则（约200字）。
    2. mistakeAnalysis: 分析学生在这类题上为什么容易错（约100字）。
    3. tips: 3条简练的考场避坑口诀或技巧（数组格式）。`;
    
    const response = await ai.models.generateContent({
      model: FLASH_MODEL, // 切换到 Flash 模型提高解析稳定性
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
        },
        temperature: 0.5
      }
    });
    return JSON.parse(response.text || "{}");
  });
};
