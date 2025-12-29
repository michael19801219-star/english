
import React, { useState } from 'react';
import { AppState, Question, QuizResults } from './types';
import { generateGrammarQuestions } from './services/geminiService';
import HomeView from './components/HomeView';
import QuizView from './components/QuizView';
import ResultView from './components/ResultView';
import LoadingView from './components/LoadingView';

const App: React.FC = () => {
  const [view, setView] = useState<AppState>(AppState.HOME);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [results, setResults] = useState<QuizResults | null>(null);
  const [loadingMsg, setLoadingMsg] = useState('正在为您准备高考语法秘籍...');

  const startQuiz = async (count: number) => {
    setView(AppState.LOADING);
    try {
      setLoadingMsg('AI 老师正在根据考纲选题...');
      const newQuestions = await generateGrammarQuestions(count);
      setQuestions(newQuestions);
      setView(AppState.QUIZ);
    } catch (error: any) {
      console.error("Start Quiz Error:", error);
      alert(`生成失败: ${error.message}\n\n建议：1. 确认 Vercel 设置了 API_KEY 环境变量\n2. 确认 API Key 拥有 Gemini 2.0/3.0 访问权限\n3. 如果在国内访问，请确保网络环境正常。`);
      setView(AppState.HOME);
    }
  };

  const finishQuiz = (userAnswers: number[]) => {
    let score = 0;
    userAnswers.forEach((ans, idx) => {
      if (ans === questions[idx].answerIndex) score++;
    });

    setResults({
      score,
      total: questions.length,
      answers: userAnswers,
      questions
    });
    setView(AppState.RESULT);
  };

  const resetQuiz = () => {
    setQuestions([]);
    setResults(null);
    setView(AppState.HOME);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto relative overflow-hidden shadow-xl">
      {view === AppState.HOME && <HomeView onStart={startQuiz} />}
      {view === AppState.LOADING && <LoadingView message={loadingMsg} />}
      {view === AppState.QUIZ && <QuizView questions={questions} onFinish={finishQuiz} />}
      {view === AppState.RESULT && results && (
        <ResultView results={results} onRestart={resetQuiz} />
      )}
      
      {/* Decorative BG element */}
      <div className="fixed -bottom-24 -left-24 w-64 h-64 bg-indigo-100 rounded-full blur-3xl opacity-50 -z-10" />
      <div className="fixed -top-24 -right-24 w-64 h-64 bg-blue-100 rounded-full blur-3xl opacity-50 -z-10" />
    </div>
  );
};

export default App;
