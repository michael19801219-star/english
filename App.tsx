
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
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [errorType, setErrorType] = useState<'RPM' | 'KEY' | 'MODEL'>('RPM');
  const [reviewInitialTab, setReviewInitialTab] = useState<'summary' | 'details' | 'saved'>('summary');

  useEffect(() => {
    const saved = localStorage.getItem('gaokao_stats_v2');
    if (saved) {
      const parsed = JSON.parse(saved);
      setUserStats({
        ...parsed,
        savedHistory: parsed.savedHistory || []
      });
    }
  }, []);

  const saveStatsToStorage = (updatedStats: UserStats) => {
    setUserStats(updatedStats);
    localStorage.setItem('gaokao_stats_v2', JSON.stringify(updatedStats));
  };

  const handleAnswerSubmitted = (question: Question, userAnswerIndex: number) => {
    if (userAnswerIndex !== question.answerIndex) {
      const newStats = { ...userStats };
      const point = question.grammarPoint;
      newStats.wrongCounts[point] = (newStats.wrongCounts[point] || 0) + 1;
      const wrongEntry: WrongQuestion = {
        ...question,
        userAnswerIndex,
        timestamp: Date.now()
      };
      const filteredHistory = newStats.wrongHistory.filter(q => q.question !== question.question);
      newStats.wrongHistory = [wrongEntry, ...filteredHistory].slice(0, 100);
      saveStatsToStorage(newStats);
    }
  };

  const toggleSaveQuestion = (question: Question, userAnswerIndex: number) => {
    const newStats = { ...userStats };
    const isSaved = newStats.savedHistory.some(q => q.question === question.question);
    if (isSaved) {
      newStats.savedHistory = newStats.savedHistory.filter(q => q.question !== question.question);
    } else {
      newStats.savedHistory = [{ ...question, userAnswerIndex, timestamp: Date.now() }, ...newStats.savedHistory].slice(0, 50);
    }
    saveStatsToStorage(newStats);
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
      } else if (errorMsg === "MODEL_NOT_FOUND") {
        setErrorType('MODEL');
        setShowQuotaModal(true);
      } else if (errorMsg === "QUOTA_EXCEEDED" || errorMsg.includes("429")) {
        setErrorType('RPM');
        setShowQuotaModal(true);
      } else {
        let readableError = errorMsg;
        try {
          if (errorMsg.startsWith('{')) {
            const parsed = JSON.parse(errorMsg);
            readableError = parsed.error?.message || errorMsg;
          }
        } catch(e) {}
        alert(`生成失败: ${readableError}`);
      }
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

  const handleConsolidate = () => {
    if (results && results.wrongGrammarPoints.length > 0) {
      startQuiz(10, '中等', results.wrongGrammarPoints);
    }
  };

  const clearHistory = () => {
    if (confirm('确定要清空错题本吗？')) {
      const reset = { wrongCounts: {}, wrongHistory: [], savedHistory: [] };
      saveStatsToStorage(reset);
    }
  };

  const handleCancelQuiz = () => {
    setView(AppState.HOME);
    setQuestions([]);
  };

  const handleGoToReview = (tab: 'summary' | 'details' | 'saved' = 'summary') => {
    setReviewInitialTab(tab);
    setView(AppState.REVIEW);
  };

  return (
    <div className="h-[100dvh] bg-gray-50 flex flex-col max-w-md mx-auto relative overflow-hidden shadow-2xl">
      {view === AppState.HOME && (
        <HomeView 
          onStart={startQuiz} 
          stats={userStats} 
          onGoToReview={handleGoToReview} 
        />
      )}
      {view === AppState.LOADING && <LoadingView message={loadingMsg} onCancel={() => setView(AppState.HOME)} />}
      {view === AppState.QUIZ && (
        <QuizView 
          questions={questions} 
          onFinish={finishQuiz} 
          onCancel={handleCancelQuiz} 
          onQuotaError={() => {
            setErrorType('RPM');
            setShowQuotaModal(true);
          }}
          onAnswerSubmitted={handleAnswerSubmitted}
          onToggleSave={toggleSaveQuestion}
          savedHistory={userStats.savedHistory}
        />
      )}
      {view === AppState.RESULT && results && (
        <ResultView results={results} onRestart={() => setView(AppState.HOME)} onConsolidate={handleConsolidate} />
      )}
      {view === AppState.REVIEW && (
        <ReviewView 
          history={userStats.wrongHistory} 
          savedHistory={userStats.savedHistory}
          onBack={() => setView(AppState.HOME)} 
          onClear={clearHistory} 
          onStartQuiz={(point) => startQuiz(10, '中等', [point])}
          initialTab={reviewInitialTab}
        />
      )}

      {showQuotaModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-xs rounded-[32px] p-8 shadow-2xl text-center">
            <div className="text-4xl mb-4">
              {errorType === 'KEY' ? '🔑' : errorType === 'MODEL' ? '🚫' : '⏳'}
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">
              {errorType === 'KEY' ? '未找到 API 密钥' : errorType === 'MODEL' ? '系统升级中' : '老师正在休息'}
            </h3>
            
            <div className="text-left space-y-3 mb-6">
              {errorType === 'KEY' && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                   <p className="text-[11px] font-bold text-red-700 mb-1">配置错误</p>
                   <p className="text-[10px] text-red-600/70 leading-relaxed">Vercel 的 API_KEY 变量未生效。请确保已添加变量并点击了 **Redeploy**。</p>
                </div>
              )}
              {errorType === 'MODEL' && (
                <div className="p-3 bg-orange-50 rounded-xl border border-orange-100">
                   <p className="text-[11px] font-bold text-orange-700 mb-1">模型路径错误</p>
                   <p className="text-[10px] text-orange-600/70 leading-relaxed">AI 模型名称在当前区域不可用。已尝试自动修复，请重新点击开始。</p>
                </div>
              )}
              {errorType === 'RPM' && (
                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                   <p className="text-[11px] font-black text-indigo-700 mb-1">频率限制 (RPM)</p>
                   <p className="text-[10px] text-indigo-600/70 leading-relaxed">免费版 AI 每分钟限 15 次。刚才请求太密集了，请静候 30 秒再点击开始。</p>
                </div>
              )}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                 <p className="text-[11px] font-bold text-amber-700 mb-1">解决办法</p>
                 <p className="text-[10px] text-amber-600/70 leading-relaxed">
                   1. 减少生成的题量（建议 5-10 题）。<br/>
                   2. 检查手机代理（VPN）是否开启且稳定。
                 </p>
              </div>
            </div>

            <button 
              onClick={() => setShowQuotaModal(false)}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 active:scale-95 transition-transform"
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
