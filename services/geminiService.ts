
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty, ChatMessage, WrongQuestion } from "../types";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 5): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = JSON.stringify(error).toLowerCase();
    const isQuota = errorStr.includes('429') || errorStr.includes('quota');
    const isServerErr = errorStr.includes('500') || errorStr.includes('503') || errorStr.includes('504');

    if ((isQuota || isServerErr) && retries > 0) {
      // 针对 429 频率限制采用更长的等待时间
      const waitTime = isQuota ? (6 - retries) * 4000 : 2000; 
      console.warn(`AI 忙碌中，${waitTime}ms 后进行第 ${6 - retries} 次重试...`);
      await delay(waitTime);
      return withRetry(fn, retries - 1);
    }
    throw error;
  }
}

// 采用最新的 Gemini 3 Flash 预览版，性能更强且更符合高考逻辑
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pointsDesc = targetPoints.length > 0 ? `考察考点：${targetPoints.join('、')}。` : "涵盖高考核心语法考点。";
    
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: `请立即生成 ${count} 道单项填空练习题。难度：${difficulty}。${pointsDesc}`,
      config: {
        systemInstruction: `你是一位深耕高考英语 20 年的命题组专家。
        要求：
        1. 题目必须严谨，语境清晰。
        2. 选项干扰项需具备典型性。
        3. 解析要包含：句子结构分析、考点辨析、解题思路。
        4. 严格按照 JSON Schema 格式输出，不包含任何 Markdown 标记。`,
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        temperature: 0.5,
        topP: 0.9,
        // 降低候选数量以提高响应速度和稳定性
        candidateCount: 1
      }
    });
    
    const text = response.text || "[]";
    try {
      const data = JSON.parse(text) as any[];
      if (!Array.isArray(data) || data.length === 0) throw new Error("EMPTY_RESPONSE");
      return data.map((q: any) => ({
        ...q,
        id: q.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
      })) as Question[];
    } catch (e) {
      console.error("JSON 解析失败:", text);
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
      contents: `学生针对这道题问："${userQuery}"`,
      config: { 
        systemInstruction: `你是一位极具耐心的高考英语提分教练。
        题目背景：${questionContext.question}
        正确选项：${questionContext.options[questionContext.answerIndex]}
        解析：${questionContext.explanation}
        
        请直接回答学生的疑问，口吻亲切，逻辑严密，多用引导式教学。`,
        temperature: 0.7 
      }
    });
    return response.text || "正在思考更好的解释方式...";
  }, 2); // 追问只需重试 2 次
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
      contents: `为“${pointName}”考点生成深度复习包。错题背景：${context}`,
      config: {
        systemInstruction: `你正在为学生准备一份提分简报。请以 JSON 格式输出：
        1. lecture: 核心考点讲解（干货、凝练）。
        2. mistakeAnalysis: 为什么这类题容易错？
        3. tips: 3 条拿分口诀。`,
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
    return JSON.parse(response.text || "{}");
  });
};
