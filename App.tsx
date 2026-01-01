
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
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [errorType, setErrorType] = useState<'RPM' | 'KEY' | 'MODEL' | 'PERSONAL'>('RPM');
  const [reviewInitialTab, setReviewInitialTab] = useState<'summary' | 'details'>('summary');
  const [isUsingPersonalKey, setIsUsingPersonalKey] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('gaokao_stats_v2');
    if (saved) setUserStats(JSON.parse(saved));
    
    // 检查是否有选定的 API Key
    const checkKeyStatus = async () => {
      if ((window as any).aistudio?.hasSelectedApiKey) {
        try {
          const has = await (window as any).aistudio.hasSelectedApiKey();
          setIsUsingPersonalKey(has);
        } catch (e) {
          console.warn("Key status check failed", e);
        }
      }
    };
    checkKeyStatus();
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

  const handleOpenSelectKey = async () => {
    if ((window as any).aistudio?.openSelectKey) {
      // 触发弹窗
      await (window as any).aistudio.openSelectKey();
      // 遵循 Race Condition 缓解规则：触发后立即认为成功并继续
      setIsUsingPersonalKey(true);
      setShowQuotaModal(false);
      alert("已尝试应用新 Key，请重新启动训练！");
    } else {
      window.open('https://ai.google.dev/gemini-api/docs/billing', '_blank');
    }
  };

  const startQuiz = async (count: number, difficulty: Difficulty, points: string[]) => {
    setView(AppState.LOADING);
    setLoadingMsg(`正在为您调取 ${difficulty} 难度的高考试题...`);
    try {
      const newQuestions = await generateGrammarQuestions(count, points, difficulty);
      setQuestions(newQuestions);
      setView(AppState.QUIZ);
    } catch (error: any) {
      console.error("Quiz Generation Error:", error);
      const errorMsg = error.message || "";
      
      if (errorMsg === "API_KEY_MISSING") {
        setErrorType('KEY');
        setShowQuotaModal(true);
      } else if (errorMsg === "KEY_INVALID_OR_NOT_FOUND") {
        setErrorType('PERSONAL');
        setShowQuotaModal(true);
      } else if (errorMsg === "QUOTA_EXCEEDED" || errorMsg.includes("429")) {
        setErrorType('RPM');
        setShowQuotaModal(true);
      } else {
        alert(`系统繁忙: ${errorMsg}`);
      }
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto relative overflow-hidden shadow-2xl">
      {/* 顶部个人状态标签 */}
      {isUsingPersonalKey && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-1.5 bg-black/80 backdrop-blur-xl text-white text-[10px] font-black rounded-full shadow-2xl border border-white/20 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
          <span>专属通道已开启 (不限流量)</span>
        </div>
      )}

      {view === AppState.HOME && (
        <HomeView 
          onStart={startQuiz} 
          stats={userStats} 
          onGoToReview={(tab) => { setReviewInitialTab(tab || 'summary'); setView(AppState.REVIEW); }} 
        />
      )}
      {view === AppState.LOADING && <LoadingView message={loadingMsg} onCancel={() => setView(AppState.HOME)} />}
      {view === AppState.QUIZ && (
        <QuizView 
          questions={questions} 
          onFinish={finishQuiz} 
          onCancel={() => setView(AppState.HOME)} 
          onQuotaError={() => { setErrorType('RPM'); setShowQuotaModal(true); }} 
        />
      )}
      {view === AppState.RESULT && results && (
        <ResultView 
          results={results} 
          onRestart={() => setView(AppState.HOME)} 
          onConsolidate={() => results && results.wrongGrammarPoints.length > 0 && startQuiz(10, '中等', results.wrongGrammarPoints)} 
        />
      )}
      {view === AppState.REVIEW && (
        <ReviewView 
          history={userStats.wrongHistory} 
          onBack={() => setView(AppState.HOME)} 
          onClear={() => { if(confirm('确定清空所有错题记录吗？')){setUserStats({wrongCounts:{}, wrongHistory:[]}); localStorage.removeItem('gaokao_stats_v2');}}} 
          onStartQuiz={(p) => startQuiz(10, '中等', [p])}
          initialTab={reviewInitialTab}
        />
      )}

      {/* 配额错误/引导弹窗 */}
      {showQuotaModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-xs rounded-[32px] p-8 shadow-2xl text-center border border-gray-100">
            <div className="text-5xl mb-6">
              {errorType === 'RPM' ? '🔋' : errorType === 'PERSONAL' ? '🔐' : '📡'}
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2 leading-tight">
              {errorType === 'RPM' ? '公共流量过载' : 'Key 需要重新验证'}
            </h3>
            
            <p className="text-xs text-gray-500 mb-8 leading-relaxed px-2">
              目前公共通道使用人数过多，建议使用您刚才申请的 **个人 API Key** 获得无限次练习机会。
            </p>

            <div className="flex flex-col gap-3">
              <button 
                onClick={handleOpenSelectKey}
                className="w-full py-4.5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span>使用个人 API Key</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </button>
              <button 
                onClick={() => setShowQuotaModal(false)}
                className="w-full py-3 text-gray-400 font-bold text-sm"
              >
                暂时放弃
              </button>
            </div>
            
            <p className="mt-6 text-[9px] text-gray-300 font-medium">
              * 您可以在弹出的界面中粘贴您的 Key: <br/>
              AIzaSy...CHF00Cs
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
