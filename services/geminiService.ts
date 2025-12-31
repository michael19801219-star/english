
// DO NOT use or import the types below from `@google/genai`; these are deprecated APIs and no longer work.
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty, ChatMessage, WrongQuestion } from "../types";

// 按照规范：在每次调用前创建实例以获取最新 Key
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
      grammarPoint: { type: Type.STRING },
      difficulty: { type: Type.STRING, description: "该题目的具体难度：简单、中等 或 较难" }
    },
    required: ["id", "question", "options", "answerIndex", "explanation", "grammarPoint", "difficulty"]
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
    '较难': '高难模拟难度，题干较长且包含复杂从句，考查细微语法区别。',
    '随机': '混合不同梯度难度，既包含基础巩余题也包含高难挑战题，真实模拟考场不确定性。'
  };

  const pointsDesc = targetPoints.length > 0 
    ? `特别针对以下语法点进行命题：${targetPoints.join('、')}。` 
    : "涵盖高考全考点。";

  const prompt = `你是一位高考英语命题专家。请生成 ${count} 道英语语法单选题。
  要求：
  1. 设定总难度为：${difficulty}。要求：${difficultyMap[difficulty]}
  2. ${pointsDesc}
  3. 考点 (grammarPoint) 必须使用中文。
  4. **选项概率均衡控制**：严格确保正确选项 (answerIndex) 在 A (0), B (1), C (2), D (3) 之间分布均衡。严禁大部分题目的正确答案都集中在前两个选项。必须保证 D 选项作为正确答案的概率约为 25%，增加题目迷惑性。
  5. 解析 (explanation) 必须包含：【考点直击】、【句意翻译】、【选项剖析】。
  6. 返回的 JSON 中，每道题目的 difficulty 字段请根据该题实际难度填写（简单/中等/较难）。
  7. 返回纯 JSON 格式。`;

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
    if (error.message?.includes('429') || error.message?.includes('quota')) {
      throw new Error("QUOTA_EXCEEDED");
    }
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
    if (error.message?.includes('429') || error.message?.includes('quota')) {
      throw new Error("QUOTA_EXCEEDED");
    }
    throw error;
  }
};

/**
 * 获取考点的深度总结
 */
export const getGrammarDeepDive = async (
  pointName: string,
  wrongQuestions: WrongQuestion[]
): Promise<{ lecture: string; mistakeAnalysis: string; tips: string[] }> => {
  const ai = getAI();
  
  const questionContext = wrongQuestions.map((q, i) => 
    `${i+1}. 题目: ${q.question} | 正确答案: ${q.options[q.answerIndex]} | 你的错误选择: ${q.options[q.userAnswerIndex]}`
  ).join('\n');

  const prompt = `你是一位英语特级教师。请针对考点“${pointName}”进行深度分析。
  以下是学生在该考点下的错题表现：
  ${questionContext}

  请生成一份结构化的 JSON 数据，包含：
  1. lecture: 该语法的核心逻辑简讲（50字内）。
  2. mistakeAnalysis: 结合上述错题，分析该学生为什么会选错，他的思维误区在哪里（80字内）。
  3. tips: 给出3条针对高考该考点的避坑指南或注意事项。

  要求：使用中文，返回 JSON 格式。`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      lecture: { type: Type.STRING },
      mistakeAnalysis: { type: Type.STRING },
      tips: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["lecture", "mistakeAnalysis", "tips"]
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error: any) {
    if (error.message?.includes('429') || error.message?.includes('quota')) {
      throw new Error("QUOTA_EXCEEDED");
    }
    throw error;
  }
};
