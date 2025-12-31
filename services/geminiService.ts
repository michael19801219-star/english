
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty, ChatMessage, WrongQuestion } from "../types";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 增强型重试函数
 * @param onRetry 每次重试时的回调，用于更新 UI 状态
 */
async function withRetry<T>(
  fn: () => Promise<T>, 
  retries = 6, 
  onRetry?: (count: number, nextWait: number) => void
): Promise<T> {
  const maxRetries = retries;
  
  const execute = async (attempt: number): Promise<T> => {
    try {
      return await fn();
    } catch (error: any) {
      const errorStr = JSON.stringify(error).toLowerCase();
      const isQuota = errorStr.includes('429') || errorStr.includes('quota');
      const isServerErr = errorStr.includes('500') || errorStr.includes('503') || errorStr.includes('504');

      if ((isQuota || isServerErr) && attempt < maxRetries) {
        // 指数退避 + 随机抖动 (Jitter)
        // 429 错误需要更长的等待时间来恢复配额
        const baseWait = isQuota ? 5000 : 2000;
        const waitTime = Math.min(baseWait * Math.pow(2, attempt) + Math.random() * 1000, 30000);
        
        if (onRetry) onRetry(attempt + 1, Math.round(waitTime / 1000));
        
        console.warn(`[AI服务] 第 ${attempt + 1} 次重试中，等待 ${Math.round(waitTime)}ms...`);
        await delay(waitTime);
        return execute(attempt + 1);
      }
      throw error;
    }
  };

  return execute(0);
}

// 使用推荐的 Gemini 3 Flash 模型进行基础文本任务
const TEXT_MODEL = 'gemini-3-flash-preview';

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
  difficulty: Difficulty,
  onProgress?: (msg: string) => void
): Promise<Question[]> => {
  return withRetry(async () => {
    // 每次调用前实例化，确保获取最新配置
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pointsDesc = targetPoints.length > 0 ? `重点考察：${targetPoints.join('、')}。` : "涵盖高考核心考点。";
    
    // 调用 generateContent 接口
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: `生成 ${count} 道单项填空练习题。难度：${difficulty}。${pointsDesc}`,
      config: {
        systemInstruction: `你是一位高考英语名师。
        1. 题目语境真实，符合高考逻辑。
        2. 解析需包含结构分析和关键词提示。
        3. 仅返回 JSON 数据，不带 Markdown 格式。`,
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        temperature: 0.4,
        candidateCount: 1
      }
    });
    
    // 直接访问 text 属性
    const text = response.text || "[]";
    try {
      const data = JSON.parse(text);
      if (!Array.isArray(data) || data.length === 0) throw new Error("EMPTY_DATA");
      return data;
    } catch (e) {
      throw new Error("FORMAT_ERROR");
    }
  }, 6, (count, nextWait) => {
    if (onProgress) onProgress(`AI 正在排队中 (第 ${count} 次重试)，约 ${nextWait} 秒后再次尝试...`);
  });
};

export const askFollowUpQuestion = async (
  questionContext: Question,
  history: ChatMessage[],
  userQuery: string
): Promise<string> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: `针对题目的追问："${userQuery}"`,
      config: { 
        systemInstruction: `你是英语助教。针对题目: ${questionContext.question}，回答学生疑问。`,
        temperature: 0.7 
      }
    });
    // 使用 response.text 属性获取文本
    return response.text || "老师正在组织语言，请再问一遍。";
  }, 2);
};

export const getGrammarDeepDive = async (
  pointName: string,
  wrongQuestions: WrongQuestion[]
): Promise<{ lecture: string; mistakeAnalysis: string; tips: string[] }> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const context = wrongQuestions.slice(0, 2).map(q => q.question).join('|');
    
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: `生成“${pointName}”的精讲。错题案例：${context}`,
      config: {
        systemInstruction: `输出 JSON 复习讲义：lecture(讲解), mistakeAnalysis(易错点), tips(3个技巧数组)。`,
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
        temperature: 0.2
      }
    });
    // 访问 response.text 属性
    return JSON.parse(response.text || "{}");
  }, 3);
};
