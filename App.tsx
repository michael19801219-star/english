import React, { useState, useEffect } from 'react';
import { AppState, Question, QuizResults, UserStats } from './types';
import { generateGrammarQuestions } from './services/geminiService';
import HomeView from './components/HomeView';
import QuizView from './components/QuizView';
import ResultView from './components/ResultView';
import LoadingView from './components/LoadingView';

const App: React.FC = () => {
  const [view, setView] = useState<AppState>(AppState.HOME);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [results, setResults] = useState<QuizResults | null>(null);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [userStats, setUserStats] = useState<UserStats>({ wrongCounts: {} });

  // 初始化加载本地统计
  useEffect(() => {
    const saved = localStorage.getItem('gaokao_stats');
    if (saved) setUserStats(JSON.parse(saved));
  }, []);

  const saveStats = (wrongPoints: string[]) => {
    const newStats = { ...userStats };
    wrongPoints.forEach(pt => {
      newStats.wrongCounts[pt] = (newStats.wrongCounts[pt] || 0) + 1;
    });
    setUserStats(newStats);
    localStorage.setItem('gaokao_stats', JSON.stringify(newStats));
  };

  const startQuiz = async (count: number, targeted: boolean = false) => {
    setView(AppState.LOADING);
    setLoadingMsg(targeted ? '针对薄弱环节组卷中...' : 'AI 老师正在命题...');
    
    try {
      let targets: string[] = [];
      if (targeted) {
        // 取错误频率最高的前3个语法点
        targets = Object.entries(userStats.wrongCounts)
          // Fix: Ensure the values from Object.entries are treated as numbers for the sort subtraction
          .sort((a, b) => (b[1] as number) - (a[1] as number))
          .slice(0, 3)
          .map(([pt]) => pt);
      }

      const newQuestions = await generateGrammarQuestions(count, targets);
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
    userAnswers.forEach((ans, idx) => {
      if (ans === questions[idx].answerIndex) {
        score++;
      } else {
        wrongPoints.push(questions[idx].grammarPoint);
      }
    });

    if (wrongPoints.length > 0) saveStats(wrongPoints);
    setResults({ score, total: questions.length, answers: userAnswers, questions, wrongGrammarPoints: Array.from(new Set(wrongPoints)) });
    setView(AppState.RESULT);
  };

  const startConsolidation = async () => {
    if (!results || results.wrongGrammarPoints.length === 0) return;
    setView(AppState.LOADING);
    setLoadingMsg('正在根据错题生成巩固练习...');
    try {
      // 针对刚才错的语法点，每个点出一道新题
      const newQuestions = await generateGrammarQuestions(results.wrongGrammarPoints.length, results.wrongGrammarPoints);
      setQuestions(newQuestions);
      setResults(null);
      setView(AppState.QUIZ);
    } catch (error) {
      alert('巩固练习生成失败');
      setView(AppState.HOME);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto relative overflow-hidden shadow-xl">
      {view === AppState.HOME && <HomeView onStart={startQuiz} stats={userStats} />}
      {view === AppState.LOADING && <LoadingView message={loadingMsg} />}
      {view === AppState.QUIZ && <QuizView questions={questions} onFinish={finishQuiz} />}
      {view === AppState.RESULT && results && (
        <ResultView results={results} onRestart={() => setView(AppState.HOME)} onConsolidate={startConsolidation} />
      )}
    </div>
  );
};

export default App;