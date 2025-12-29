
export interface Question {
  id: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  grammarPoint: string;
}

export enum AppState {
  HOME = 'HOME',
  LOADING = 'LOADING',
  QUIZ = 'QUIZ',
  RESULT = 'RESULT',
  CONSOLIDATING = 'CONSOLIDATING' // 巩固模式
}

export interface QuizResults {
  score: number;
  total: number;
  answers: number[];
  questions: Question[];
  wrongGrammarPoints: string[];
}

export interface UserStats {
  wrongCounts: Record<string, number>; // 记录语法点 -> 错误次数
}
