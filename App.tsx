
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
    
    // 检查是否已经选择了个人 Key
    const checkKey = async () => {
      if ((window as any).aistudio?.hasSelectedApiKey) {
        const has = await (window as any).aistudio.hasSelectedApiKey();
        setIsUsingPersonalKey(has);
      }
    };
    checkKey();
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
      await (window as any).aistudio.openSelectKey();
      setIsUsingPersonalKey(true);
      setShowQuotaModal(false);
      alert("已切换至个人 Key 模式，请重新开始训练。");
    } else {
      window.open('https://ai.google.dev/gemini-api/docs/billing', '_blank');
      alert("当前环境不支持在线选 Key，请检查 Vercel 环境变量设置。");
    }
  };

  const startQuiz = async (count: number, difficulty: Difficulty, points: string[]) => {
    setView(AppState.LOADING);
    setLoadingMsg(`AI 正在为你生成 ${difficulty} 难度的试卷...`);
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
      } else if (errorMsg === "MODEL_NOT_FOUND") {
        setErrorType('MODEL');
        setShowQuotaModal(true);
      } else if (errorMsg === "QUOTA_EXCEEDED" || errorMsg.includes("429")) {
        setErrorType('RPM');
        setShowQuotaModal(true);
      } else {
        alert(`生成失败: ${errorMsg}`);
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
      {isUsingPersonalKey && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-3 py-1 bg-green-500/90 backdrop-blur-md text-white text-[9px] font-black rounded-full shadow-lg flex items-center gap-1.5 border border-white/20">
          <span className="animate-pulse">●</span> 个人模式已开启
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
          onClear={() => { if(confirm('清空？')){setUserStats({wrongCounts:{}, wrongHistory:[]}); localStorage.removeItem('gaokao_stats_v2');}}} 
          onStartQuiz={(p) => startQuiz(10, '中等', [p])}
          initialTab={reviewInitialTab}
        />
      )}

      {showQuotaModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-xs rounded-[32px] p-8 shadow-2xl text-center">
            <div className="text-4xl mb-4">
              {errorType === 'RPM' ? '⏳' : errorType === 'PERSONAL' ? '🔑' : '🚫'}
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">
              {errorType === 'RPM' ? '请求太频繁啦' : errorType === 'PERSONAL' ? 'Key 已失效' : '暂时无法连接'}
            </h3>
            
            <div className="text-left space-y-3 mb-6">
              {errorType === 'RPM' && (
                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                   <p className="text-[11px] font-black text-indigo-700 mb-1">配额已耗尽 (RPD/RPM)</p>
                   <p className="text-[10px] text-indigo-600/70 leading-relaxed">公共 API Key 今日配额已用完，或分钟限制触发。Google 每日下午 3-4 点左右重置配额。</p>
                </div>
              )}
              
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                 <p className="text-[11px] font-bold text-amber-700 mb-1">推荐方案</p>
                 <p className="text-[10px] text-amber-600/70 leading-relaxed">
                   如果您有自己的 Google Cloud 项目，可以点击下方按钮选择个人 Key，彻底解决配额不足问题。
                 </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={handleOpenSelectKey}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 active:scale-95 transition-all"
              >
                选择个人 API Key (无限量)
              </button>
              <button 
                onClick={() => setShowQuotaModal(false)}
                className="w-full py-3 text-gray-400 font-bold text-sm"
              >
                稍后再试
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
