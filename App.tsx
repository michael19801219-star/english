
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
      alert("出题失败，请检查网络或环境变量配置。");
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
        />
      )}
      {view === AppState.LOADING && <LoadingView message={loadingMsg} onCancel={() => setView(AppState.HOME)} />}
      {view === AppState.QUIZ && (
        <QuizView 
          questions={questions} 
          onFinish={finishQuiz} 
          onCancel={() => setView(AppState.HOME)} 
          onQuotaError={() => { alert("额度受限，请稍后再试。"); }}
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
