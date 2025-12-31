
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty, ChatMessage, WrongQuestion } from "../types";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = JSON.stringify(error).toLowerCase();
    // 捕获频率限制(429)和常见的服务器临时错误(500, 502, 503, 504)
    const isRetryable = 
      errorStr.includes('429') || 
      errorStr.includes('quota') || 
      errorStr.includes('500') || 
      errorStr.includes('503') ||
      errorStr.includes('504');

    if (isRetryable && retries > 0) {
      // 指数退避重试
      await delay(2000 * (4 - retries));
      return withRetry(fn, retries - 1);
    }
    throw error;
  }
}

// 使用推荐的 Gemini 3 系列模型处理复杂任务
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
  difficulty: Difficulty
): Promise<Question[]> => {
  return withRetry(async () => {
    // 遵守规范：每次请求创建新实例，并直接使用 process.env.API_KEY
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pointsDesc = targetPoints.length > 0 ? `考察考点：${targetPoints.join('、')}。` : "涵盖高考核心语法考点。";
    
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: `请现在立即生成 ${count} 道单项填空练习题。难度设定为：${difficulty}。${pointsDesc}`,
      config: {
        systemInstruction: `你是一位专业的高考英语命题专家。
        你的任务是生成高质量的语法单项填空题。
        规则：
        1. 题目情景必须贴近高中生活或现代社会。
        2. 每题必须有 A, B, C, D 四个选项。
        3. 提供精准的中文解析。
        4. 必须严格遵循提供的 JSON Schema 格式返回数据。
        5. 避免生成重复或逻辑错误的题目。`,
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        temperature: 0.4,
        topP: 0.95
      }
    });
    
    // 遵守规范：使用 .text 属性获取结果
    const text = response.text || "[]";
    try {
      const data = JSON.parse(text) as any[];
      return data.map((q: any) => ({
        ...q,
        id: q.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      })) as Question[];
    } catch (e) {
      console.error("JSON Parsing failed, content:", text);
      throw new Error("FORMAT_ERROR");
    }
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
      contents: `学生问："${userQuery}"`,
      config: { 
        systemInstruction: `你是一位耐心的英语老师。当前正在讨论的题目是 "${questionContext.question}"，正确选项是 "${questionContext.options[questionContext.answerIndex]}"。
        请根据上下文和学生的疑问进行简洁明了的解答。`,
        temperature: 0.6 
      }
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
    const context = wrongQuestions.slice(0, 3).map(q => q.question).join('|');
    
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: `针对语法考点“${pointName}”生成复习讲义。学生错题背景：${context}`,
      config: {
        systemInstruction: `你是高考英语名师。请输出 JSON 格式的复习讲义。
        字段：
        1. lecture: 系统讲解规则（约200字）。
        2. mistakeAnalysis: 分析易错原因（约100字）。
        3. tips: 3条口诀或技巧（字符串数组）。`,
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
        temperature: 0.3
      }
    });
    const text = response.text || "{}";
    return JSON.parse(text) as { lecture: string; mistakeAnalysis: string; tips: string[] };
  });
};
