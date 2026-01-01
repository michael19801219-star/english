
import React, { useState, useEffect } from 'react';
import { AppState, Question, QuizResults, UserStats, Difficulty, WrongQuestion, GRAMMAR_POINTS } from './types';
import { generateGrammarQuestions } from './services/geminiService';
import HomeView from './components/HomeView';
import QuizView from './components/QuizView';
import ResultView from './components/ResultView';
import LoadingView from './components/LoadingView';
import ReviewView from './components/ReviewView';
import StatsView from './components/StatsView';

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
      setIsUsingPersonalKey(!!localKey);
      if (localKey) setInputKey(localKey);
    };
    checkKeyStatus();
  }, []);

  useEffect(() => {
    localStorage.setItem('gaokao_stats_v3', JSON.stringify(userStats));
  }, [userStats]);

  // 数据清洗：确保考点名称属于标准集合
  const normalizePoint = (rawPoint: string): string => {
    if (GRAMMAR_POINTS.includes(rawPoint)) return rawPoint;
    
    // 简单模糊匹配逻辑
    for (const standard of GRAMMAR_POINTS) {
      if (rawPoint.includes(standard) || standard.includes(rawPoint)) {
        return standard;
      }
    }
    
    // 关键字映射
    if (rawPoint.includes('时态') || rawPoint.includes('语态')) return '时态语态';
    if (rawPoint.includes('虚拟') || rawPoint.includes('语气')) return '情态动词与虚拟语气';
    if (rawPoint.includes('定语')) return '定语从句';
    if (rawPoint.includes('名词') || rawPoint.includes('宾语') || rawPoint.includes('主语') || rawPoint.includes('表语')) return '名词性从句';
    if (rawPoint.includes('非谓语')) return '非谓语动词';
    if (rawPoint.includes('介词') || rawPoint.includes('冠词')) return '介词冠词';
    if (rawPoint.includes('代词') || rawPoint.includes('形容词') || rawPoint.includes('副词')) return '代词与形容词副词';
    
    return GRAMMAR_POINTS[0]; // 兜底返回第一个
  };

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
    const isCorrect = ans === q.answerIndex;
    const today = new Date().toISOString().split('T')[0];
    const pt = normalizePoint(q.grammarPoint); // 关键：标准化考点名称

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
        let newHistory = prev.wrongHistory;
        
        if (!alreadyInHistory) {
          const newWrong: WrongQuestion = {
            ...q,
            userAnswerIndex: ans,
            timestamp: Date.now()
          };
          newHistory = [newWrong, ...prev.wrongHistory].slice(0, 100);
        }
        
        newState = {
          ...newState,
          wrongCounts: newCounts,
          wrongHistory: newHistory
        };
      }
      return newState;
    });
  };

  const removeWrongQuestion = (timestamp: number) => {
    setUserStats(prev => {
      const target = prev.wrongHistory.find(h => h.timestamp === timestamp);
      const filteredHistory = prev.wrongHistory.filter(h => h.timestamp !== timestamp);
      if (filteredHistory.length === prev.wrongHistory.length) return prev;
      const newCounts = { ...prev.wrongCounts };
      if (target) {
        const pt = normalizePoint(target.grammarPoint);
        if (newCounts[pt] > 0) {
          newCounts[pt] -= 1;
          if (newCounts[pt] === 0) delete newCounts[pt];
        }
      }
      return { ...prev, wrongCounts: newCounts, wrongHistory: filteredHistory };
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
      if (ans === questions[idx].answerIndex) score++;
      else wrongPoints.push(normalizePoint(questions[idx].grammarPoint));
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

  const exportBackup = () => {
    const dataStr = JSON.stringify(userStats, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `grammar_master_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.wrongCounts && parsed.wrongHistory && parsed.savedHistory) {
          if (window.confirm('导入备份将覆盖当前所有练习记录，确定吗？')) {
            setUserStats(parsed);
            alert('数据导入成功！');
            setShowSyncModal(false);
          }
        } else alert('无效的备份文件');
      } catch (err) { alert('解析失败'); }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto relative overflow-hidden shadow-2xl">
      {view === AppState.HOME && (
        <HomeView 
          onStart={startQuiz} 
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

      {view === AppState.STATS && (
        <StatsView stats={userStats} onBack={() => setView(AppState.HOME)} />
      )}

      {/* API Key Modal */}
      {showQuotaModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-xs rounded-[40px] p-8 shadow-2xl text-center">
            <h3 className="text-xl font-black mb-4">更新 API Key</h3>
            <div className="mb-6">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 text-left">推荐备用 Key</p>
              <div className="flex flex-col gap-2">
                {RECOMMENDED_KEYS.map((k, i) => (
                  <button key={i} onClick={() => handleSaveKey(k)} className="py-2.5 px-3 bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-mono truncate border border-indigo-100 active:bg-indigo-100 transition-colors text-left shadow-sm">{k}</button>
                ))}
              </div>
            </div>
            <input type="text" placeholder="粘贴 AIzaSy... 密钥" value={inputKey} onChange={(e) => setInputKey(e.target.value)} className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-sm font-mono outline-none mb-4 focus:border-indigo-400 focus:bg-white transition-all"/>
            <button onClick={() => handleSaveKey(inputKey)} className="w-full py-4.5 bg-indigo-600 text-white rounded-2xl font-black mb-6 shadow-xl shadow-indigo-100 active:scale-95 transition-transform">确定保存</button>
            <button onClick={() => setShowQuotaModal(false)} className="text-gray-400 font-bold text-xs active:opacity-50">取消</button>
          </div>
        </div>
      )}

      {showSyncModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-xs rounded-[40px] p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-4">🔄</div>
            <h3 className="text-xl font-black mb-2 text-gray-900">数据备份与同步</h3>
            <p className="text-xs text-gray-400 mb-8 font-medium leading-relaxed">通过下载/上传备份文件，在不同设备间同步你的练习记录与收藏。</p>
            <div className="flex flex-col gap-3">
              <button onClick={exportBackup} className="w-full py-4.5 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-2"><span>📤</span> 导出备份文件</button>
              <label className="w-full py-4.5 bg-white border-2 border-gray-100 text-indigo-600 rounded-2xl font-black active:bg-gray-50 transition-all flex items-center justify-center gap-2 cursor-pointer">
                <input type="file" accept=".json" className="hidden" onChange={importBackup}/>
                <span>📥</span> 导入备份文件
              </label>
            </div>
            <button onClick={() => setShowSyncModal(false)} className="mt-8 text-gray-400 font-bold text-xs active:opacity-50">关闭</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
