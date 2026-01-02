
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty, ChatMessage, WrongQuestion, GRAMMAR_POINTS } from "../types";

// 获取激活的 API KEY
const getActiveApiKey = () => {
  // 1. 优先尝试从本地持久化存储获取
  const localKey = localStorage.getItem('user_custom_gemini_key');
  if (localKey && localKey.startsWith('AIza')) return localKey;
  
  // 2. 其次尝试环境注入
  return process.env.API_KEY || "";
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
      translation: { type: Type.STRING },
      options: { type: Type.ARRAY, items: { type: Type.STRING } },
      answerIndex: { type: Type.INTEGER },
      explanation: { type: Type.STRING },
      grammarPoint: { 
        type: Type.STRING, 
        description: `必须从以下列表中精确选择一个：${GRAMMAR_POINTS.join('、')}` 
      },
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
    const key = getActiveApiKey();
    if (!key) throw new Error("API_KEY_MISSING");
    
    const ai = new GoogleGenAI({ apiKey: key });
    const pointsDesc = targetPoints.length > 0 ? `当前专项考点：${targetPoints.join('、')}。` : "涵盖高考核心考点。";
    
    const prompt = `你是一位资深高考英语名师。请生成 ${count} 道英语语法填空选择题。
    
    严格要求：
    1. 【考点对齐】：每道题目的 "grammarPoint" 字段必须严格等于以下列表中的其中一个字符串：
       ${GRAMMAR_POINTS.join(', ')}
    2. 【难度】：${difficulty}，内容描述：${pointsDesc}`;

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
    const key = getActiveApiKey();
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: TARGET_MODEL,
      contents: `题目背景：${questionContext.question}\n我的疑问：${userQuery}`,
      config: { 
        temperature: 0.5, 
        systemInstruction: "你是一位极其耐心的英语老师，请详细解答学生的疑问。" 
      }
    });
    return response.text || "老师正在组织语言...";
  });
};

export const getGrammarDeepDive = async (
  pointName: string,
  wrongQuestions: WrongQuestion[]
): Promise<{ lecture: string; mistakeAnalysis: string; tips: string[] }> => {
  return withRetry(async () => {
    const key = getActiveApiKey();
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: TARGET_MODEL,
      contents: `考点：${pointName}。分析错题并提供总结讲义。`,
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
