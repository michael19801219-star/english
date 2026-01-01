
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
      alert("✅ API Key 已保存，应用已生效");
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
    alert("已切回公共模式");
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
      // 如果报错可能与额度有关，提示配置 Key
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

      {/* API Key 设置弹窗 - 根据截图设计 */}
      {showKeyModal && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-md flex items-center justify-center p-8 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-[50px] p-10 shadow-2xl relative text-center">
            <div className="text-5xl mb-6">⌛</div>
            <h3 className="text-2xl font-black text-gray-900 mb-4 tracking-tight">公共流量受限</h3>
            <p className="text-[13px] text-gray-400 font-medium leading-relaxed mb-10 px-4">
              请在下方粘贴您申请的 Gemini API Key。使用个人 Key 可享受无限次练习。
            </p>
            
            <div className="space-y-6">
              <input 
                type="text"
                placeholder="AIzaSyArjTT..."
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="w-full px-6 py-5 bg-gray-50 border-2 border-gray-100 rounded-[28px] text-sm font-mono focus:border-indigo-500 outline-none transition-all shadow-inner"
              />
              
              <button 
                onClick={handleSaveKey}
                className="w-full py-5 bg-[#5D57E8] text-white rounded-[28px] font-black text-lg shadow-xl active:scale-95 transition-all"
              >
                保存并启动应用
              </button>
              
              <div className="flex justify-center gap-6 mt-4">
                <button onClick={() => setShowKeyModal(false)} className="text-gray-400 font-bold text-sm">取消</button>
                <button onClick={handleResetKey} className="text-red-400 font-bold text-sm">重置 Key</button>
              </div>
            </div>

            <div className="mt-12 pt-6 border-t border-gray-50">
              <p className="text-[10px] text-gray-300 font-medium">
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
