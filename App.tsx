
import React, { useState, useEffect } from 'react';
import { AppState, Question, QuizResults, UserStats, Difficulty, WrongQuestion } from './types';
import { generateGrammarQuestions } from './services/geminiService';
import HomeView from './components/HomeView';
import QuizView from './components/QuizView';
import ResultView from './components/ResultView';
import LoadingView from './components/LoadingView';
import ReviewView from './components/ReviewView';

const App: React.FC = () => {
  const [view, setView] = useState<AppState>(AppState.HOME);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [results, setResults] = useState<QuizResults | null>(null);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [userStats, setUserStats] = useState<UserStats>({ wrongCounts: {}, wrongHistory: [] });

  useEffect(() => {
    const saved = localStorage.getItem('gaokao_stats_v2');
    if (saved) setUserStats(JSON.parse(saved));
  }, []);

  const saveStats = (wrongPoints: string[], wrongQuestions: WrongQuestion[]) => {
    const newStats = { ...userStats };
    wrongPoints.forEach(pt => {
      newStats.wrongCounts[pt] = (newStats.wrongCounts[pt] || 0) + 1;
    });
    newStats.wrongHistory = [...wrongQuestions, ...newStats.wrongHistory].slice(0, 50);
    setUserStats(newStats);
    localStorage.setItem('gaokao_stats_v2', JSON.stringify(newStats));
  };

  const startQuiz = async (count: number, difficulty: Difficulty, points: string[]) => {
    setView(AppState.LOADING);
    setLoadingMsg(`AI 正在为你生成 ${difficulty} 难度的试卷...`);
    try {
      const newQuestions = await generateGrammarQuestions(count, points, difficulty);
      setQuestions(newQuestions);
      setView(AppState.QUIZ);
    } catch (error: any) {
      alert(`生成失败: ${error.message}`);
      setView(AppState.HOME);
    }
  };

  const finishQuiz = (userAnswers: number[]) => {
    let score = 0;
    const wrongPoints: string[] = [];
    const newWrongEntries: WrongQuestion[] = [];

    userAnswers.forEach((ans, idx) => {
      if (ans === questions[idx].answerIndex) {
        score++;
      } else {
        wrongPoints.push(questions[idx].grammarPoint);
        newWrongEntries.push({
          ...questions[idx],
          userAnswerIndex: ans,
          timestamp: Date.now()
        });
      }
    });

    if (newWrongEntries.length > 0) saveStats(wrongPoints, newWrongEntries);
    
    setResults({ 
      score, 
      total: questions.length, 
      answers: userAnswers, 
      questions, 
      wrongGrammarPoints: Array.from(new Set(wrongPoints)) 
    });
    setView(AppState.RESULT);
  };

  const clearHistory = () => {
    if (confirm('确定要清空错题本吗？')) {
      const reset = { wrongCounts: {}, wrongHistory: [] };
      setUserStats(reset);
      localStorage.setItem('gaokao_stats_v2', JSON.stringify(reset));
    }
  };

  const handleCancelQuiz = () => {
    setView(AppState.HOME);
    setQuestions([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto relative overflow-hidden shadow-2xl">
      {view === AppState.HOME && <HomeView onStart={startQuiz} stats={userStats} onGoToReview={() => setView(AppState.REVIEW)} />}
      {view === AppState.LOADING && <LoadingView message={loadingMsg} onCancel={() => setView(AppState.HOME)} />}
      {view === AppState.QUIZ && <QuizView questions={questions} onFinish={finishQuiz} onCancel={handleCancelQuiz} />}
      {view === AppState.RESULT && results && (
        <ResultView results={results} onRestart={() => setView(AppState.HOME)} onConsolidate={() => {}} />
      )}
      {view === AppState.REVIEW && (
        <ReviewView history={userStats.wrongHistory} onBack={() => setView(AppState.HOME)} onClear={clearHistory} />
      )}
    </div>
  );
};

export default App;
