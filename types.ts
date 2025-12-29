
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
  RESULT = 'RESULT'
}

export interface QuizResults {
  score: number;
  total: number;
  answers: number[];
  questions: Question[];
}
