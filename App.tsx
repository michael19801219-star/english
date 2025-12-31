
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
  const [userStats, setUserStats] = useState<UserStats>({ 
    wrongCounts: {}, 
    wrongHistory: [], 
    savedHistory: [] 
  });
  const [reviewInitialTab, setReviewInitialTab] = useState<'summary' | 'details' | 'saved'>('summary');

  useEffect(() => {
    const saved = localStorage.getItem('gaokao_stats_v2');
    if (saved) {
      const parsed = JSON.parse(saved);
      setUserStats({
        ...parsed,
        savedHistory: parsed.savedHistory || []
      });
    }
  }, []);

  const saveStatsToStorage = (updatedStats: UserStats) => {
    setUserStats(updatedStats);
    localStorage.setItem('gaokao_stats_v2', JSON.stringify(updatedStats));
  };

  const handleUpdateStats = (newStats: UserStats) => {
    saveStatsToStorage(newStats);
  };

  const handleGoToReview = (tab?: 'summary' | 'details' | 'saved') => {
    if (tab) setReviewInitialTab(tab);
    setView(AppState.REVIEW);
  };

  const handleAnswerSubmitted = (question: Question, userAnswerIndex: number) => {
    if (userAnswerIndex !== question.answerIndex) {
      const point = question.grammarPoint;
      const updatedCounts = { ...userStats.wrongCounts, [point]: (userStats.wrongCounts[point] || 0) + 1 };
      
      const wrongEntry: WrongQuestion = {
        ...question,
        userAnswerIndex,
        timestamp: Date.now()
      };
      
      const updatedHistory = [wrongEntry, ...userStats.wrongHistory.filter(q => q.question !== question.question)].slice(0, 200);
      
      saveStatsToStorage({
        ...userStats,
        wrongCounts: updatedCounts,
        wrongHistory: updatedHistory
      });
    }
  };

  const toggleSaveQuestion = (question: Question, userAnswerIndex: number) => {
    const isSaved = userStats.savedHistory.some(q => q.question === question.question);
    let updatedSaved;
    if (isSaved) {
      updatedSaved = userStats.savedHistory.filter(q => q.question !== question.question);
    } else {
      updatedSaved = [{ ...question, userAnswerIndex, timestamp: Date.now() }, ...userStats.savedHistory].slice(0, 100);
    }
    saveStatsToStorage({
      ...userStats,
      savedHistory: updatedSaved
    });
  };

  const handleDeleteWrong = (timestamp: number) => {
    const deletedItem = userStats.wrongHistory.find(q => q.timestamp === timestamp);
    if (!deletedItem) return;

    const point = deletedItem.grammarPoint;
    const updatedCounts = { ...userStats.wrongCounts };
    if (updatedCounts[point] > 0) {
      updatedCounts[point]--;
      if (updatedCounts[point] === 0) delete updatedCounts[point];
    }

    const updatedHistory = userStats.wrongHistory.filter(q => q.timestamp !== timestamp);
    
    saveStatsToStorage({
      ...userStats,
      wrongHistory: updatedHistory,
      wrongCounts: updatedCounts
    });
  };

  const handleDeleteSaved = (timestamp: number) => {
    saveStatsToStorage({
      ...userStats,
      savedHistory: userStats.savedHistory.filter(q => q.timestamp !== timestamp)
    });
  };

  const startQuiz = async (count: number, difficulty: Difficulty, points: string[]) => {
    setView(AppState.LOADING);
    setLoadingMsg(`AI 正在为你生成试卷...`);
    try {
      const newQuestions = await generateGrammarQuestions(count, points, difficulty);
      setQuestions(newQuestions);
      setView(AppState.QUIZ);
    } catch (error: any) {
      console.error("Quiz Generation Error:", error);
      alert("生成失败，请检查网络或 API 配置后重试。");
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
    setResults({ 
      score, 
      total: questions.length, 
      answers: userAnswers, 
      questions, 
      wrongGrammarPoints: Array.from(new Set(wrongPoints)) 
    });
    setView(AppState.RESULT);
  };

  const handleConsolidate = () => {
    if (results && results.wrongGrammarPoints.length > 0) {
      startQuiz(10, '中等', results.wrongGrammarPoints);
    }
  };

  const clearHistory = (type: 'details' | 'saved') => {
    const label = type === 'details' ? '错题集' : '收藏夹';
    if (confirm(`确定要清空全部${label}吗？此操作不可撤销。`)) {
      if (type === 'details') {
        saveStatsToStorage({
          ...userStats,
          wrongHistory: [],
          wrongCounts: {}
        });
      } else {
        saveStatsToStorage({
          ...userStats,
          savedHistory: []
        });
      }
    }
  };

  return (
    <div className="h-[100dvh] bg-gray-50 flex flex-col max-w-md mx-auto relative overflow-hidden shadow-2xl">
      {view === AppState.HOME && (
        <HomeView 
          onStart={startQuiz} 
          stats={userStats} 
          onGoToReview={handleGoToReview}
          onUpdateStats={handleUpdateStats}
        />
      )}
      {view === AppState.LOADING && <LoadingView message={loadingMsg} onCancel={() => setView(AppState.HOME)} />}
      {view === AppState.QUIZ && (
        <QuizView 
          questions={questions} 
          onFinish={finishQuiz} 
          onCancel={() => setView(AppState.HOME)} 
          onQuotaError={() => alert("当前请求过快，请稍后再试。")}
          onAnswerSubmitted={handleAnswerSubmitted}
          onToggleSave={toggleSaveQuestion}
          savedHistory={userStats.savedHistory}
        />
      )}
      {view === AppState.RESULT && results && (
        <ResultView results={results} onRestart={() => setView(AppState.HOME)} onConsolidate={handleConsolidate} />
      )}
      {view === AppState.REVIEW && (
        <ReviewView 
          history={userStats.wrongHistory} 
          savedHistory={userStats.savedHistory}
          onBack={() => setView(AppState.HOME)} 
          onClear={clearHistory} 
          onDeleteWrong={handleDeleteWrong}
          onDeleteSaved={handleDeleteSaved}
          onStartQuiz={(point) => startQuiz(10, '中等', [point])}
          initialTab={reviewInitialTab}
        />
      )}
    </div>
  );
};

export default App;
