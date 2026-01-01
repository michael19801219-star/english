
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
  
  // 用于手动输入的 Key
  const [inputKey, setInputKey] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('gaokao_stats_v2');
    if (saved) setUserStats(JSON.parse(saved));
    
    // 初始化检查 Key 状态
    const checkKeyStatus = async () => {
      const localKey = localStorage.getItem('user_custom_gemini_key');
      if (localKey) {
        setIsUsingPersonalKey(true);
        setInputKey(localKey);
      } else if ((window as any).aistudio?.hasSelectedApiKey) {
        try {
          const has = await (window as any).aistudio.hasSelectedApiKey();
          setIsUsingPersonalKey(has);
        } catch (e) { console.warn(e); }
      }
    };
    checkKeyStatus();
  }, []);

  const handleSaveInputKey = () => {
    if (inputKey.trim().startsWith('AIza')) {
      localStorage.setItem('user_custom_gemini_key', inputKey.trim());
      setIsUsingPersonalKey(true);
      setShowQuotaModal(false);
      alert("API Key 已更新，现在可以开始训练了！");
    } else {
      alert("请输入有效的 Gemini API Key (以 AIza 开头)");
    }
  };

  const handleOpenSelectKey = async () => {
    if ((window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
      setIsUsingPersonalKey(true);
      setShowQuotaModal(false);
    } else {
      // 如果不在 AI Studio 环境，则显示手动输入界面
      setErrorType('KEY_MISSING');
      setShowQuotaModal(true);
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
      console.error("Logic Error:", error);
      const msg = error.message;
      if (msg === "KEY_EXPIRED" || msg === "KEY_NOT_FOUND" || msg === "KEY_MISSING") {
        setErrorType('KEY_EXPIRED');
        setShowQuotaModal(true);
      } else if (msg === "QUOTA_EXCEEDED") {
        setErrorType('RPM');
        setShowQuotaModal(true);
      } else {
        const strErr = JSON.stringify(error).toLowerCase();
        if (strErr.includes('expired') || strErr.includes('key')) {
          setErrorType('KEY_EXPIRED');
          setShowQuotaModal(true);
        } else {
          alert(`出题失败: ${msg || '网络抖动'}`);
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
      if (ans === questions[idx].answerIndex) score++;
      else {
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
        onClick={() => setShowQuotaModal(true)}
        className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 rounded-full backdrop-blur-md border flex items-center gap-2 cursor-pointer transition-all active:scale-95 ${isUsingPersonalKey ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-white/80 text-gray-500 border-gray-100 shadow-sm'}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isUsingPersonalKey ? 'bg-green-400 animate-pulse' : 'bg-gray-300'}`}></span>
        <span className="text-[10px] font-black uppercase tracking-widest">
          {isUsingPersonalKey ? '个人密钥已激活' : '公共模式 (额度受限)'}
        </span>
        <span className="text-xs">⚙️</span>
      </div>

      {view === AppState.HOME && <HomeView onStart={startQuiz} stats={userStats} onGoToReview={(tab) => { setReviewInitialTab(tab || 'summary'); setView(AppState.REVIEW); }} />}
      {view === AppState.LOADING && <LoadingView message={loadingMsg} onCancel={() => setView(AppState.HOME)} />}
      {view === AppState.QUIZ && <QuizView questions={questions} onFinish={finishQuiz} onCancel={() => setView(AppState.HOME)} onQuotaError={() => { setErrorType('RPM'); setShowQuotaModal(true); }} />}
      {view === AppState.RESULT && results && <ResultView results={results} onRestart={() => setView(AppState.HOME)} onConsolidate={() => results && results.wrongGrammarPoints.length > 0 && startQuiz(10, '中等', results.wrongGrammarPoints)} />}
      {view === AppState.REVIEW && <ReviewView history={userStats.wrongHistory} onBack={() => setView(AppState.HOME)} onClear={() => { if(confirm('确定清空所有记录吗？')){setUserStats({wrongCounts:{}, wrongHistory:[]}); localStorage.removeItem('gaokao_stats_v2');}}} onStartQuiz={(p) => startQuiz(10, '中等', [p])} initialTab={reviewInitialTab} />}

      {/* 增强型密钥手动输入弹窗 */}
      {showQuotaModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-xs rounded-[40px] p-8 shadow-2xl text-center border border-gray-100">
            <div className="text-5xl mb-6">
              {errorType === 'KEY_EXPIRED' ? '🔑' : '⏳'}
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">
              {errorType === 'KEY_EXPIRED' ? '更新 API Key' : '公共流量受限'}
            </h3>
            
            <p className="text-xs text-gray-400 mb-6 px-2 font-medium">
              请在下方粘贴您申请的 Gemini API Key。使用个人 Key 可享受无限次练习。
            </p>

            <div className="space-y-4">
              <input 
                type="text"
                placeholder="粘贴 AIzaSy... 开头的密钥"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-sm font-mono focus:border-indigo-500 transition-all outline-none"
              />
              
              <button 
                onClick={handleSaveInputKey}
                className="w-full py-4.5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 active:scale-95 transition-all"
              >
                保存并启动应用
              </button>
              
              <div className="flex justify-center gap-4 pt-2">
                <button 
                  onClick={() => setShowQuotaModal(false)}
                  className="text-gray-300 font-bold text-xs"
                >
                  取消
                </button>
                <button 
                  onClick={() => { localStorage.removeItem('user_custom_gemini_key'); setIsUsingPersonalKey(false); window.location.reload(); }}
                  className="text-red-300 font-bold text-xs"
                >
                  重置 Key
                </button>
              </div>
            </div>
            
            <div className="mt-8 pt-4 border-t border-gray-50">
              <p className="text-[9px] text-gray-300 leading-tight">
                * 您的 Key 将仅保存在本地浏览器缓存中。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
