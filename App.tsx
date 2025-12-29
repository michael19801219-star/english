
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
      console.error("Quiz Start Error:", error);
      let errorTitle = "生成失败";
      let errorDetail = "请稍后重试。";

      if (error.message === "API_KEY_MISSING") {
        errorDetail = "API Key 尚未注入。请确保在 Vercel 设置了 API_KEY 环境变量，并点击了 'Redeploy'。";
      } else if (error.message === "NETWORK_ERROR") {
        errorDetail = "网络连接失败。Gemini API 需要在特定网络环境下访问（如果您在中国，请确保 VPN 已开启并代理了浏览器请求）。";
      } else if (error.message === "EMPTY_RESPONSE") {
        errorDetail = "AI 响应为空，可能由于敏感内容过滤。";
      } else {
        errorDetail = `具体原因: ${error.message || '未知错误'}`;
      }

      alert(`${errorTitle}\n\n${errorDetail}`);
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
