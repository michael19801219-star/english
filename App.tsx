
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
  const [errorType, setErrorType] = useState<'RPM' | 'KEY_EXPIRED' | 'KEY_MISSING'>('RPM');
  const [reviewInitialTab, setReviewInitialTab] = useState<'summary' | 'details'>('summary');
  const [isUsingPersonalKey, setIsUsingPersonalKey] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('gaokao_stats_v2');
    if (saved) setUserStats(JSON.parse(saved));
    
    const checkKeyStatus = async () => {
      if ((window as any).aistudio?.hasSelectedApiKey) {
        try {
          const has = await (window as any).aistudio.hasSelectedApiKey();
          setIsUsingPersonalKey(has);
        } catch (e) {
          console.warn("Key check failed", e);
        }
      }
    };
    checkKeyStatus();
  }, []);

  const handleOpenSelectKey = async () => {
    if ((window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
      setIsUsingPersonalKey(true);
      setShowQuotaModal(false);
      // 成功触发后强制回到首页刷新状态
      setView(AppState.HOME);
    } else {
      window.open('https://ai.google.dev/gemini-api/docs/billing', '_blank');
    }
  };

  const startQuiz = async (count: number, difficulty: Difficulty, points: string[]) => {
    setView(AppState.LOADING);
    setLoadingMsg(`正在调取最新高考考点...`);
    try {
      const newQuestions = await generateGrammarQuestions(count, points, difficulty);
      setQuestions(newQuestions);
      setView(AppState.QUIZ);
    } catch (error: any) {
      console.error("App Logic Catch Error:", error);
      const msg = error.message;
      
      if (msg === "KEY_EXPIRED" || msg === "KEY_NOT_FOUND") {
        setErrorType('KEY_EXPIRED');
        setShowQuotaModal(true);
      } else if (msg === "KEY_MISSING") {
        setErrorType('KEY_MISSING');
        setShowQuotaModal(true);
      } else if (msg === "QUOTA_EXCEEDED") {
        setErrorType('RPM');
        setShowQuotaModal(true);
      } else {
        // 对于未识别的复杂 JSON 错误，进行内容匹配
        const strErr = JSON.stringify(error).toLowerCase();
        if (strErr.includes('expired') || strErr.includes('invalid')) {
          setErrorType('KEY_EXPIRED');
          setShowQuotaModal(true);
        } else {
          alert(`系统错误：${msg || '未知异常'}`);
        }
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
        newWrongEntries.push({ ...questions[idx], userAnswerIndex: ans, timestamp: Date.now() });
      }
    });

    const newStats = { ...userStats };
    wrongPoints.forEach(pt => { newStats.wrongCounts[pt] = (newStats.wrongCounts[pt] || 0) + 1; });
    newStats.wrongHistory = [...newWrongEntries, ...newStats.wrongHistory].slice(0, 50);
    setUserStats(newStats);
    localStorage.setItem('gaokao_stats_v2', JSON.stringify(newStats));
    
    setResults({ score, total: questions.length, answers: userAnswers, questions, wrongGrammarPoints: Array.from(new Set(wrongPoints)) });
    setView(AppState.RESULT);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto relative overflow-hidden shadow-2xl">
      {/* 状态指示器 */}
      <div 
        onClick={handleOpenSelectKey}
        className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 rounded-full backdrop-blur-md border flex items-center gap-2 cursor-pointer transition-all active:scale-95 ${isUsingPersonalKey ? 'bg-green-500/90 text-white border-white/20' : 'bg-white/80 text-gray-500 border-gray-100 shadow-sm'}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isUsingPersonalKey ? 'bg-white animate-pulse' : 'bg-gray-300'}`}></span>
        <span className="text-[10px] font-black uppercase tracking-widest">
          {isUsingPersonalKey ? 'Personal Mode ON' : 'Public Mode'}
        </span>
        <span className="text-xs">⚙️</span>
      </div>

      {view === AppState.HOME && <HomeView onStart={startQuiz} stats={userStats} onGoToReview={(tab) => { setReviewInitialTab(tab || 'summary'); setView(AppState.REVIEW); }} />}
      {view === AppState.LOADING && <LoadingView message={loadingMsg} onCancel={() => setView(AppState.HOME)} />}
      {view === AppState.QUIZ && <QuizView questions={questions} onFinish={finishQuiz} onCancel={() => setView(AppState.HOME)} onQuotaError={() => { setErrorType('RPM'); setShowQuotaModal(true); }} />}
      {view === AppState.RESULT && results && <ResultView results={results} onRestart={() => setView(AppState.HOME)} onConsolidate={() => results && results.wrongGrammarPoints.length > 0 && startQuiz(10, '中等', results.wrongGrammarPoints)} />}
      {view === AppState.REVIEW && <ReviewView history={userStats.wrongHistory} onBack={() => setView(AppState.HOME)} onClear={() => { if(confirm('确定清空所有错题记录吗？')){setUserStats({wrongCounts:{}, wrongHistory:[]}); localStorage.removeItem('gaokao_stats_v2');}}} onStartQuiz={(p) => startQuiz(10, '中等', [p])} initialTab={reviewInitialTab} />}

      {/* 统一的错误/密钥引导弹窗 */}
      {showQuotaModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-xs rounded-[40px] p-8 shadow-2xl text-center border border-gray-100">
            <div className="text-5xl mb-6">
              {errorType === 'KEY_EXPIRED' ? '🔑' : '⏳'}
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2 leading-tight">
              {errorType === 'KEY_EXPIRED' ? 'API 密钥已过期' : '当前公共流量过大'}
            </h3>
            
            <p className="text-xs text-gray-400 mb-8 leading-relaxed px-2 font-medium">
              {errorType === 'KEY_EXPIRED' 
                ? '您当前使用的密钥已失效。请点击下方按钮，在弹出窗口中粘贴您新申请的 API Key。' 
                : '公共通道已满负荷。建议立即切换至您的个人专用 API Key 获得无限次练习机会。'}
            </p>

            <div className="flex flex-col gap-3">
              <button 
                onClick={handleOpenSelectKey}
                className="w-full py-4.5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span>立即更换/应用个人 Key</span>
              </button>
              <button 
                onClick={() => setShowQuotaModal(false)}
                className="w-full py-3 text-gray-300 font-bold text-xs"
              >
                稍后再说
              </button>
            </div>
            
            <div className="mt-8 pt-4 border-t border-gray-50">
              <p className="text-[9px] text-gray-300 leading-tight">
                * 粘贴后请确保点击确定。<br/>您的新 Key: AIzaSy...CHF00Cs
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
