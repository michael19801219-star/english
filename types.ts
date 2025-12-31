
export interface Question {
  id: string;
  question: string;
  translation?: string; // 题目中文翻译
  options: string[];
  answerIndex: number;
  explanation: string;
  grammarPoint: string;
  difficulty: Difficulty;
}

export type Difficulty = '简单' | '中等' | '较难' | '随机';

export enum AppState {
  HOME = 'HOME',
  LOADING = 'LOADING',
  QUIZ = 'QUIZ',
  RESULT = 'RESULT',
  REVIEW = 'REVIEW',
  STATS = 'STATS'
}

export interface QuizResults {
  score: number;
  total: number;
  answers: number[];
  questions: Question[];
  wrongGrammarPoints: string[];
  duration: number; // 单次练习时长（秒）
}

export interface WrongQuestion extends Question {
  userAnswerIndex: number;
  timestamp: number;
}

export interface DailyRecord {
  attempted: number;
  correct: number;
}

export interface UserStats {
  wrongCounts: Record<string, number>;
  wrongHistory: WrongQuestion[];
  savedHistory: WrongQuestion[];
  totalQuestionsAttempted: number; // 累计总题量
  totalCorrectAnswers: number;     // 累计总正确数
  totalStudyTime: number;          // 累计学习时长（秒）
  dailyStats: Record<string, DailyRecord>; // 每日记录，键为 YYYY-MM-DD
  syncId?: string;
  lastSyncTime?: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export const GRAMMAR_POINTS = [
  '时态语态', '定语从句', '名词性从句', '状语从句', 
  '非谓语动词', '情态动词与虚拟语气', '特殊句式', '主谓一致', 
  '介词冠词', '代词与形容词副词'
];
