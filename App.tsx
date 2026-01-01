
import React, { useState, useEffect, useCallback } from 'react';
import { AppState, Question, QuizResults, UserStats, Difficulty, WrongQuestion } from './types';
import { generateGrammarQuestions } from './services/geminiService';
import HomeView from './components/HomeView';
import QuizView from './components/QuizView';
import ResultView from './components/ResultView';
import LoadingView from './components/LoadingView';
import ReviewView from './components/ReviewView';
import StatsView from './components/StatsView';

const App: React.FC = () => {
  const [view, setView] = useState<AppState>(AppState.HOME);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [results, setResults] = useState<QuizResults | null>(null);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [quizStartTime, setQuizStartTime] = useState<number>(0);
  
  // API Key 状态管理
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [inputKey, setInputKey] = useState(localStorage.getItem('user_custom_gemini_key') || '');
  const [isUsingPersonalKey, setIsUsingPersonalKey] = useState(!!localStorage.getItem('user_custom_gemini_key'));

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

  useEffect(() => {
    localStorage.setItem('gaokao_stats_v5', JSON.stringify(userStats));
  }, [userStats]);

  const handleUpdateStats = (newStats: UserStats) => {
    setUserStats(newStats);
  };

  const handleSaveKey = () => {
    const trimmed = inputKey.trim();
    if (trimmed.startsWith('AIza')) {
      localStorage.setItem('user_custom_gemini_key', trimmed);
      setIsUsingPersonalKey(true);
      setShowKeyModal(false);
      // 这里的 alert 用于反馈，实际业务中 key 已经在下一次 Service 调用时生效
      console.log("API Key Updated Successfully");
    } else if (trimmed === '') {
      handleResetKey();
    } else {
      alert("⚠️ 请输入有效的 Gemini API Key (以 AIza 开头)");
    }
  };

  const handleResetKey = () => {
    localStorage.removeItem('user_custom_gemini_key');
    setInputKey('');
    setIsUsingPersonalKey(false);
    setShowKeyModal(false);
    alert("已重置并切回公共模式");
  };

  const startQuiz = useCallback(async (count: number, difficulty: Difficulty, points: string[]) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setView(AppState.LOADING);
    setLoadingMsg(`AI 正在定制专属题目，请稍候...`);
    
    try {
      const newQuestions = await generateGrammarQuestions(count, points, difficulty, (msg) => {
        setLoadingMsg(msg);
      });
      
      setQuestions(newQuestions);
      setQuizStartTime(Date.now());
      setView(AppState.QUIZ);
    } catch (error: any) {
      console.error("Quiz Start Error:", error);
      // 如果报错可能与额度有关，直接展示截图中的那个弹窗
      setShowKeyModal(true);
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
          onGoToReview={(tab) => { if (tab) setReviewInitialTab(tab); setView(AppState.REVIEW); }}
          onGoToStats={() => setView(AppState.STATS)}
          onUpdateStats={handleUpdateStats}
          onOpenKeyModal={() => setShowKeyModal(true)}
          isUsingPersonalKey={isUsingPersonalKey}
        />
      )}
      {view === AppState.LOADING && <LoadingView message={loadingMsg} onCancel={() => setView(AppState.HOME)} />}
      {view === AppState.QUIZ && (
        <QuizView 
          questions={questions} 
          onFinish={finishQuiz} 
          onCancel={() => setView(AppState.HOME)} 
          onQuotaError={() => { setShowKeyModal(true); }}
          onAnswerSubmitted={(q, ans) => {
            if (ans !== q.answerIndex) {
              setUserStats(prev => {
                const point = q.grammarPoint;
                const newCounts = { ...prev.wrongCounts, [point]: (prev.wrongCounts[point] || 0) + 1 };
                const exists = prev.wrongHistory.some(h => h.question === q.question);
                if (exists) return prev;
                return { ...prev, wrongCounts: newCounts, wrongHistory: [{ ...q, userAnswerIndex: ans, timestamp: Date.now() }, ...prev.wrongHistory].slice(0, 200) };
              });
            }
          }}
          onToggleSave={(q, ans) => {
            setUserStats(prev => {
              const saved = prev.savedHistory.some(s => s.question === q.question);
              if (saved) return { ...prev, savedHistory: prev.savedHistory.filter(s => s.question !== q.question) };
              return { ...prev, savedHistory: [{ ...q, userAnswerIndex: ans, timestamp: Date.now() }, ...prev.savedHistory].slice(0, 100) };
            });
          }}
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
          onDeleteWrong={(ts) => setUserStats(prev => ({ ...prev, wrongHistory: prev.wrongHistory.filter(h => h.timestamp !== ts) }))}
          onDeleteSaved={(ts) => setUserStats(prev => ({ ...prev, savedHistory: prev.savedHistory.filter(h => h.timestamp !== ts) }))}
          onStartQuiz={(p) => startQuiz(10, '中等', [p])}
          initialTab={reviewInitialTab}
        />
      )}
      {view === AppState.STATS && (
        <StatsView stats={userStats} onBack={() => setView(AppState.HOME)} />
      )}

      {/* API Key 设置弹窗 - 完全匹配截图 UI */}
      {showKeyModal && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-md flex items-center justify-center p-8 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-[50px] p-10 shadow-2xl relative text-center border border-white/20">
            {/* 沙漏图标 */}
            <div className="flex justify-center mb-6">
              <div className="text-5xl drop-shadow-sm">⌛</div>
            </div>
            
            <h3 className="text-[24px] font-black text-[#1e293b] mb-4 tracking-tight">公共流量受限</h3>
            
            <p className="text-[13px] text-slate-400 font-medium leading-relaxed mb-10 px-2">
              请在下方粘贴您申请的 Gemini API Key。使用个人 Key 可享受无限次练习。
            </p>
            
            <div className="space-y-6">
              <div className="relative group">
                <input 
                  type="text"
                  placeholder="AIzaSyArjTT..."
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  className="w-full px-7 py-5 bg-[#f8fafc] border-2 border-slate-100 rounded-[30px] text-sm font-mono focus:border-indigo-400 focus:bg-white outline-none transition-all shadow-inner text-slate-600"
                />
              </div>
              
              <button 
                onClick={handleSaveKey}
                className="w-full py-5 bg-[#5b52f9] text-white rounded-[30px] font-bold text-lg shadow-xl shadow-indigo-100 active:scale-[0.97] transition-all"
              >
                保存并启动应用
              </button>
              
              <div className="flex justify-center items-center gap-8 mt-4">
                <button 
                  onClick={() => setShowKeyModal(false)} 
                  className="text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={handleResetKey} 
                  className="text-[#f87171] font-bold text-sm hover:text-red-600 transition-colors"
                >
                  重置 Key
                </button>
              </div>
            </div>

            <div className="mt-12 pt-6 border-t border-slate-50">
              <p className="text-[10px] text-slate-300 font-medium tracking-wide">
                * 您的 Key 将仅保存在本地浏览器缓存中。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 确认清空弹窗 */}
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
