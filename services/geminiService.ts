
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty, ChatMessage, WrongQuestion, GRAMMAR_POINTS } from "../types";

// 获取运行时注入的 API KEY
const getApiKey = () => {
  // 优先尝试从 process.env 获取，这是 AI Studio 的注入标准
  try {
    return process.env.API_KEY || "";
  } catch (e) {
    return "";
  }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = JSON.stringify(error).toLowerCase();
    const message = error.message || "";
    
    // 如果是密钥未找到或失效，抛出特定标识
    if (message.includes("not found") || message.includes("API key not valid") || errorStr.includes("api_key_invalid")) {
      throw new Error("AUTH_ERROR");
    }
    
    // 网络连接失败（通常是无法访问 googleapis.com）
    if (message.includes("Failed to fetch") || errorStr.includes("network error")) {
      throw new Error("NETWORK_ERROR");
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
    const key = getApiKey();
    if (!key) throw new Error("AUTH_ERROR");

    const ai = new GoogleGenAI({ apiKey: key });
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
    const key = getApiKey();
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: TARGET_MODEL,
      contents: `题目：${questionContext.question}\n我的疑问：${userQuery}`,
      config: { 
        temperature: 0.5, 
        systemInstruction: "你是一位极有耐心的英语老师，请用中文详细解答学生的疑问。" 
      }
    });
    return response.text || "老师正在组织语言...";
  });
};

// Fix for error in components/ReviewView.tsx: Module '"../services/geminiService"' has no exported member 'getGrammarDeepDive'.
// Added getGrammarDeepDive to provide personalized AI analysis of specific grammar points based on a user's wrong questions.
export const getGrammarDeepDive = async (
  point: string,
  questions: WrongQuestion[]
): Promise<{ lecture: string; mistakeAnalysis: string; tips: string[] }> => {
  return withRetry(async () => {
    const key = getApiKey();
    if (!key) throw new Error("AUTH_ERROR");

    const ai = new GoogleGenAI({ apiKey: key });
    
    // Select a few recent wrong questions to give the AI context for analysis
    const contextText = questions.slice(0, 5).map(q => 
      `题目: ${q.question}\n解析: ${q.explanation}`
    ).join('\n\n');

    const prompt = `你是一位资深高考英语专家。针对考点“${point}”，结合学生以下的典型错题，请生成一份深度学习分析报告：\n\n${contextText}\n\n请按 JSON 格式返回以下字段：
    1. lecture: 考点精讲（核心语法规则，透彻且易懂）；
    2. mistakeAnalysis: 错因总结（分析学生为什么容易在这里出错）；
    3. tips: 提分技巧（实用的做题策略，数组形式，至少提供3条）。`;

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
            tips: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            }
          },
          required: ["lecture", "mistakeAnalysis", "tips"]
        },
        temperature: 0.5
      }
    });

    const text = response.text;
    if (!text) throw new Error("EMPTY_RESPONSE");
    return JSON.parse(text);
  });
};
