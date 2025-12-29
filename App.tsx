
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
  const [loadingMsg, setLoadingMsg] = useState('准备中...');

  const startQuiz = async (count: number) => {
    setView(AppState.LOADING);
    try {
      setLoadingMsg('AI 老师正在命题...');
      const newQuestions = await generateGrammarQuestions(count);
      setQuestions(newQuestions);
      setView(AppState.QUIZ);
    } catch (error: any) {
      console.error("Start Error:", error);
      let errorMsg = "生成失败，请重试。";
      if (error.message === "API_KEY_MISSING") {
        errorMsg = "API Key 未注入成功！请在 Vercel 重新 Deploy 您的项目。";
      } else if (error.message?.includes("fetch")) {
        errorMsg = "网络连接超时，请检查您的网络环境。";
      }
      alert(errorMsg);
      setView(AppState.HOME);
    }
  };

  const finishQuiz = (userAnswers: number[]) => {
    let score = 0;
    userAnswers.forEach((ans, idx) => {
      if (ans === questions[idx].answerIndex) score++;
    });

    setResults({ score, total: questions.length, answers: userAnswers, questions });
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
    </div>
  );
};

export default App;
