
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
  const [reviewInitialTab, setReviewInitialTab] = useState<'summary' | 'details'>('summary');

  useEffect(() => {
    const saved = localStorage.getItem('gaokao_stats_v2');
    if (saved) setUserStats(JSON.parse(saved));
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

  const startQuiz = async (count: number, difficulty: Difficulty, points: string[]) => {
    setView(AppState.LOADING);
    setLoadingMsg(`AI 正在为你生成 ${difficulty} 难度的试卷...`);
    try {
      const newQuestions = await generateGrammarQuestions(count, points, difficulty);
      setQuestions(newQuestions);
      setView(AppState.QUIZ);
    } catch (error: any) {
      if (error.message === "QUOTA_EXCEEDED") {
        setShowQuotaModal(true);
      } else {
        alert(`生成失败: ${error.message}`);
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

  const handleConsolidate = () => {
    if (results && results.wrongGrammarPoints.length > 0) {
      // 默认针对错题语法点生成 10 道中等难度的题目进行强化
      startQuiz(10, '中等', results.wrongGrammarPoints);
    }
  };

  const clearHistory = () => {
    if (confirm('确定要清空错题本吗？')) {
      const reset = { wrongCounts: {}, wrongHistory: [] };
      setUserStats(reset);
      localStorage.setItem('gaokao_stats_v2', JSON.stringify(reset));
    }
  };

  const handleCancelQuiz = () => {
    setView(AppState.HOME);
    setQuestions([]);
  };

  const handleGoToReview = (tab: 'summary' | 'details' = 'summary') => {
    setReviewInitialTab(tab);
    setView(AppState.REVIEW);
  };

  const handleStartSpecialized = (point: string) => {
    startQuiz(10, '中等', [point]);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto relative overflow-hidden shadow-2xl">
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
          onQuotaError={() => setShowQuotaModal(true)} 
        />
      )}
      {view === AppState.RESULT && results && (
        <ResultView results={results} onRestart={() => setView(AppState.HOME)} onConsolidate={handleConsolidate} />
      )}
      {view === AppState.REVIEW && (
        <ReviewView 
          history={userStats.wrongHistory} 
          onBack={() => setView(AppState.HOME)} 
          onClear={clearHistory} 
          onStartQuiz={handleStartSpecialized}
          initialTab={reviewInitialTab}
        />
      )}

      {/* 配额超限提示弹窗 */}
      {showQuotaModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-xs rounded-[32px] p-8 shadow-2xl text-center">
            <div className="text-4xl mb-4">⏳</div>
            <h3 className="text-xl font-black text-gray-900 mb-2">服务暂时繁忙</h3>
            <p className="text-gray-500 text-xs leading-relaxed mb-6">
              由于当前访问量较大，请求频率已达上限。请稍等 1 分钟后再尝试。
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => setShowQuotaModal(false)}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
