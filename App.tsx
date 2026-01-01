
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
    outputApiKey: () => string; // 假设环境提供获取当前 Key 的方法
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    // Fix: Removed readonly to avoid "All declarations of 'aistudio' must have identical modifiers" error
    aistudio: AIStudio;
  }
}

const App: React.FC = () => {
  const [view, setView] = useState<AppState>(AppState.HOME);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [results, setResults] = useState<QuizResults | null>(null);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [quizStartTime, setQuizStartTime] = useState<number>(0);
  const [isApiKeyReady, setIsApiKeyReady] = useState(false);
  
  // 详细的 API 状态信息
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

  const [reviewInitialTab, setReviewInitialTab] = useState<'summary' | 'details' | 'saved'>('summary');
  const [isProcessing, setIsProcessing] = useState(false);
  const [clearConfirm, setClearConfirm] = useState<{ isOpen: boolean; type: 'details' | 'saved' | null }>({ isOpen: false, type: null });

  // 增强版指纹提取
  const refreshApiInfo = useCallback(() => {
    const key = process.env.API_KEY || '';
    const isPlaceholder = !key || !key.startsWith('AIza');
    
    // 生成一个简易的 UID 用于区分项目
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

  // 检查 API Key 状态
  useEffect(() => {
    const checkKey = async () => {
      try {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setIsApiKeyReady(hasKey);
        refreshApiInfo();
      } catch (e) {
        setIsApiKeyReady(true);
        refreshApiInfo();
      }
    };
    checkKey();
  }, [refreshApiInfo]);

  const handleSelectKey = async () => {
    // Fix: Remove artificial delay after openSelectKey as per SDK instructions to avoid race conditions
    await window.aistudio.openSelectKey();
    refreshApiInfo();
    setIsApiKeyReady(true);
  };

  useEffect(() => {
    localStorage.setItem('gaokao_stats_v5', JSON.stringify(userStats));
  }, [userStats]);

  const handleUpdateStats = (newStats: UserStats) => {
    setUserStats(newStats);
  };

  const handleGoToReview = (tab?: 'summary' | 'details' | 'saved') => {
    if (tab) setReviewInitialTab(tab);
    setView(AppState.REVIEW);
  };

  const handleGoToStats = () => {
    setView(AppState.STATS);
  };

  const handleAnswerSubmitted = (question: Question, userAnswerIndex: number) => {
    if (userAnswerIndex !== question.answerIndex) {
      setUserStats(prev => {
        const point = question.grammarPoint;
        const newCounts = { ...prev.wrongCounts, [point]: (prev.wrongCounts[point] || 0) + 1 };
        const exists = prev.wrongHistory.some(q => q.question === question.question);
        if (exists) return prev;
        const wrongEntry: WrongQuestion = { ...question, userAnswerIndex, timestamp: Date.now() };
        return { ...prev, wrongCounts: newCounts, wrongHistory: [wrongEntry, ...prev.wrongHistory].slice(0, 200) };
      });
    }
  };

  const toggleSaveQuestion = (question: Question, userAnswerIndex: number) => {
    setUserStats(prev => {
      const isAlreadySaved = prev.savedHistory.some(q => q.question === question.question);
      if (isAlreadySaved) {
        return { ...prev, savedHistory: prev.savedHistory.filter(q => q.question !== question.question) };
      } else {
        const saveEntry: WrongQuestion = { ...question, userAnswerIndex, timestamp: Date.now() };
        return { ...prev, savedHistory: [saveEntry, ...prev.savedHistory].slice(0, 100) };
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
      return { ...prev, wrongHistory: prev.wrongHistory.filter(q => q.timestamp !== timestamp), wrongCounts: newCounts };
    });
  };

  const handleDeleteSaved = (timestamp: number) => {
    setUserStats(prev => ({ ...prev, savedHistory: prev.savedHistory.filter(q => q.timestamp !== timestamp) }));
  };

  const startQuiz = useCallback(async (count: number, difficulty: Difficulty, points: string[]) => {
    if (isProcessing) return;
    
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await handleSelectKey();
      return;
    }

    setIsProcessing(true);
    setView(AppState.LOADING);
    setLoadingMsg(`AI 正在定制专属题目，请稍候...`);
    
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
        alert("项目配置无效或已被重置。请尝试重新关联您的 API 项目。");
        setIsApiKeyReady(false);
      } else if (errorMsg.includes("429")) {
        alert("请求过于频繁（免费项目限制）。请稍等 1 分钟后再试，或者更换付费项目。");
      } else {
        alert("出题遇到状况，请检查网络或点击主页左上角信号图标切换 API 项目。");
      }
      setView(AppState.HOME);
    } finally {
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
      return {
        ...prev,
        totalQuestionsAttempted: prev.totalQuestionsAttempted + questions.length,
        totalCorrectAnswers: prev.totalCorrectAnswers + score,
        totalStudyTime: prev.totalStudyTime + duration,
        dailyStats: {
          ...prev.dailyStats,
          [dateKey]: {
            attempted: currentDaily.attempted + questions.length,
            correct: currentDaily.correct + score
          }
        }
      };
    });

    setResults({ 
      score, 
      total: questions.length, 
      answers: userAnswers, 
      questions, 
      wrongGrammarPoints: Array.from(new Set(wrongPoints)),
      duration
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
          onGoToStats={handleGoToStats}
          onUpdateStats={handleUpdateStats}
          apiKeyReady={isApiKeyReady}
          apiInfo={apiInfo}
          onSelectKey={handleSelectKey}
        />
      )}
      {view === AppState.LOADING && <LoadingView message={loadingMsg} onCancel={() => setView(AppState.HOME)} />}
      {view === AppState.QUIZ && (
        <QuizView 
          questions={questions} 
          onFinish={finishQuiz} 
          onCancel={() => setView(AppState.HOME)} 
          onQuotaError={() => {
            alert("当前项目额度或频率不足（429错误）。建议休息一会或更换 API 项目。");
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
          onClear={(type) => setClearConfirm({ isOpen: true, type })} 
          onDeleteWrong={handleDeleteWrong}
          onDeleteSaved={handleDeleteSaved}
          onStartQuiz={(point) => startQuiz(10, '中等', [point])}
          initialTab={reviewInitialTab}
        />
      )}
      {view === AppState.STATS && (
        <StatsView stats={userStats} onBack={() => setView(AppState.HOME)} />
      )}

      {/* 引导激活屏幕：专门针对 AI Studio 的选择难题 */}
      {!isApiKeyReady && view === AppState.HOME && (
        <div className="fixed inset-0 z-[500] bg-white flex flex-col items-center justify-center p-8 text-center animate-fadeIn overflow-y-auto">
          <div className="w-20 h-20 bg-indigo-50 rounded-[30px] flex items-center justify-center text-4xl mb-6 shadow-inner animate-pulse">🛰️</div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">连接 AI 核心</h2>
          <p className="text-gray-400 text-[13px] mb-8 leading-relaxed px-4 font-medium">
            为了启动出题服务，请关联一个有效的 API 项目。您可以自由选择免费或付费项目。
          </p>
          
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-[28px] p-6 mb-8 text-left space-y-4">
            <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-indigo-500 rounded-full"></span> 操作指引
            </h4>
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 bg-indigo-600 text-white rounded-full text-[10px] flex items-center justify-center font-black">1</span>
                <p className="text-[12px] text-gray-600 font-bold leading-tight">点击下方按钮打开对话框</p>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 bg-indigo-600 text-white rounded-full text-[10px] flex items-center justify-center font-black">2</span>
                <p className="text-[12px] text-gray-600 font-bold leading-tight">如果在导入里看到项目，请<span className="text-indigo-600">关闭小窗口</span>回到主列表勾选它。</p>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 bg-indigo-600 text-white rounded-full text-[10px] flex items-center justify-center font-black">3</span>
                <p className="text-[12px] text-gray-600 font-bold leading-tight">点击【确认/完成】即可开始练习。</p>
              </div>
            </div>
          </div>

          <button 
            onClick={handleSelectKey}
            className="w-full py-5 bg-indigo-600 text-white rounded-[24px] font-black text-lg shadow-xl shadow-indigo-100 active:scale-95 transition-all mb-6"
          >
            去关联 API 项目
          </button>
          
          <p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest">
            * 免费项目每分钟请求次数有限
          </p>
        </div>
      )}

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
