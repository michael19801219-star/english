
import React, { useState, useEffect, useRef } from 'react';
import { AppState, Question, QuizResults, UserStats, Difficulty, WrongQuestion, GRAMMAR_POINTS } from './types';
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
  const [userStats, setUserStats] = useState<UserStats>({ 
    wrongCounts: {}, 
    wrongHistory: [], 
    savedHistory: [],
    totalAnswered: 0,
    totalCorrect: 0,
    dailyProgress: {},
    pointAttempts: {}
  });
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [reviewInitialTab, setReviewInitialTab] = useState<'summary' | 'details' | 'saved'>('summary');
  const [isUsingPersonalKey, setIsUsingPersonalKey] = useState(false);
  const [inputKey, setInputKey] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('gaokao_stats_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUserStats({
          wrongCounts: parsed.wrongCounts || {},
          wrongHistory: parsed.wrongHistory || [],
          savedHistory: parsed.savedHistory || [],
          totalAnswered: parsed.totalAnswered || 0,
          totalCorrect: parsed.totalCorrect || 0,
          dailyProgress: parsed.dailyProgress || {},
          pointAttempts: parsed.pointAttempts || {}
        });
      } catch (e) { console.error(e); }
    }
    
    const checkKeyStatus = () => {
      const localKey = localStorage.getItem('user_custom_gemini_key');
      if (localKey && localKey.startsWith('AIza')) {
        setIsUsingPersonalKey(true);
        setInputKey(localKey);
      } else {
        setIsUsingPersonalKey(false);
      }
    };
    checkKeyStatus();
  }, []);

  useEffect(() => {
    localStorage.setItem('gaokao_stats_v3', JSON.stringify(userStats));
  }, [userStats]);

  const normalizePoint = (rawPoint: string): string => {
    if (GRAMMAR_POINTS.includes(rawPoint)) return rawPoint;
    for (const standard of GRAMMAR_POINTS) {
      if (rawPoint.includes(standard) || standard.includes(rawPoint)) return standard;
    }
    return GRAMMAR_POINTS[0];
  };

  const startQuiz = async (count: number, difficulty: Difficulty, points: string[]) => {
    const currentKey = localStorage.getItem('user_custom_gemini_key');
    if (!currentKey && !process.env.API_KEY) {
      setShowQuotaModal(true);
      return;
    }

    setView(AppState.LOADING);
    setLoadingMsg(`正在调取最新高考考点...`);
    try {
      const newQuestions = await generateGrammarQuestions(count, points, difficulty);
      setQuestions(newQuestions);
      setView(AppState.QUIZ);
    } catch (error: any) {
      console.error(error);
      setView(AppState.HOME);
      setShowQuotaModal(true);
    }
  };

  const startHistoryQuiz = (sourceType: 'wrong' | 'saved', count: number, difficulty: Difficulty, points: string[]) => {
    const source = sourceType === 'wrong' ? userStats.wrongHistory : userStats.savedHistory;
    let filtered = source.filter(q => {
      const matchesPoint = points.length === 0 || points.includes(q.grammarPoint);
      const matchesDiff = difficulty === '随机' || q.difficulty === difficulty;
      return matchesPoint && matchesDiff;
    });

    if (filtered.length === 0) {
      alert(`当前库中没有符合条件的题目。`);
      return;
    }

    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
    setQuestions(shuffled.slice(0, count));
    setView(AppState.QUIZ);
  };

  const handleAnswerSubmitted = (q: Question, ans: number) => {
    const isCorrect = ans === q.answerIndex;
    const today = new Date().toISOString().split('T')[0];
    const pt = normalizePoint(q.grammarPoint);

    setUserStats(prev => {
      const newDailyProgress = { ...prev.dailyProgress };
      newDailyProgress[today] = (newDailyProgress[today] || 0) + 1;
      const newPointAttempts = { ...prev.pointAttempts };
      newPointAttempts[pt] = (newPointAttempts[pt] || 0) + 1;

      let newState = {
        ...prev,
        totalAnswered: prev.totalAnswered + 1,
        totalCorrect: prev.totalCorrect + (isCorrect ? 1 : 0),
        dailyProgress: newDailyProgress,
        pointAttempts: newPointAttempts
      };

      if (!isCorrect) {
        const newCounts = { ...prev.wrongCounts };
        newCounts[pt] = (newCounts[pt] || 0) + 1;
        const alreadyInHistory = prev.wrongHistory.some(h => h.question === q.question);
        if (!alreadyInHistory) {
          const newWrong: WrongQuestion = { ...q, userAnswerIndex: ans, timestamp: Date.now() };
          newState.wrongHistory = [newWrong, ...prev.wrongHistory].slice(0, 200);
        }
        newState.wrongCounts = newCounts;
      }
      return newState;
    });
  };

  const removeWrongQuestion = (timestamp: number) => {
    setUserStats(prev => ({ ...prev, wrongHistory: prev.wrongHistory.filter(h => h.timestamp !== timestamp) }));
  };

  const removeSavedQuestion = (timestamp: number) => {
    setUserStats(prev => ({ ...prev, savedHistory: prev.savedHistory.filter(h => h.timestamp !== timestamp) }));
  };

  const clearWrongHistory = () => setUserStats(prev => ({ ...prev, wrongHistory: [], wrongCounts: {} }));
  const clearSavedHistory = () => setUserStats(prev => ({ ...prev, savedHistory: [] }));

  const finishQuiz = (userAnswers: number[]) => {
    let score = 0;
    const wrongPoints: string[] = [];
    userAnswers.forEach((ans, idx) => {
      if (ans === questions[idx].answerIndex) score++;
      else wrongPoints.push(normalizePoint(questions[idx].grammarPoint));
    });
    setResults({ score, total: questions.length, answers: userAnswers, questions, wrongGrammarPoints: Array.from(new Set(wrongPoints)) });
    setView(AppState.RESULT);
  };

  const handleSaveKey = (key: string) => {
    const trimmed = key.trim();
    if (trimmed && trimmed.startsWith('AIza')) {
      localStorage.setItem('user_custom_gemini_key', trimmed);
      setIsUsingPersonalKey(true);
      setInputKey(trimmed);
      setShowQuotaModal(false);
      alert('API Key 保存成功！');
    } else {
      alert('请输入有效的 Gemini API Key (以 AIza 开头)');
    }
  };

  const clearKey = () => {
    localStorage.removeItem('user_custom_gemini_key');
    setIsUsingPersonalKey(false);
    setInputKey('');
    alert('已清除自定义密钥');
  };

  // 导出备份文件逻辑
  const handleExportFile = () => {
    try {
      const dataStr = JSON.stringify(userStats, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `gaokao_grammar_backup_${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (e) {
      alert('导出失败，请重试');
    }
  };

  // 导入备份文件逻辑
  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        
        // 验证关键字段
        if (parsed.wrongCounts && Array.isArray(parsed.wrongHistory)) {
          setUserStats(parsed);
          alert('数据同步成功！');
          setShowSyncModal(false);
        } else {
          throw new Error('格式不正确');
        }
      } catch (err) {
        alert('文件格式错误或已损坏，请选择正确的备份文件。');
      }
    };
    reader.readAsText(file);
    // 重置 input 以便下次选择同一文件
    event.target.value = '';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto relative overflow-hidden shadow-2xl">
      {view === AppState.HOME && (
        <HomeView 
          onStart={startQuiz} 
          onStartHistory={startHistoryQuiz}
          stats={userStats} 
          onGoToReview={(tab) => { setReviewInitialTab(tab as any || 'summary'); setView(AppState.REVIEW); }} 
          onGoToStats={() => setView(AppState.STATS)}
          isUsingPersonalKey={isUsingPersonalKey}
          onOpenQuotaModal={() => setShowQuotaModal(true)}
          onOpenSyncModal={() => setShowSyncModal(true)}
        />
      )}
      {view === AppState.LOADING && <LoadingView message={loadingMsg} onCancel={() => setView(AppState.HOME)} />}
      {view === AppState.QUIZ && (
        <QuizView 
          questions={questions} 
          onFinish={finishQuiz} 
          onCancel={() => setView(AppState.HOME)} 
          onQuotaError={() => setShowQuotaModal(true)}
          onToggleSave={(q, idx) => {
            const isSaved = userStats.savedHistory.some(s => s.question === q.question);
            if (isSaved) {
              const target = userStats.savedHistory.find(s => s.question === q.question);
              if (target) removeSavedQuestion(target.timestamp);
            } else {
              const newSaved: WrongQuestion = { ...q, userAnswerIndex: idx ?? q.answerIndex, timestamp: Date.now() };
              setUserStats(prev => ({ ...prev, savedHistory: [newSaved, ...prev.savedHistory].slice(0, 200) }));
            }
          }}
          onAnswerSubmitted={handleAnswerSubmitted}
          savedHistory={userStats.savedHistory}
        />
      )}
      {view === AppState.RESULT && results && (
        <ResultView results={results} onRestart={() => setView(AppState.HOME)} onConsolidate={() => results.wrongGrammarPoints.length > 0 && startQuiz(10, '中等', results.wrongGrammarPoints)} />
      )}
      {view === AppState.REVIEW && (
        <ReviewView history={userStats.wrongHistory} savedHistory={userStats.savedHistory} onBack={() => setView(AppState.HOME)} onClearWrong={clearWrongHistory} onClearSaved={clearSavedHistory} onStartQuiz={(p) => startQuiz(10, '中等', [p])} onRemoveWrong={removeWrongQuestion} onRemoveSaved={removeSavedQuestion} initialTab={reviewInitialTab} />
      )}
      {view === AppState.STATS && <StatsView stats={userStats} onBack={() => setView(AppState.HOME)} />}
      
      {/* 隐藏的文件选择器 */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImportFile} 
        accept=".json" 
        style={{ display: 'none' }} 
      />

      {showQuotaModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-xs rounded-[40px] p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-4">🔑</div>
            <h3 className="text-xl font-black mb-2 text-gray-900">自主密钥设置</h3>
            <p className="text-xs text-gray-400 mb-6 font-medium leading-relaxed">
              为了确保 AI 服务的稳定，建议使用您自己的 API Key。密钥仅存储在您的设备中。
            </p>
            
            <div className="mb-6 text-left">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-1">Gemini API Key</label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="AIzaSy..." 
                  value={inputKey} 
                  onChange={(e) => setInputKey(e.target.value)} 
                  className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-xs font-mono outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-inner"
                />
              </div>
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noreferrer"
                className="inline-block mt-3 text-[10px] text-indigo-500 font-bold underline underline-offset-4"
              >
                还没有密钥？去 Google 免费申请
              </a>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => handleSaveKey(inputKey)} 
                className="w-full py-4.5 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 active:scale-95 transition-all"
              >
                保存设置
              </button>
              {isUsingPersonalKey && (
                <button 
                  onClick={clearKey} 
                  className="w-full py-3 text-red-500 text-[11px] font-black active:opacity-50"
                >
                  清除当前密钥
                </button>
              )}
            </div>
            <button 
              onClick={() => setShowQuotaModal(false)} 
              className="mt-6 text-gray-400 font-bold text-xs active:opacity-50"
            >
              稍后再说
            </button>
          </div>
        </div>
      )}

      {/* 备份同步弹窗 - 根据参考图修复 */}
      {showSyncModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-xs rounded-[40px] p-10 shadow-[0_32px_80px_rgba(0,0,0,0.15)] text-center relative overflow-hidden">
            {/* 装饰性背景 */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-indigo-50 rounded-full blur-3xl opacity-50 -mt-24"></div>
            
            <div className="relative z-10">
              <div className="w-20 h-20 bg-indigo-50 text-indigo-500 rounded-[28px] flex items-center justify-center text-4xl mx-auto mb-8 shadow-sm">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              
              <h3 className="text-[22px] font-black mb-3 text-gray-900 tracking-tight">数据备份与同步</h3>
              <p className="text-[13px] text-gray-400 mb-10 font-medium leading-relaxed px-2">
                通过下载/上传备份文件，在不同设备间同步你的练习记录与收藏。
              </p>

              <div className="flex flex-col gap-4">
                <button 
                  onClick={handleExportFile}
                  className="w-full py-4.5 bg-indigo-600 text-white rounded-[24px] font-black text-sm shadow-[0_20px_40px_rgba(79,70,229,0.3)] active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  <span className="text-lg">📤</span> 导出备份文件
                </button>
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4.5 bg-white text-indigo-600 border-2 border-indigo-50 rounded-[24px] font-black text-sm active:scale-95 active:bg-indigo-50 transition-all flex items-center justify-center gap-3"
                >
                  <span className="text-lg">📥</span> 导入备份文件
                </button>
              </div>

              <button 
                onClick={() => setShowSyncModal(false)} 
                className="mt-10 text-gray-400 font-bold text-xs tracking-widest active:opacity-50"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
