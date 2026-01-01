
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty, ChatMessage, WrongQuestion } from "../types";

// 获取当前有效的 API Key
const getActiveApiKey = () => {
  return process.env.API_KEY || (window as any).process?.env?.API_KEY || "";
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = JSON.stringify(error).toLowerCase();
    const errorMsg = error.message?.toLowerCase() || "";
    
    // 识别密钥失效或过期 (HTTP 400)
    if (
      errorStr.includes('expired') || 
      errorStr.includes('invalid') || 
      errorStr.includes('key_invalid') ||
      errorMsg.includes('expired') ||
      errorMsg.includes('invalid')
    ) {
      throw new Error("KEY_EXPIRED");
    }

    // 识别实体未找到
    if (errorStr.includes('requested entity was not found') || errorMsg.includes('not found')) {
      throw new Error("KEY_NOT_FOUND");
    }

    // 识别配额限制 (HTTP 429)
    const isQuotaError = errorStr.includes('429') || 
                        errorStr.includes('quota') || 
                        errorStr.includes('exhausted') ||
                        errorMsg.includes('429');

    if (isQuotaError && retries > 0) {
      const waitTime = (4 - retries) * 3000 + Math.random() * 2000;
      console.warn(`[API] 频率受限，${Math.round(waitTime/1000)}s 后重试...`);
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
    const ai = new GoogleGenAI({ apiKey: getActiveApiKey() });
    const pointsDesc = targetPoints.length > 0 ? `专项考点：${targetPoints.join('、')}。` : "涵盖高考英语核心考点。";
    
    const prompt = `你是一位经验丰富的高考英语命题专家。
    任务：生成 ${count} 道符合高考大纲要求的英语语法填空（单项选择形式）题目。
    难度：${difficulty}。
    侧重考点：${pointsDesc}
    要求：
    1. 题干背景贴近高中生活或国际新闻，语言地道。
    2. 干扰项设计要具有典型性。
    3. 解析中包含中文翻译、核心考点说明及解题技巧。
    返回标准 JSON 数组。`;

    const response = await ai.models.generateContent({
      model: TARGET_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        temperature: 0.75
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
    const contextPrompt = `题目：${questionContext.question}\n正确答案选项：${questionContext.options[questionContext.answerIndex]}\n解析：${questionContext.explanation}\n学生问题：${userQuery}\n请用老师的口吻简明扼要地解答。`;
    const response = await ai.models.generateContent({
      model: TARGET_MODEL,
      contents: contextPrompt,
      config: { temperature: 0.5 }
    });
    return response.text || "解析生成中...";
  });
};

export const getGrammarDeepDive = async (
  pointName: string,
  wrongQuestions: WrongQuestion[]
): Promise<{ lecture: string; mistakeAnalysis: string; tips: string[] }> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getActiveApiKey() });
    const prompt = `深度解析高考考点：${pointName}。参考错题：${wrongQuestions.slice(0, 1).map(q => q.question).join(' ')}。
    要求：全部中文返回。`;
    
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
