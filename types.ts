
export interface Question {
  id: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  grammarPoint: string;
}

export type Difficulty = '简单' | '中等' | '较难';

export enum AppState {
  HOME = 'HOME',
  LOADING = 'LOADING',
  QUIZ = 'QUIZ',
  RESULT = 'RESULT',
  REVIEW = 'REVIEW' // 新增错题回顾模式
}

export interface QuizResults {
  score: number;
  total: number;
  answers: number[];
  questions: Question[];
  wrongGrammarPoints: string[];
}

export interface WrongQuestion extends Question {
  userAnswerIndex: number;
  timestamp: number;
}

export interface UserStats {
  wrongCounts: Record<string, number>;
  wrongHistory: WrongQuestion[]; // 记录具体的错题内容
}

export const GRAMMAR_POINTS = [
  '时态语态', '定语从句', '名词性从句', '状语从句', 
  '非谓语动词', '情态动词与虚拟语气', '特殊句式', '主谓一致', 
  '介词冠词', '代词与形容词副词'
];
