
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty, ChatMessage, WrongQuestion } from "../types";

// 优先级：本地手动输入的 Key > 环境变量
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
    const errorMsg = error.message?.toLowerCase() || "";
    
    // 识别密钥失效或过期 (HTTP 400/401/403)
    if (
      errorStr.includes('expired') || 
      errorStr.includes('invalid') || 
      errorStr.includes('key_invalid') ||
      errorMsg.includes('expired') ||
      errorMsg.includes('invalid') ||
      errorStr.includes('400') ||
      errorStr.includes('401')
    ) {
      throw new Error("KEY_EXPIRED");
    }

    // 识别配额限制 (HTTP 429)
    const isQuotaError = errorStr.includes('429') || 
                        errorStr.includes('quota') || 
                        errorStr.includes('exhausted') ||
                        errorMsg.includes('429');

    if (isQuotaError && retries > 0) {
      const waitTime = (4 - retries) * 2000 + Math.random() * 1000;
      await delay(waitTime);
      return withRetry(fn, retries - 1);
    }
    
    if (isQuotaError) throw new Error("QUOTA_EXCEEDED");
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
    const key = getActiveApiKey();
    if (!key) throw new Error("KEY_MISSING");
    
    const ai = new GoogleGenAI({ apiKey: key });
    const pointsDesc = targetPoints.length > 0 ? `考点：${targetPoints.join('、')}。` : "涵盖高中考纲。";
    
    const prompt = `你是高考命题组长。生成 ${count} 道英语语法单选题。难度：${difficulty}。${pointsDesc}`;

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
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getActiveApiKey() });
    const response = await ai.models.generateContent({
      model: TARGET_MODEL,
      contents: `题目：${questionContext.question}\n问题：${userQuery}`,
      config: { temperature: 0.5 }
    });
    return response.text || "正在思考...";
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
      contents: `解析考点：${pointName}`,
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
