
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
  const [userStats, setUserStats] = useState<UserStats>(() => {
    const saved = localStorage.getItem('gaokao_stats_v2');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return { wrongCounts: {}, wrongHistory: [], savedHistory: [] };
      }
    }
    return { wrongCounts: {}, wrongHistory: [], savedHistory: [] };
  });
  const [reviewInitialTab, setReviewInitialTab] = useState<'summary' | 'details' | 'saved'>('summary');
  
  // 用于全局“清空”动作的自定义确认状态
  const [clearConfirm, setClearConfirm] = useState<{ isOpen: boolean; type: 'details' | 'saved' | null }>({ isOpen: false, type: null });

  useEffect(() => {
    localStorage.setItem('gaokao_stats_v2', JSON.stringify(userStats));
  }, [userStats]);

  const handleUpdateStats = (newStats: UserStats) => {
    setUserStats(newStats);
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
        
        const exists = prev.wrongHistory.some(q => q.question === question.question);
        if (exists) return prev;

        const wrongEntry: WrongQuestion = {
          ...question,
          userAnswerIndex,
          timestamp: Date.now()
        };
        
        return {
          ...prev,
          wrongCounts: newCounts,
          wrongHistory: [wrongEntry, ...prev.wrongHistory].slice(0, 200)
        };
      });
    }
  };

  const toggleSaveQuestion = (question: Question, userAnswerIndex: number) => {
    setUserStats(prev => {
      const isAlreadySaved = prev.savedHistory.some(q => q.question === question.question);
      if (isAlreadySaved) {
        return {
          ...prev,
          savedHistory: prev.savedHistory.filter(q => q.question !== question.question)
        };
      } else {
        const saveEntry: WrongQuestion = {
          ...question,
          userAnswerIndex,
          timestamp: Date.now()
        };
        return {
          ...prev,
          savedHistory: [saveEntry, ...prev.savedHistory].slice(0, 100)
        };
      }
    });
  };

  const handleDeleteWrong = (timestamp: number) => {
    setUserStats(prev => {
      const itemToDelete = prev.wrongHistory.find(q => q.timestamp === timestamp);
      if (!itemToDelete) return prev;

      const point = itemToDelete.grammarPoint;
      const newCounts = { ...prev.wrongCounts };
      if (newCounts[point] > 0) {
        newCounts[point]--;
        if (newCounts[point] === 0) delete newCounts[point];
      }

      return {
        ...prev,
        wrongHistory: prev.wrongHistory.filter(q => q.timestamp !== timestamp),
        wrongCounts: newCounts
      };
    });
  };

  const handleDeleteSaved = (timestamp: number) => {
    setUserStats(prev => ({
      ...prev,
      savedHistory: prev.savedHistory.filter(q => q.timestamp !== timestamp)
    }));
  };

  // 请求清空
  const requestClearHistory = (type: 'details' | 'saved') => {
    setClearConfirm({ isOpen: true, type });
  };

  // 执行清空
  const executeClearHistory = () => {
    const type = clearConfirm.type;
    setUserStats(prev => {
      if (type === 'details') {
        return { ...prev, wrongHistory: [], wrongCounts: {} };
      } else {
        return { ...prev, savedHistory: [] };
      }
    });
    setClearConfirm({ isOpen: false, type: null });
  };

  const startQuiz = async (count: number, difficulty: Difficulty, points: string[]) => {
    setView(AppState.LOADING);
    setLoadingMsg(`AI 正在生成专项练习题...`);
    try {
      const newQuestions = await generateGrammarQuestions(count, points, difficulty);
      if (!newQuestions || newQuestions.length === 0) throw new Error("EMPTY_DATA");
      setQuestions(newQuestions);
      setView(AppState.QUIZ);
    } catch (error: any) {
      console.error("Quiz Generation Error:", error);
      alert("AI 生成试题遇到点小状况，请稍后重试。");
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
          onQuotaError={() => alert("当前请求过快，请休息一下。")}
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
          onClear={requestClearHistory} 
          onDeleteWrong={handleDeleteWrong}
          onDeleteSaved={handleDeleteSaved}
          onStartQuiz={(point) => startQuiz(10, '中等', [point])}
          initialTab={reviewInitialTab}
        />
      )}

      {/* 全局清空确认弹窗 */}
      {clearConfirm.isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-fadeIn">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">⚠️</div>
              <h3 className="text-xl font-black text-gray-900">确定要清空{clearConfirm.type === 'details' ? '所有错题' : '所有收藏'}吗？</h3>
              <p className="text-xs text-gray-400 mt-2 font-medium">此操作不可逆，将清除本地和云端对应的该类记录。</p>
            </div>
            <div className="flex flex-col gap-3">
              <button 
                onClick={executeClearHistory} 
                className="w-full py-4.5 bg-gray-900 text-white rounded-2xl font-black shadow-lg active:scale-95 transition-all"
              >
                全部清空
              </button>
              <button 
                onClick={() => setClearConfirm({ isOpen: false, type: null })} 
                className="w-full py-4.5 bg-gray-100 text-gray-500 rounded-2xl font-bold active:scale-95 transition-all"
              >
                点错了，返回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
