
import React, { useState, useEffect } from 'react';
import { AppState, Question, QuizResults, UserStats, Difficulty, WrongQuestion, GRAMMAR_POINTS } from './types';
import { generateGrammarQuestions } from './services/geminiService';
import HomeView from './components/HomeView';
import QuizView from './components/QuizView';
import ResultView from './components/ResultView';
import LoadingView from './components/LoadingView';
import ReviewView from './components/ReviewView';
import StatsView from './components/StatsView';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    // FIX: Added optionality modifier to resolve property modifier conflict with global environment
    aistudio?: AIStudio;
  }
}

const App: React.FC = () => {
  const [view, setView] = useState<AppState>(AppState.HOME);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [results, setResults] = useState<QuizResults | null>(null);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [userStats, setUserStats] = useState<UserStats>({ 
    wrongCounts: {}, 
    wrongHistory: [], 
    savedHistory: [],
    totalAnswered: 0,
    totalCorrect: 0,
    dailyProgress: {},
    pointAttempts: {}
  });
  const [showKeyPickerModal, setShowKeyPickerModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [reviewInitialTab, setReviewInitialTab] = useState<'summary' | 'details' | 'saved'>('summary');
  const [isKeyActive, setIsKeyActive] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('gaokao_stats_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUserStats({
          wrongCounts: parsed.wrongCounts || {},
          wrongHistory: parsed.wrongHistory || [],
          savedHistory: parsed.savedHistory || [],
          totalAnswered: parsed.totalAnswered || 0,
          totalCorrect: parsed.totalCorrect || 0,
          dailyProgress: parsed.dailyProgress || {},
          pointAttempts: parsed.pointAttempts || {}
        });
      } catch (e) { console.error(e); }
    }
    
    // 检查云端密钥状态
    const checkStatus = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setIsKeyActive(hasKey);
      }
    };
    checkStatus();
  }, []);

  useEffect(() => {
    localStorage.setItem('gaokao_stats_v3', JSON.stringify(userStats));
  }, [userStats]);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setIsKeyActive(true);
      setShowKeyPickerModal(false);
    }
  };

  const normalizePoint = (rawPoint: string): string => {
    if (GRAMMAR_POINTS.includes(rawPoint)) return rawPoint;
    for (const standard of GRAMMAR_POINTS) {
      if (rawPoint.includes(standard) || standard.includes(rawPoint)) return standard;
    }
    return GRAMMAR_POINTS[0];
  };

  const startQuiz = async (count: number, difficulty: Difficulty, points: string[]) => {
    setView(AppState.LOADING);
    setLoadingMsg(`正在调取最新高考考点...`);
    try {
      const newQuestions = await generateGrammarQuestions(count, points, difficulty);
      setQuestions(newQuestions);
      setView(AppState.QUIZ);
    } catch (error: any) {
      console.error(error);
      setView(AppState.HOME);
      setShowKeyPickerModal(true); // 报错时提示配置密钥
    }
  };

  const startHistoryQuiz = (sourceType: 'wrong' | 'saved', count: number, difficulty: Difficulty, points: string[]) => {
    const source = sourceType === 'wrong' ? userStats.wrongHistory : userStats.savedHistory;
    let filtered = source.filter(q => {
      const matchesPoint = points.length === 0 || points.includes(q.grammarPoint);
      const matchesDiff = difficulty === '随机' || q.difficulty === difficulty;
      return matchesPoint && matchesDiff;
    });

    if (filtered.length === 0) {
      alert(`当前库中没有符合条件的题目。`);
      return;
    }

    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
    setQuestions(shuffled.slice(0, count));
    setView(AppState.QUIZ);
  };

  const handleAnswerSubmitted = (q: Question, ans: number) => {
    const isCorrect = ans === q.answerIndex;
    const today = new Date().toISOString().split('T')[0];
    const pt = normalizePoint(q.grammarPoint);

    setUserStats(prev => {
      const newDailyProgress = { ...prev.dailyProgress };
      newDailyProgress[today] = (newDailyProgress[today] || 0) + 1;
      const newPointAttempts = { ...prev.pointAttempts };
      newPointAttempts[pt] = (newPointAttempts[pt] || 0) + 1;

      let newState = {
        ...prev,
        totalAnswered: prev.totalAnswered + 1,
        totalCorrect: prev.totalCorrect + (isCorrect ? 1 : 0),
        dailyProgress: newDailyProgress,
        pointAttempts: newPointAttempts
      };

      if (!isCorrect) {
        const newCounts = { ...prev.wrongCounts };
        newCounts[pt] = (newCounts[pt] || 0) + 1;
        const alreadyInHistory = prev.wrongHistory.some(h => h.question === q.question);
        if (!alreadyInHistory) {
          const newWrong: WrongQuestion = { ...q, userAnswerIndex: ans, timestamp: Date.now() };
          newState.wrongHistory = [newWrong, ...prev.wrongHistory].slice(0, 200);
        }
        newState.wrongCounts = newCounts;
      }
      return newState;
    });
  };

  const removeWrongQuestion = (timestamp: number) => {
    setUserStats(prev => ({ ...prev, wrongHistory: prev.wrongHistory.filter(h => h.timestamp !== timestamp) }));
  };

  const removeSavedQuestion = (timestamp: number) => {
    setUserStats(prev => ({ ...prev, savedHistory: prev.savedHistory.filter(h => h.timestamp !== timestamp) }));
  };

  const clearWrongHistory = () => setUserStats(prev => ({ ...prev, wrongHistory: [], wrongCounts: {} }));
  const clearSavedHistory = () => setUserStats(prev => ({ ...prev, savedHistory: [] }));

  const finishQuiz = (userAnswers: number[]) => {
    let score = 0;
    const wrongPoints: string[] = [];
    userAnswers.forEach((ans, idx) => {
      if (ans === questions[idx].answerIndex) score++;
      else wrongPoints.push(normalizePoint(questions[idx].grammarPoint));
    });
    setResults({ score, total: questions.length, answers: userAnswers, questions, wrongGrammarPoints: Array.from(new Set(wrongPoints)) });
    setView(AppState.RESULT);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto relative overflow-hidden shadow-2xl">
      {view === AppState.HOME && (
        <HomeView 
          onStart={startQuiz} 
          onStartHistory={startHistoryQuiz}
          stats={userStats} 
          onGoToReview={(tab) => { setReviewInitialTab(tab as any || 'summary'); setView(AppState.REVIEW); }} 
          onGoToStats={() => setView(AppState.STATS)}
          isUsingPersonalKey={isKeyActive}
          onOpenQuotaModal={() => setShowKeyPickerModal(true)}
          onOpenSyncModal={() => setShowSyncModal(true)}
        />
      )}
      {view === AppState.LOADING && <LoadingView message={loadingMsg} onCancel={() => setView(AppState.HOME)} />}
      {view === AppState.QUIZ && (
        <QuizView 
          questions={questions} 
          onFinish={finishQuiz} 
          onCancel={() => setView(AppState.HOME)} 
          onQuotaError={() => setShowKeyPickerModal(true)}
          onToggleSave={(q, idx) => {
            const isSaved = userStats.savedHistory.some(s => s.question === q.question);
            if (isSaved) {
              const target = userStats.savedHistory.find(s => s.question === q.question);
              if (target) removeSavedQuestion(target.timestamp);
            } else {
              const newSaved: WrongQuestion = { ...q, userAnswerIndex: idx ?? q.answerIndex, timestamp: Date.now() };
              setUserStats(prev => ({ ...prev, savedHistory: [newSaved, ...prev.savedHistory].slice(0, 200) }));
            }
          }}
          onAnswerSubmitted={handleAnswerSubmitted}
          savedHistory={userStats.savedHistory}
        />
      )}
      {view === AppState.RESULT && results && (
        <ResultView results={results} onRestart={() => setView(AppState.HOME)} onConsolidate={() => results.wrongGrammarPoints.length > 0 && startQuiz(10, '中等', results.wrongGrammarPoints)} />
      )}
      {view === AppState.REVIEW && (
        <ReviewView history={userStats.wrongHistory} savedHistory={userStats.savedHistory} onBack={() => setView(AppState.HOME)} onClearWrong={clearWrongHistory} onClearSaved={clearSavedHistory} onStartQuiz={(p) => startQuiz(10, '中等', [p])} onRemoveWrong={removeWrongQuestion} onRemoveSaved={removeSavedQuestion} initialTab={reviewInitialTab} />
      )}
      {view === AppState.STATS && <StatsView stats={userStats} onBack={() => setView(AppState.HOME)} />}
      
      {showKeyPickerModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-md p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-xs rounded-[40px] p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-4">☁️</div>
            <h3 className="text-xl font-black mb-2 text-gray-900">配置云端密钥</h3>
            <p className="text-xs text-gray-400 mb-8 font-medium leading-relaxed">
              为了避免密钥泄露并获得独立额度，请连接您的 Google Cloud 项目。系统会安全记住您的选择，无需重复输入。
            </p>
            <button 
              onClick={handleSelectKey} 
              className="w-full py-5 bg-indigo-600 text-white rounded-[24px] font-black shadow-xl shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span>✨</span> 立即连接云项目
            </button>
            <button onClick={() => setShowKeyPickerModal(false)} className="mt-6 text-gray-400 font-bold text-xs active:opacity-50">以后再说</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
