
import React, { useState, useEffect } from 'react';
import { AppState, Question, QuizResults, UserStats, Difficulty, WrongQuestion } from './types';
import { generateGrammarQuestions } from './services/geminiService';
import HomeView from './components/HomeView';
import QuizView from './components/QuizView';
import ResultView from './components/ResultView';
import LoadingView from './components/LoadingView';
import ReviewView from './components/ReviewView';

const RECOMMENDED_KEYS = [
  'AIzaSyArjTTl1aJm-OUK2i9J-5CDv0riCHF00Cs',
  'AIzaSyBnDmOI3K3uuJ7qxpfhYgqWjuXysnDq-40',
  'AIzaSyDm-P8H_Ijbko5Umzj0z7_h97S2qJ4-0Rc',
  'AIzaSyA0a4jkHp-ElbFzKgsiN0_m6tVCpFu34mM'
];

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

  const handleSaveKey = (key: string) => {
    const trimmed = key.trim();
    if (trimmed) {
      localStorage.setItem('user_custom_gemini_key', trimmed);
      setIsUsingPersonalKey(true);
      setInputKey(trimmed);
      setShowQuotaModal(false);
    }
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
            
            <div className="mb-6">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 text-left">推荐备用 Key (点击直接填入)</p>
              <div className="flex flex-col gap-2">
                {RECOMMENDED_KEYS.map((k, i) => (
                  <button 
                    key={i}
                    onClick={() => handleSaveKey(k)}
                    className="py-2.5 px-3 bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-mono truncate border border-indigo-100 active:bg-indigo-100 transition-colors text-left shadow-sm"
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
              <div className="relative flex justify-center text-[9px] uppercase font-bold"><span className="bg-white px-2 text-gray-300">或者手动粘贴</span></div>
            </div>

            <input 
              type="text"
              placeholder="粘贴 AIzaSy... 密钥"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-sm font-mono outline-none mb-4 focus:border-indigo-400 focus:bg-white transition-all"
            />
            
            <button 
              onClick={() => handleSaveKey(inputKey)}
              className="w-full py-4.5 bg-indigo-600 text-white rounded-2xl font-black mb-6 shadow-xl shadow-indigo-100 active:scale-95 transition-transform"
            >
              确定保存
            </button>
            
            <button 
              onClick={() => setShowQuotaModal(false)} 
              className="text-gray-400 font-bold text-xs active:opacity-50"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
