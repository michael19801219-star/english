
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty, ChatMessage, WrongQuestion } from "../types";

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
      grammarPoint: { type: Type.STRING },
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
    const ai = new GoogleGenAI({ apiKey: getActiveApiKey() });
    const pointsDesc = targetPoints.length > 0 ? `考点：${targetPoints.join('、')}。` : "涵盖高中考纲核心内容。";
    
    const prompt = `你是一位资深高考英语名师。请生成 ${count} 道英语语法填空选择题。
    
    严格要求：
    1. 【平衡分布】：确保这 ${count} 道题中，正确答案 A、B、C、D 出现的概率基本一致，不要集中在某一个选项。
    2. 【详尽解析】：解析必须使用纯中文，字数不少于 80 字。内容需包含：
       - 核心考点说明。
       - 句子结构分析。
       - 正确选项的语法依据。
       - 逐一说明其他三个干扰项为什么错误。
    3. 【高考标准】：难度设为 ${difficulty}，风格需完全贴合近五年全国高考真题。
    4. 【内容完整】：
       - ${pointsDesc}
       - 提供题目完整的【中文译文】。
       - 选项和干扰项需具有高考级别的迷惑性。`;

    const response = await ai.models.generateContent({
      model: TARGET_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        temperature: 0.8 // 略微提高随机性以获得更好的选项分布
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
      contents: `针对该题目进行中文答疑：\n题目：${questionContext.question}\n译文：${questionContext.translation}\n当前已有的解析：${questionContext.explanation}\n学生的问题：${userQuery}`,
      config: { 
        temperature: 0.5, 
        systemInstruction: "你是一位极其耐心的英语老师。请结合题目背景、语法点和错误选项的逻辑，给学生提供非常详尽的、保姆级的中文解答。" 
      }
    });
    return response.text || "请稍等，老师正在组织语言...";
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
      contents: `请对考点“${pointName}”进行深度总结。
      这些是学生做错的题目：\n${wrongQuestions.map(q => "- " + q.question).join('\n')}
      请基于这些错题，提供一份高考冲刺级别的专项讲义。要求：
      1. 考点精讲要透彻，覆盖特殊情况。
      2. 错因分析要直击痛点。
      3. 技巧要实用易记。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lecture: { type: Type.STRING, description: "核心考点精讲（详尽中文）" },
            mistakeAnalysis: { type: Type.STRING, description: "常见错误原因分析（结合错题的深度分析）" },
            tips: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5条高考实战提分技巧" }
          },
          required: ["lecture", "mistakeAnalysis", "tips"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  });
};
