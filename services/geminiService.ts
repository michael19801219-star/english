
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty, ChatMessage, WrongQuestion } from "../types";

/**
 * 强制使用 2.5 Lite 模型 ('gemini-flash-lite-latest')
 */
const TEXT_MODEL = 'gemini-flash-lite-latest';

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
  difficulty: Difficulty,
  onProgress?: (msg: string) => void
): Promise<Question[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const pointsDesc = targetPoints.length > 0 ? `重点考察：${targetPoints.join('、')}。` : "涵盖高考核心考点。";
  
  if (onProgress) onProgress("AI 正在构思题目...");

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: `生成 ${count} 道单项填空练习题。难度：${difficulty}。${pointsDesc}`,
      config: {
        systemInstruction: `你是一位高考英语名师。
        1. 题目语境真实，符合高考逻辑。
        2. 解析需包含结构分析和关键词提示。
        3. 必须为题目提供准确的【中文翻译】。
        4. 仅返回 JSON 数据，严禁包含 Markdown 标记。`,
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        temperature: 0.4
      }
    });
    
    const text = response.text || "[]";
    const data = JSON.parse(text);
    if (!Array.isArray(data) || data.length === 0) throw new Error("EMPTY_DATA");
    return data;
  } catch (e) {
    console.error("Generate error:", e);
    throw new Error("GENERATION_FAILED");
  }
};

export const askFollowUpQuestion = async (
  questionContext: Question,
  history: ChatMessage[],
  userQuery: string
): Promise<string> => {
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
    return response.text || "老师正在组织语言，请再问一遍。";
  } catch (e) {
    console.error("Ask error:", e);
    return "暂时无法连接 AI 助教，请稍后再试。";
  }
};

export const getGrammarDeepDive = async (
  pointName: string,
  wrongQuestions: WrongQuestion[]
): Promise<{ lecture: string; mistakeAnalysis: string; tips: string[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const context = wrongQuestions.slice(0, 2).map(q => q.question).join('|');
  
  try {
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
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Deep dive error:", e);
    return {
      lecture: "暂时无法生成详细讲义。",
      mistakeAnalysis: "请参考错题集的解析内容。",
      tips: ["多看例句", "分析句子成分", "背诵核心搭配"]
    };
  }
};
