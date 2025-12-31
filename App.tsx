
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

  // 初始化加载
  useEffect(() => {
    const saved = localStorage.getItem('gaokao_stats_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUserStats({
          wrongCounts: parsed.wrongCounts || {},
          wrongHistory: parsed.wrongHistory || [],
          savedHistory: parsed.savedHistory || [],
          syncId: parsed.syncId,
          lastSyncTime: parsed.lastSyncTime
        });
      } catch (e) {
        console.error("Failed to parse local storage", e);
      }
    }
  }, []);

  // 状态同步到本地存储
  const syncToStorage = (stats: UserStats) => {
    localStorage.setItem('gaokao_stats_v2', JSON.stringify(stats));
  };

  const handleUpdateStats = (newStats: UserStats) => {
    setUserStats(newStats);
    syncToStorage(newStats);
  };

  const handleGoToReview = (tab?: 'summary' | 'details' | 'saved') => {
    if (tab) setReviewInitialTab(tab);
    setView(AppState.REVIEW);
  };

  const handleAnswerSubmitted = (question: Question, userAnswerIndex: number) => {
    if (userAnswerIndex !== question.answerIndex) {
      setUserStats(prev => {
        const point = question.grammarPoint;
        const newCounts = { ...prev.wrongCounts, [point]: (prev.wrongCounts[point] || 0) + 1 };
        const wrongEntry: WrongQuestion = {
          ...question,
          userAnswerIndex,
          timestamp: Date.now()
        };
        const newHistory = [wrongEntry, ...prev.wrongHistory.filter(q => q.question !== question.question)].slice(0, 200);
        const newState = { ...prev, wrongCounts: newCounts, wrongHistory: newHistory };
        syncToStorage(newState);
        return newState;
      });
    }
  };

  const toggleSaveQuestion = (question: Question, userAnswerIndex: number) => {
    setUserStats(prev => {
      const isAlreadySaved = prev.savedHistory.some(q => q.question === question.question);
      let newSaved;
      if (isAlreadySaved) {
        newSaved = prev.savedHistory.filter(q => q.question !== question.question);
      } else {
        newSaved = [{ ...question, userAnswerIndex, timestamp: Date.now() }, ...prev.savedHistory].slice(0, 100);
      }
      const newState = { ...prev, savedHistory: newSaved };
      syncToStorage(newState);
      return newState;
    });
  };

  const handleDeleteWrong = (timestamp: number, questionText: string) => {
    setUserStats(prev => {
      // 兼容逻辑：优先按时间戳匹配，如果时间戳不存在则按文本匹配
      const itemToDelete = prev.wrongHistory.find(q => 
        (timestamp && q.timestamp === timestamp) || q.question === questionText
      );

      if (!itemToDelete) return prev;

      const point = itemToDelete.grammarPoint;
      const newCounts = { ...prev.wrongCounts };
      if (newCounts[point] > 0) {
        newCounts[point]--;
        if (newCounts[point] === 0) delete newCounts[point];
      }

      const newHistory = prev.wrongHistory.filter(q => 
        (timestamp && q.timestamp !== timestamp) || (!timestamp && q.question !== questionText)
      );

      const newState = { ...prev, wrongHistory: newHistory, wrongCounts: newCounts };
      syncToStorage(newState);
      return newState;
    });
  };

  const handleDeleteSaved = (timestamp: number, questionText: string) => {
    setUserStats(prev => {
      const newSaved = prev.savedHistory.filter(q => 
        (timestamp && q.timestamp !== timestamp) || (!timestamp && q.question !== questionText)
      );
      const newState = { ...prev, savedHistory: newSaved };
      syncToStorage(newState);
      return newState;
    });
  };

  const clearHistory = (type: 'details' | 'saved') => {
    const label = type === 'details' ? '错题集' : '收藏夹';
    if (confirm(`确定要清空全部${label}吗？此操作无法撤销。`)) {
      setUserStats(prev => {
        let newState;
        if (type === 'details') {
          newState = { ...prev, wrongHistory: [], wrongCounts: {} };
        } else {
          newState = { ...prev, savedHistory: [] };
        }
        syncToStorage(newState);
        return newState;
      });
    }
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
      alert("生成失败，请稍后重试。");
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
          onQuotaError={() => alert("请求频繁，请稍后再试。")}
          onAnswerSubmitted={handleAnswerSubmitted}
          onToggleSave={toggleSaveQuestion}
          savedHistory={userStats.savedHistory}
        />
      )}
      {view === AppState.RESULT && results && (
        <ResultView results={results} onRestart={() => setView(AppState.HOME)} onConsolidate={() => startQuiz(10, '中等', results.wrongGrammarPoints)} />
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
