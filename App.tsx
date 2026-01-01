
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
  const [userStats, setUserStats] = useState<UserStats>({ wrongCounts: {}, wrongHistory: [], savedHistory: [] });
  const [reviewInitialTab, setReviewInitialTab] = useState<'summary' | 'details' | 'saved'>('summary');

  useEffect(() => {
    const saved = localStorage.getItem('gaokao_stats_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUserStats({
          wrongCounts: parsed.wrongCounts || {},
          wrongHistory: parsed.wrongHistory || [],
          savedHistory: parsed.savedHistory || []
        });
      } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('gaokao_stats_v3', JSON.stringify(userStats));
  }, [userStats]);

  const toggleSaveQuestion = (q: Question, userAnswerIndex?: number) => {
    setUserStats(prev => {
      const isSaved = prev.savedHistory.some(s => s.id === q.id || s.question === q.question);
      if (isSaved) {
        return { ...prev, savedHistory: prev.savedHistory.filter(s => s.question !== q.question && s.id !== q.id) };
      } else {
        const newSaved: WrongQuestion = {
          ...q,
          userAnswerIndex: userAnswerIndex ?? q.answerIndex,
          timestamp: Date.now()
        };
        return { ...prev, savedHistory: [newSaved, ...prev.savedHistory].slice(0, 100) };
      }
    });
  };

  const handleAnswerSubmitted = (q: Question, ans: number) => {
    if (ans !== q.answerIndex) {
      setUserStats(prev => {
        const alreadyExists = prev.wrongHistory.some(h => h.question === q.question);
        if (alreadyExists) return prev;

        const newCounts = { ...prev.wrongCounts };
        const pt = q.grammarPoint;
        newCounts[pt] = (newCounts[pt] || 0) + 1;
        
        const newWrong: WrongQuestion = {
          ...q,
          userAnswerIndex: ans,
          timestamp: Date.now()
        };
        
        return {
          ...prev,
          wrongCounts: newCounts,
          wrongHistory: [newWrong, ...prev.wrongHistory].slice(0, 100)
        };
      });
    }
  };

  const removeWrongQuestion = (timestamp: number) => {
    setUserStats(prev => {
      const target = prev.wrongHistory.find(h => h.timestamp === timestamp);
      const filteredHistory = prev.wrongHistory.filter(h => h.timestamp !== timestamp);

      if (filteredHistory.length === prev.wrongHistory.length) return prev;

      const newCounts = { ...prev.wrongCounts };
      if (target) {
        const pt = target.grammarPoint;
        if (newCounts[pt] > 0) {
          newCounts[pt] -= 1;
          if (newCounts[pt] === 0) delete newCounts[pt];
        }
      }

      return {
        ...prev,
        wrongCounts: newCounts,
        wrongHistory: filteredHistory
      };
    });
  };

  const removeSavedQuestion = (timestamp: number) => {
    setUserStats(prev => ({
      ...prev,
      savedHistory: prev.savedHistory.filter(h => h.timestamp !== timestamp)
    }));
  };

  const clearWrongHistory = () => {
    setUserStats(prev => ({ ...prev, wrongCounts: {}, wrongHistory: [] }));
  };

  const clearSavedHistory = () => {
    setUserStats(prev => ({ ...prev, savedHistory: [] }));
  };

  const startQuiz = async (count: number, difficulty: Difficulty, points: string[]) => {
    setView(AppState.LOADING);
    setLoadingMsg(`正在调取最新高考考点...`);
    try {
      const newQuestions = await generateGrammarQuestions(count, points, difficulty);
      setQuestions(newQuestions);
      setView(AppState.QUIZ);
    } catch (error: any) {
      setView(AppState.HOME);
      alert('加载失败，请检查网络连接或稍后再试。');
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
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto relative overflow-hidden shadow-2xl">
      {view === AppState.HOME && (
        <HomeView 
          onStart={startQuiz} 
          stats={userStats} 
          onGoToReview={(tab) => { setReviewInitialTab(tab as any || 'summary'); setView(AppState.REVIEW); }} 
        />
      )}
      
      {view === AppState.LOADING && <LoadingView message={loadingMsg} onCancel={() => setView(AppState.HOME)} />}
      
      {view === AppState.QUIZ && (
        <QuizView 
          questions={questions} 
          onFinish={finishQuiz} 
          onCancel={() => setView(AppState.HOME)} 
          onToggleSave={toggleSaveQuestion}
          onAnswerSubmitted={handleAnswerSubmitted}
          savedHistory={userStats.savedHistory}
        />
      )}
      
      {view === AppState.RESULT && results && (
        <ResultView 
          results={results} 
          onRestart={() => setView(AppState.HOME)} 
          onConsolidate={() => results.wrongGrammarPoints.length > 0 && startQuiz(10, '中等', results.wrongGrammarPoints)} 
        />
      )}
      
      {view === AppState.REVIEW && (
        <ReviewView 
          history={userStats.wrongHistory} 
          savedHistory={userStats.savedHistory}
          onBack={() => setView(AppState.HOME)} 
          onClearWrong={clearWrongHistory}
          onClearSaved={clearSavedHistory}
          onStartQuiz={(p) => startQuiz(10, '中等', [p])} 
          onRemoveWrong={removeWrongQuestion}
          onRemoveSaved={removeSavedQuestion}
          initialTab={reviewInitialTab} 
        />
      )}
    </div>
  );
};

export default App;
