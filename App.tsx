
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
  const [userStats, setUserStats] = useState<UserStats>({ wrongCounts: {}, wrongHistory: [], savedHistory: [] });
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [reviewInitialTab, setReviewInitialTab] = useState<'summary' | 'details' | 'saved'>('summary');
  const [isUsingPersonalKey, setIsUsingPersonalKey] = useState(false);
  const [inputKey, setInputKey] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('gaokao_stats_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUserStats({
          wrongCounts: parsed.wrongCounts || {},
          wrongHistory: parsed.wrongHistory || [],
          savedHistory: parsed.savedHistory || []
        });
      } catch (e) { console.error(e); }
    }
    
    const checkKeyStatus = () => {
      const localKey = localStorage.getItem('user_custom_gemini_key');
      setIsUsingPersonalKey(!!localKey);
      if (localKey) setInputKey(localKey);
    };
    checkKeyStatus();
  }, []);

  useEffect(() => {
    localStorage.setItem('gaokao_stats_v3', JSON.stringify(userStats));
  }, [userStats]);

  const toggleSaveQuestion = (q: Question, userAnswerIndex?: number) => {
    setUserStats(prev => {
      const isSaved = prev.savedHistory.some(s => s.id === q.id || s.question === q.question);
      if (isSaved) {
        return { ...prev, savedHistory: prev.savedHistory.filter(s => s.question !== q.question && s.id !== q.id) };
      } else {
        const newSaved: WrongQuestion = {
          ...q,
          userAnswerIndex: userAnswerIndex ?? q.answerIndex,
          timestamp: Date.now()
        };
        return { ...prev, savedHistory: [newSaved, ...prev.savedHistory].slice(0, 100) };
      }
    });
  };

  const handleAnswerSubmitted = (q: Question, ans: number) => {
    if (ans !== q.answerIndex) {
      setUserStats(prev => {
        const alreadyExists = prev.wrongHistory.some(h => h.question === q.question);
        if (alreadyExists) return prev;

        const newCounts = { ...prev.wrongCounts };
        const pt = q.grammarPoint;
        newCounts[pt] = (newCounts[pt] || 0) + 1;
        
        const newWrong: WrongQuestion = {
          ...q,
          userAnswerIndex: ans,
          timestamp: Date.now()
        };
        
        return {
          ...prev,
          wrongCounts: newCounts,
          wrongHistory: [newWrong, ...prev.wrongHistory].slice(0, 100)
        };
      });
    }
  };

  const removeWrongQuestion = (timestamp: number) => {
    setUserStats(prev => {
      // 优先匹配 timestamp，兜底匹配 question (兼容性增强)
      const target = prev.wrongHistory.find(h => h.timestamp === timestamp);
      const filteredHistory = prev.wrongHistory.filter(h => h.timestamp !== timestamp);

      if (filteredHistory.length === prev.wrongHistory.length) return prev;

      const newCounts = { ...prev.wrongCounts };
      if (target) {
        const pt = target.grammarPoint;
        if (newCounts[pt] > 0) {
          newCounts[pt] -= 1;
          if (newCounts[pt] === 0) delete newCounts[pt];
        }
      }

      return {
        ...prev,
        wrongCounts: newCounts,
        wrongHistory: filteredHistory
      };
    });
  };

  const removeSavedQuestion = (timestamp: number) => {
    setUserStats(prev => ({
      ...prev,
      savedHistory: prev.savedHistory.filter(h => h.timestamp !== timestamp)
    }));
  };

  // 分离清空功能
  const clearWrongHistory = () => {
    setUserStats(prev => ({ ...prev, wrongCounts: {}, wrongHistory: [] }));
  };

  const clearSavedHistory = () => {
    setUserStats(prev => ({ ...prev, savedHistory: [] }));
  };

  const startQuiz = async (count: number, difficulty: Difficulty, points: string[]) => {
    setView(AppState.LOADING);
    setLoadingMsg(`正在调取最新高考考点...`);
    try {
      const newQuestions = await generateGrammarQuestions(count, points, difficulty);
      setQuestions(newQuestions);
      setView(AppState.QUIZ);
    } catch (error: any) {
      setView(AppState.HOME);
      setShowQuotaModal(true);
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto relative overflow-hidden shadow-2xl">
      {view === AppState.HOME && (
        <HomeView 
          onStart={startQuiz} 
          stats={userStats} 
          onGoToReview={(tab) => { setReviewInitialTab(tab as any || 'summary'); setView(AppState.REVIEW); }} 
          isUsingPersonalKey={isUsingPersonalKey}
          onOpenQuotaModal={() => setShowQuotaModal(true)}
        />
      )}
      
      {view === AppState.LOADING && <LoadingView message={loadingMsg} onCancel={() => setView(AppState.HOME)} />}
      
      {view === AppState.QUIZ && (
        <QuizView 
          questions={questions} 
          onFinish={finishQuiz} 
          onCancel={() => setView(AppState.HOME)} 
          onQuotaError={() => setShowQuotaModal(true)}
          onToggleSave={toggleSaveQuestion}
          onAnswerSubmitted={handleAnswerSubmitted}
          savedHistory={userStats.savedHistory}
        />
      )}
      
      {view === AppState.RESULT && results && (
        <ResultView 
          results={results} 
          onRestart={() => setView(AppState.HOME)} 
          onConsolidate={() => results.wrongGrammarPoints.length > 0 && startQuiz(10, '中等', results.wrongGrammarPoints)} 
        />
      )}
      
      {view === AppState.REVIEW && (
        <ReviewView 
          history={userStats.wrongHistory} 
          savedHistory={userStats.savedHistory}
          onBack={() => setView(AppState.HOME)} 
          onClearWrong={clearWrongHistory}
          onClearSaved={clearSavedHistory}
          onStartQuiz={(p) => startQuiz(10, '中等', [p])} 
          onRemoveWrong={removeWrongQuestion}
          onRemoveSaved={removeSavedQuestion}
          initialTab={reviewInitialTab} 
        />
      )}

      {showQuotaModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-xs rounded-[40px] p-8 shadow-2xl text-center">
            <h3 className="text-xl font-black mb-4">更新 API Key</h3>
            <input 
              type="text"
              placeholder="粘贴 AIzaSy... 密钥"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-sm font-mono outline-none mb-4"
            />
            <button 
              onClick={() => {
                localStorage.setItem('user_custom_gemini_key', inputKey.trim());
                setIsUsingPersonalKey(true);
                setShowQuotaModal(false);
              }}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black mb-4"
            >
              确定保存
            </button>
            <button onClick={() => setShowQuotaModal(false)} className="text-gray-400 font-bold text-xs">取消</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
