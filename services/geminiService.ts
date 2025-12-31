
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Question, Difficulty, ChatMessage } from "../types";

const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") throw new Error("API_KEY_MISSING");
  return new GoogleGenAI({ apiKey });
};

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
      grammarPoint: { type: Type.STRING }
    },
    required: ["id", "question", "options", "answerIndex", "explanation", "grammarPoint"]
  }
};

export const generateGrammarQuestions = async (
  count: number, 
  targetPoints: string[], 
  difficulty: Difficulty
): Promise<Question[]> => {
  const ai = getAI();
  
  const difficultyMap: Record<Difficulty, string> = {
    '简单': '基础高频考点，题干简短，干扰项特征明显。',
    '中等': '标准高考难度，包含综合考点 and 适度干扰。',
    '较难': '高难模拟难度，题干较长且包含复杂从句，考查细微语法区别。'
  };

  const pointsDesc = targetPoints.length > 0 
    ? `特别针对以下语法点进行命题：${targetPoints.join('、')}。` 
    : "涵盖高考全考点。";

  const prompt = `你是一位高考英语命题专家。请生成 ${count} 道英语语法单选题。
  要求：
  1. 难度设定为：${difficulty}。要求：${difficultyMap[difficulty]}
  2. ${pointsDesc}
  3. 考点 (grammarPoint) 必须使用中文。
  4. 解析 (explanation) 必须包含：【考点直击】、【句意翻译】、【选项剖析】。
  5. 返回纯 JSON 格式。`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw error;
  }
};

export const askFollowUpQuestion = async (
  questionContext: Question,
  history: ChatMessage[],
  userQuery: string
): Promise<string> => {
  const ai = getAI();
  
  let conversationContext = "";
  if (history.length > 0) {
    conversationContext = "前面的对话内容：\n" + history.map(m => `${m.role === 'user' ? '学生' : '老师'}: ${m.content}`).join('\n') + "\n";
  }

  const contextPrompt = `
    学生正在做一道英语语法题：
    题目：${questionContext.question}
    选项：${questionContext.options.join(', ')}
    正确答案：${questionContext.options[questionContext.answerIndex]}
    标准解析：${questionContext.explanation}

    ${conversationContext}
    学生的当前新疑问是：${userQuery}

    请作为资深英语老师，针对该疑问提供通俗易懂、逻辑清晰的解答。
    字数要求：150字以内。
    语言：中文。
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: contextPrompt
    });
    return response.text || "抱歉，老师刚才走神了，请再问一次。";
  } catch (error: any) {
    console.error("AI Tutor Error:", error);
    throw new Error("提问失败，请检查网络连接。");
  }
};

export const generateTTS = async (text: string): Promise<string> => {
  const ai = getAI();
  try {
    // 移除复杂的语气指令，直接输入文本可以让模型更早开始生成音频流
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' } 
          }
        }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("TTS_FAILED");
    return base64Audio;
  } catch (error) {
    console.error("TTS Error:", error);
    throw error;
  }
};
