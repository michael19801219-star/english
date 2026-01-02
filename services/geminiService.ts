
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty, ChatMessage, WrongQuestion, GRAMMAR_POINTS } from "../types";

// 严格通过环境变量获取，不进行任何硬编码拼接
const getApiKey = () => process.env.API_KEY || "";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = JSON.stringify(error).toLowerCase();
    // 密钥相关错误处理
    if (errorStr.includes("not found") || errorStr.includes("invalid") || errorStr.includes("api_key_invalid")) {
        console.error("API Key 状态异常，请重新连接云项目");
    }
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
        description: `必须选一个：${GRAMMAR_POINTS.join('、')}` 
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
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const pointsDesc = targetPoints.length > 0 ? `考点：${targetPoints.join('、')}。` : "高考核心考点。";
    
    const prompt = `你是一位高考名师，请生成 ${count} 道英语语法填空单选题。考点限定在：${GRAMMAR_POINTS.join(', ')}。难度：${difficulty}。内容描述：${pointsDesc} 使用纯中文解析。`;

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
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
      model: TARGET_MODEL,
      contents: `题目背景：${questionContext.question}\n我的疑问：${userQuery}`,
      config: { 
        temperature: 0.5, 
        systemInstruction: "你是一位极有耐心的英语老师，请用中文详细解答学生的疑问。" 
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
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
      model: TARGET_MODEL,
      contents: `考点：${pointName}。分析错题：${wrongQuestions.map(q => q.question).join('\n')}`,
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
