
import React, { useState, useEffect, useCallback } from 'react';
import { AppState, Question, QuizResults, UserStats, Difficulty, WrongQuestion } from './types';
import { generateGrammarQuestions } from './services/geminiService';
import HomeView from './components/HomeView';
import QuizView from './components/QuizView';
import ResultView from './components/ResultView';
import LoadingView from './components/LoadingView';
import ReviewView from './components/ReviewView';
import StatsView from './components/StatsView';

// 扩展 window 接口以识别 AI Studio 特有方法
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    outputApiKey: () => string;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    // Fix: Added readonly to match possible existing global declarations
    readonly aistudio: AIStudio;
  }
}

const App: React.FC = () => {
  const [view, setView] = useState<AppState>(AppState.HOME);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [results, setResults] = useState<QuizResults | null>(null);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [quizStartTime, setQuizStartTime] = useState<number>(0);
  const [isApiKeyReady, setIsApiKeyReady] = useState(false);
  const [isOpeningDialog, setIsOpeningDialog] = useState(false);
  
  // Fix: Added missing state variables to handle quiz generation, review navigation, and confirmation dialogs
  const [isProcessing, setIsProcessing] = useState(false);
  const [reviewInitialTab, setReviewInitialTab] = useState<'summary' | 'details' | 'saved'>('summary');
  const [clearConfirm, setClearConfirm] = useState<{ isOpen: boolean; type: 'details' | 'saved' | null }>({
    isOpen: false,
    type: null
  });

  // 用于强制触发组件刷新的版本号
  const [keyVersion, setKeyVersion] = useState(0);
  
  const [apiInfo, setApiInfo] = useState({
    fingerprint: '未关联',
    uid: 'ID_NULL',
    isPlaceholder: true,
    lastUpdate: 'N/A'
  });
  
  const [userStats, setUserStats] = useState<UserStats>(() => {
    const saved = localStorage.getItem('gaokao_stats_v5');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          wrongCounts: parsed.wrongCounts || {},
          wrongHistory: parsed.wrongHistory || [],
          savedHistory: parsed.savedHistory || [],
          totalQuestionsAttempted: parsed.totalQuestionsAttempted || 0,
          totalCorrectAnswers: parsed.totalCorrectAnswers || 0,
          totalStudyTime: parsed.totalStudyTime || 0,
          dailyStats: parsed.dailyStats || {}
        };
      } catch (e) {
        return { 
          wrongCounts: {}, wrongHistory: [], savedHistory: [], 
          totalQuestionsAttempted: 0, totalCorrectAnswers: 0, totalStudyTime: 0, dailyStats: {} 
        };
      }
    }
    return { 
      wrongCounts: {}, wrongHistory: [], savedHistory: [], 
      totalQuestionsAttempted: 0, totalCorrectAnswers: 0, totalStudyTime: 0, dailyStats: {} 
    };
  });

  useEffect(() => {
    localStorage.setItem('gaokao_stats_v5', JSON.stringify(userStats));
  }, [userStats]);

  const refreshApiInfo = useCallback(() => {
    // 强制从环境变量中读取，避免闭包过时
    const key = (process.env.API_KEY as string) || '';
    const isPlaceholder = !key || !key.startsWith('AIza');
    
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i);
      hash |= 0;
    }
    const uid = Math.abs(hash).toString(16).toUpperCase().substring(0, 6);

    setApiInfo({
      fingerprint: key.length > 12 
        ? `${key.substring(0, 6)}...${key.substring(key.length - 6)}` 
        : (key || 'NONE'),
      uid: isPlaceholder ? 'DEFAULT' : `PRJ-${uid}`,
      isPlaceholder,
      lastUpdate: new Date().toLocaleTimeString()
    });
  }, []);

  useEffect(() => {
    const checkKey = async () => {
      try {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setIsApiKeyReady(hasKey);
        refreshApiInfo();
      } catch (e) {
        setIsApiKeyReady(!!(process.env.API_KEY));
        refreshApiInfo();
      }
    };
    checkKey();
  }, [keyVersion, refreshApiInfo]);

  const handleSelectKey = async () => {
    if (isOpeningDialog) return;
    setIsOpeningDialog(true);
    try {
      // 启动 AI Studio 项目选择器
      await window.aistudio.openSelectKey();
      // 选择后，强制增加版本号触发重新读取
      setKeyVersion(v => v + 1);
    } catch (e) {
      console.error("Open Select Key Failed", e);
    } finally {
      // 延迟关闭状态，防止连续点击
      setTimeout(() => setIsOpeningDialog(false), 2000);
    }
  };

  const handleUpdateStats = (newStats: UserStats) => setUserStats(newStats);
  const handleGoToReview = (tab?: 'summary' | 'details' | 'saved') => {
    // Fix: Added state update for review initial tab selection
    if (tab) setReviewInitialTab(tab);
    setView(AppState.REVIEW);
  };
  const handleGoToStats = () => setView(AppState.STATS);

  const handleAnswerSubmitted = (question: Question, userAnswerIndex: number) => {
    if (userAnswerIndex === question.answerIndex) return;
    setUserStats(prev => {
      const point = question.grammarPoint || '通用语法';
      const newWrongCounts = { ...prev.wrongCounts };
      newWrongCounts[point] = (newWrongCounts[point] || 0) + 1;
      const newWrong: WrongQuestion = { ...question, userAnswerIndex, timestamp: Date.now() };
      return { ...prev, wrongCounts: newWrongCounts, wrongHistory: [newWrong, ...prev.wrongHistory].slice(0, 100) };
    });
  };

  const toggleSaveQuestion = (question: Question, userAnswerIndex: number) => {
    setUserStats(prev => {
      const isAlreadySaved = prev.savedHistory.some(q => q.question === question.question);
      if (isAlreadySaved) {
        return { ...prev, savedHistory: prev.savedHistory.filter(q => q.question !== question.question) };
      } else {
        const newSaved: WrongQuestion = { ...question, userAnswerIndex, timestamp: Date.now() };
        return { ...prev, savedHistory: [newSaved, ...prev.savedHistory] };
      }
    });
  };

  const handleDeleteWrong = (timestamp: number) => {
    setUserStats(prev => ({ ...prev, wrongHistory: prev.wrongHistory.filter(q => q.timestamp !== timestamp) }));
  };

  const handleDeleteSaved = (timestamp: number) => {
    setUserStats(prev => ({ ...prev, savedHistory: prev.savedHistory.filter(q => q.timestamp !== timestamp) }));
  };

  const startQuiz = useCallback(async (count: number, difficulty: Difficulty, points: string[]) => {
    // Fix: Prevent multiple concurrent requests
    if (isProcessing) return;
    
    let hasKey = false;
    try {
      hasKey = await window.aistudio.hasSelectedApiKey();
    } catch (e) {
      hasKey = !!(process.env.API_KEY);
    }

    if (!hasKey) {
      await handleSelectKey();
      return;
    }

    // Fix: Set processing state to true during API call
    setIsProcessing(true);
    setView(AppState.LOADING);
    setLoadingMsg(`正在连接云端 AI 项目，验证指纹...`);
    
    try {
      const newQuestions = await generateGrammarQuestions(count, points, difficulty, (msg) => {
        setLoadingMsg(msg);
      });
      
      if (!newQuestions || newQuestions.length === 0) throw new Error("EMPTY_DATA");
      setQuestions(newQuestions);
      setQuizStartTime(Date.now());
      setView(AppState.QUIZ);
    } catch (error: any) {
      const errorMsg = error.message || "";
      if (errorMsg.includes("Requested entity was not found")) {
        alert("当前关联的项目似乎已失效或未开通 API。请点击信号灯图标强制重选。");
        setIsApiKeyReady(false);
      } else if (errorMsg.includes("429")) {
        alert("当前项目已达到今日限额（429）。建议更换另一个项目或稍后再试。");
      } else {
        alert("启动失败，请确保您已在对话框中勾选了一个有效的 API 项目。");
      }
      setView(AppState.HOME);
    } finally {
      // Fix: Reset processing state after call completes
      setIsProcessing(false);
    }
  }, [isProcessing]);

  const finishQuiz = (userAnswers: number[]) => {
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0];
    const duration = Math.floor((Date.now() - quizStartTime) / 1000);
    let score = 0;
    const wrongPoints: string[] = [];
    userAnswers.forEach((ans, idx) => {
      if (ans === questions[idx].answerIndex) score++;
      else wrongPoints.push(questions[idx].grammarPoint);
    });
    setUserStats(prev => {
      const currentDaily = prev.dailyStats[dateKey] || { attempted: 0, correct: 0 };
      return { ...prev, totalQuestionsAttempted: prev.totalQuestionsAttempted + questions.length, totalCorrectAnswers: prev.totalCorrectAnswers + score, totalStudyTime: prev.totalStudyTime + duration, dailyStats: { ...prev.dailyStats, [dateKey]: { attempted: currentDaily.attempted + questions.length, correct: currentDaily.correct + score } } };
    });
    setResults({ score, total: questions.length, answers: userAnswers, questions, wrongGrammarPoints: Array.from(new Set(wrongPoints)), duration });
    setView(AppState.RESULT);
  };

  return (
    <div className="h-[100dvh] bg-gray-50 flex flex-col max-w-md mx-auto relative overflow-hidden shadow-2xl">
      {view === AppState.HOME && (
        <HomeView 
          onStart={startQuiz} 
          stats={userStats} 
          onGoToReview={handleGoToReview}
          onGoToStats={handleGoToStats}
          onUpdateStats={handleUpdateStats}
          apiKeyReady={isApiKeyReady}
          apiInfo={apiInfo}
          onSelectKey={handleSelectKey}
          isOpeningDialog={isOpeningDialog}
        />
      )}
      {view === AppState.LOADING && <LoadingView message={loadingMsg} onCancel={() => setView(AppState.HOME)} />}
      {view === AppState.QUIZ && (
        <QuizView 
          questions={questions} 
          onFinish={finishQuiz} 
          onCancel={() => setView(AppState.HOME)} 
          onQuotaError={() => {
            alert("请求受限，请更换项目。");
            handleSelectKey();
          }}
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
          // Fix: Added clear confirmation handler
          onClear={(type) => setClearConfirm({ isOpen: true, type })} 
          onDeleteWrong={handleDeleteWrong}
          onDeleteSaved={handleDeleteSaved}
          onStartQuiz={(point) => startQuiz(10, '中等', [point])}
          // Fix: Pass initial tab state to ReviewView
          initialTab={reviewInitialTab}
        />
      )}
      {view === AppState.STATS && <StatsView stats={userStats} onBack={() => setView(AppState.HOME)} />}

      {!isApiKeyReady && view === AppState.HOME && (
        <div className="fixed inset-0 z-[500] bg-white flex flex-col items-center justify-center p-8 text-center animate-fadeIn">
          <div className="w-20 h-20 bg-indigo-50 rounded-[30px] flex items-center justify-center text-4xl mb-6 shadow-inner animate-pulse">🛰️</div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">连接 AI 核心</h2>
          <p className="text-gray-400 text-sm mb-8 leading-relaxed px-4">为了启动出题服务，请关联您的 API 项目。</p>
          <button 
            onClick={handleSelectKey}
            className={`w-full py-5 rounded-[24px] font-black text-lg shadow-xl transition-all ${isOpeningDialog ? 'bg-gray-400 text-gray-100' : 'bg-indigo-600 text-white active:scale-95'}`}
          >
            {isOpeningDialog ? '正在唤起对话框...' : '关联 API 项目'}
          </button>
        </div>
      )}

      {/* Fix: Render confirmation dialog when clearConfirm is open */}
      {clearConfirm.isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl">
            <h3 className="text-xl font-black text-center mb-6">确认清空？</h3>
            <div className="flex flex-col gap-3">
              <button onClick={() => {
                setUserStats(prev => {
                  if (clearConfirm.type === 'details') return { ...prev, wrongHistory: [], wrongCounts: {} };
                  return { ...prev, savedHistory: [] };
                });
                setClearConfirm({ isOpen: false, type: null });
              }} className="w-full py-4.5 bg-gray-900 text-white rounded-2xl font-black">确认</button>
              <button onClick={() => setClearConfirm({ isOpen: false, type: null })} className="w-full py-4.5 bg-gray-100 text-gray-500 rounded-2xl font-bold">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
