
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty, ChatMessage, WrongQuestion } from "../types";

// Using gemini-3-pro-preview for complex reasoning tasks
const TEXT_MODEL = 'gemini-3-pro-preview';

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
      grammarPoint: { type: Type.STRING },
      difficulty: { type: Type.STRING }
    },
    required: ["id", "question", "translation", "options", "answerIndex", "explanation", "grammarPoint", "difficulty"]
  }
};

/**
 * Generates grammar questions using Gemini AI.
 */
export const generateGrammarQuestions = async (
  count: number, 
  targetPoints: string[], 
  difficulty: Difficulty,
  onProgress?: (msg: string) => void
): Promise<Question[]> => {
  // Always use process.env.API_KEY directly as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const pointsDesc = targetPoints.length > 0 ? `重点考察：${targetPoints.join('、')}。` : "涵盖高考核心考点。";
  if (onProgress) onProgress("AI 正在构思题目...");

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: `生成 ${count} 道单项填空练习题。难度：${difficulty}。${pointsDesc}`,
      config: {
        systemInstruction: `你是一位高考英语名师。1. 题目符合高考逻辑。2. 解析包含结构分析。3. 必须提供【中文翻译】。4. 仅返回 JSON。`,
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        temperature: 0.4
      }
    });
    
    // response.text is a getter, used correctly here
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini Question Generation Error:", error);
    throw error;
  }
};

/**
 * Handles follow-up questions from the user about a specific quiz question.
 */
export const askFollowUpQuestion = async (
  questionContext: Question,
  history: ChatMessage[],
  userQuery: string
): Promise<string> => {
  // Always use process.env.API_KEY directly
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: `针对题目的追问："${userQuery}"`,
      config: { 
        systemInstruction: `你是英语助教。针对题目: ${questionContext.question}，回答学生疑问。`,
        temperature: 0.7 
      }
    });
    return response.text || "老师正在组织语言...";
  } catch (error) {
    console.error("Gemini Follow-up Error:", error);
    throw error;
  }
};

/**
 * Generates a deep dive lesson on a specific grammar point.
 */
export const getGrammarDeepDive = async (
  pointName: string,
  wrongQuestions: WrongQuestion[]
): Promise<{ lecture: string; mistakeAnalysis: string; tips: string[] }> => {
  // Always use process.env.API_KEY directly
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const context = wrongQuestions.slice(0, 2).map(q => q.question).join('|');
  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: `生成“${pointName}”的精讲。错题案例：${context}`,
      config: {
        systemInstruction: `输出 JSON 复习讲义：lecture, mistakeAnalysis, tips(3个技巧)。`,
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
  } catch (error) {
    console.error("Gemini Deep Dive Error:", error);
    throw error;
  }
};
