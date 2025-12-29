
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

export const generateGrammarQuestions = async (count: number): Promise<Question[]> => {
  // 每次调用时初始化，确保获取最新的 API Key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Generate ${count} professional high school level English grammar multiple-choice questions suitable for China's GaoKao (National College Entrance Examination). 
  Focus on common test points: Verb Tenses, Non-finite Verbs, Relative Clauses, Noun Clauses, Prepositions, and Conjunctions. 
  Each question must have exactly 4 options. 
  Return a JSON array of objects.
  The explanation must be in Chinese and very detailed.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              question: { type: Type.STRING },
              options: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                minItems: 4,
                maxItems: 4
              },
              answerIndex: { type: Type.INTEGER, description: "0-3 index of correct option" },
              explanation: { type: Type.STRING, description: "Detailed explanation in Chinese" },
              grammarPoint: { type: Type.STRING, description: "The specific grammar rule tested" }
            },
            required: ["id", "question", "options", "answerIndex", "explanation", "grammarPoint"]
          }
        }
      }
    });

    const data = JSON.parse(response.text || "[]");
    return data;
  } catch (error) {
    console.error("Failed to generate questions:", error);
    throw error;
  }
};
