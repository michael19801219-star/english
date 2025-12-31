
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { WrongQuestion, ChatMessage, Question } from '../types';
import { getGrammarDeepDive, askFollowUpQuestion } from '../services/geminiService';

interface ReviewViewProps {
  history: WrongQuestion[];
  savedHistory: WrongQuestion[];
  onBack: () => void;
  onClear: () => void;
  onStartQuiz: (point: string) => void;
  initialTab?: 'summary' | 'details' | 'saved';
}

interface DeepDiveData {
  lecture: string;
  mistakeAnalysis: string;
  tips: string[];
}

const ReviewView: React.FC<ReviewViewProps> = ({ history, savedHistory, onBack, onClear, onStartQuiz, initialTab = 'summary' }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'details' | 'saved'>(initialTab);
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);
  const [deepDives, setDeepDives] = useState<Record<string, DeepDiveData>>({});
  const [loadingPoints, setLoadingPoints] = useState<Record<string, boolean>>({});
  const [errorPoints, setErrorPoints] = useState<Record<string, boolean>>({});
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);

  // 答疑相关状态
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [followUpQuery, setFollowUpQuery] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isAsking]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'zh-CN';
      recognition.interimResults = true;
      recognition.onstart = () => setIsRecognizing(true);
      recognition.onend = () => setIsRecognizing(false);
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results).map((r: any) => r[0].transcript).join('');
        setFollowUpQuery(transcript);
      };
      recognitionRef.current = recognition;
    }
  }, []);

  const handleAskTutor = async (question: Question) => {
    if (!followUpQuery.trim() || isAsking) return;
    const query = followUpQuery.trim();
    setChatHistory(prev => [...prev, { role: 'user', content: query }]);
    setFollowUpQuery('');
    setIsAsking(true);

    try {
      const response = await askFollowUpQuestion(question, chatHistory, query);
      setChatHistory(prev => [...prev, { role: 'model', content: response }]);
    } catch (err: any) {
      alert("答疑暂时不可用，请稍后再试。");
    } finally {
      setIsAsking(false);
    }
  };

  const toggleChat = (id: string) => {
    if (activeChatId === id) {
      setActiveChatId(null);
      setChatHistory([]);
    } else {
      setActiveChatId(id);
      setChatHistory([]);
    }
    setFollowUpQuery('');
  };

  const knowledgeMap = useMemo(() => {
    const map: Record<string, { count: number; questions: WrongQuestion[] }> = {};
    history.forEach(q => {
      if (!map[q.grammarPoint]) {
        map[q.grammarPoint] = { count: 0, questions: [] };
      }
      map[q.grammarPoint].count++;
      map[q.grammarPoint].questions.push(q);
    });
    return map;
  }, [history]);

  const sortedPoints = useMemo(() => {
    const entries = Object.entries(knowledgeMap) as Array<[string, { count: number; questions: WrongQuestion[] }]>;
    return entries.sort((a, b) => b[1].count - a[1].count);
  }, [knowledgeMap]);

  const fetchDeepDive = async (point: string) => {
    if (isGlobalLoading || loadingPoints[point]) return;
    
    setIsGlobalLoading(true);
    setErrorPoints(prev => ({ ...prev, [point]: false }));
    setLoadingPoints(prev => ({ ...prev, [point]: true }));
    
    try {
      const data = await getGrammarDeepDive(point, knowledgeMap[point].questions);
      setDeepDives(prev => ({ ...prev, [point]: data }));
    } catch (err: any) {
      setErrorPoints(prev => ({ ...prev, [point]: true }));
    } finally {
      setLoadingPoints(prev => ({ ...prev, [point]: false }));
      setTimeout(() => setIsGlobalLoading(false), 1000);
    }
  };

  const handleTogglePoint = (point: string) => {
    if (selectedPoint === point) {
      setSelectedPoint(null);
      return;
    }
    setSelectedPoint(point);
    if (!deepDives[point] && knowledgeMap[point]) {
      fetchDeepDive(point);
    }
  };

  const getDifficultyColor = (diff?: string) => {
    switch(diff) {
      case '简单': return 'bg-blue-50 text-blue-600 border-blue-100';
      case '中等': return 'bg-violet-50 text-violet-600 border-violet-100';
      case '较难': return 'bg-orange-50 text-orange-600 border-orange-100';
      default: return 'bg-gray-50 text-gray-500 border-gray-100';
    }
  };

  const displayedHistory = activeTab === 'details' ? history : savedHistory;

  return (
    <div className="flex-1 flex flex-col bg-[#FDFCF8] min-h-screen relative overflow-hidden">
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100">
        <header className="px-6 pt-6 pb-2 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 active:scale-90 transition-all">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">语法笔记</h1>
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Mastery Notes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(history.length > 0 || savedHistory.length > 0) && (
              <button onClick={onClear} className="px-4 py-2 text-[11px] font-black text-red-400 bg-red-50 rounded-xl active:opacity-60">清空</button>
            )}
          </div>
        </header>

        <div className="px-6 py-4 flex gap-2 overflow-x-auto no-scrollbar">
          <button onClick={() => setActiveTab('summary')} className={`px-4 py-2.5 rounded-xl text-[11px] font-black transition-all whitespace-nowrap border-2 ${activeTab === 'summary' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-gray-100 text-gray-400'}`}>📝 考点提炼</button>
          <button onClick={() => setActiveTab('details')} className={`px-4 py-2.5 rounded-xl text-[11px] font-black transition-all whitespace-nowrap border-2 ${activeTab === 'details' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-gray-100 text-gray-400'}`}>📜 错题集</button>
          <button onClick={() => setActiveTab('saved')} className={`px-4 py-2.5 rounded-xl text-[11px] font-black transition-all whitespace-nowrap border-2 ${activeTab === 'saved' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-gray-100 text-gray-400'}`}>⭐ 我的收藏</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {(activeTab === 'summary' && history.length === 0) || (activeTab === 'details' && history.length === 0) || (activeTab === 'saved' && savedHistory.length === 0) ? (
          <main className="flex flex-col items-center justify-center p-12 text-center mt-20">
            <div className="w-32 h-32 bg-indigo-50 rounded-full flex items-center justify-center text-5xl mb-6 grayscale opacity-50">✍️</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {activeTab === 'saved' ? '收藏夹暂无内容' : '笔记簿空空如也'}
            </h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              {activeTab === 'saved' ? '在做题时点击星星图标，可以收藏想要复习的题目。' : '开始练习，AI 将会自动为你整理错题中的核心考点。'}
            </p>
          </main>
        ) : (
          <main className="p-6 space-y-8 animate-fadeIn pb-24">
            {activeTab === 'summary' ? (
              <div className="space-y-6">
                {sortedPoints.length > 0 && (
                  <section className="bg-gradient-to-br from-indigo-700 to-violet-700 rounded-[32px] p-8 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                    <div className="relative z-10">
                      <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-4">Focus Analysis</p>
                      <h2 className="text-2xl font-black mb-6 leading-tight">你需要重点关注<br/><span className="text-yellow-300">#{sortedPoints[0][0]}</span></h2>
                      <div className="flex items-center gap-4 p-4 bg-white/10 rounded-2xl border border-white/10">
                        <div className="text-2xl">🎯</div>
                        <p className="text-xs text-white/90 font-medium leading-relaxed italic">该考点错误率最高，AI 建议你逐个复盘。</p>
                      </div>
                    </div>
                  </section>
                )}

                <div className="space-y-4">
                  <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span> 考点逻辑清单
                  </h4>
                  {sortedPoints.map(([point, data]) => (
                    <div key={point} className={`bg-white rounded-[28px] border transition-all duration-300 ${selectedPoint === point ? 'ring-2 ring-indigo-500 border-transparent shadow-lg' : 'border-gray-100'}`}>
                      <button onClick={() => handleTogglePoint(point)} className="w-full p-6 flex items-center justify-between text-left">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm ${data.count >= 5 ? 'bg-red-50 text-red-500' : 'bg-indigo-50 text-indigo-500'}`}>
                            {data.count >= 5 ? '🔥' : '💡'}
                          </div>
                          <div>
                            <h5 className="font-bold text-gray-900">{point}</h5>
                            <p className="text-xs text-gray-400 font-medium">涉及 {data.count} 道错题</p>
                          </div>
                        </div>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform ${selectedPoint === point ? 'rotate-180 bg-indigo-50 text-indigo-600' : 'bg-gray-50 text-gray-300'}`}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                        </div>
                      </button>
                      
                      {selectedPoint === point && (
                        <div className="px-6 pb-6 animate-fadeIn">
                          <div className="pt-4 border-t border-gray-50 space-y-5">
                            {loadingPoints[point] ? (
                              <div className="py-8 flex flex-col items-center justify-center space-y-3">
                                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                                <p className="text-[11px] text-gray-400 font-bold">AI 正在生成专项解析...</p>
                              </div>
                            ) : errorPoints[point] ? (
                              <div className="py-8 flex flex-col items-center justify-center space-y-4">
                                 <div className="text-3xl">⏳</div>
                                 <p className="text-[13px] text-gray-500 font-bold">由于配额限制，解析生成失败</p>
                                 <button onClick={() => fetchDeepDive(point)} className="px-6 py-2.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black">重试</button>
                              </div>
                            ) : deepDives[point] ? (
                              <div className="space-y-4">
                                <div className="bg-indigo-50/50 p-5 rounded-[22px] border border-indigo-100/50">
                                  <h6 className="text-[12px] font-black text-indigo-700 uppercase tracking-tight mb-2 flex items-center gap-2"><span>📘</span> 考点精讲</h6>
                                  <p className="text-[13px] text-indigo-900 font-medium leading-relaxed">{deepDives[point].lecture}</p>
                                </div>
                                <div className="bg-red-50/50 p-5 rounded-[22px] border border-red-100/50">
                                  <h6 className="text-[12px] font-black text-red-700 uppercase tracking-tight mb-2 flex items-center gap-2"><span>🔍</span> 错因分析</h6>
                                  <p className="text-[13px] text-red-900 font-medium leading-relaxed italic">{deepDives[point].mistakeAnalysis}</p>
                                </div>
                                <button onClick={() => onStartQuiz(point)} className="w-full py-4.5 bg-indigo-600 text-white rounded-[24px] font-black text-[15px] shadow-lg active:scale-95 transition-all">开启专项突破</button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 px-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${activeTab === 'saved' ? 'bg-amber-400' : 'bg-violet-500'}`}></span> 
                  {activeTab === 'saved' ? '我的收藏题目' : '历史错题记录'}
                </h4>
                {displayedHistory.map((q, idx) => {
                  const uniqueId = `${q.question}-${idx}`;
                  const isChatting = activeChatId === uniqueId;
                  
                  return (
                    <div key={idx} className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm relative">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-lg border border-indigo-100 leading-tight inline-block max-w-[65%] truncate">#{q.grammarPoint}</span>
                        <span className={`px-2 py-1 text-[10px] font-black rounded-lg border ${getDifficultyColor(q.difficulty)}`}>{q.difficulty || '中等'}</span>
                        <div className="ml-auto flex items-center gap-1.5">
                          {activeTab === 'saved' && (
                            <span className="text-amber-400 text-sm drop-shadow-sm">⭐</span>
                          )}
                          <span className="text-[10px] text-gray-300 font-medium">{new Date(q.timestamp).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <p className="text-[15px] text-gray-800 font-bold mb-4 leading-relaxed">{q.question}</p>
                      <div className="grid grid-cols-1 gap-2 mb-5">
                        {q.options.map((opt, i) => (
                          <div key={i} className={`p-3 rounded-xl text-[13px] border flex gap-2 ${i === q.answerIndex ? 'bg-green-50 border-green-200 text-green-700 font-bold' : i === q.userAnswerIndex ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-50 text-gray-400'}`}>
                            <span className="font-black opacity-40">{String.fromCharCode(65 + i)}.</span>
                            <span>{opt}</span>
                          </div>
                        ))}
                      </div>
                      
                      <div className="p-5 bg-gray-50/80 rounded-[20px] border border-gray-100 relative overflow-hidden mb-4">
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-200"></div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center text-[10px] shadow-sm border border-gray-100">💡</div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">详解与翻译</span>
                          </div>
                          <button 
                            onClick={() => toggleChat(uniqueId)}
                            className={`px-3 py-1 rounded-full text-[10px] font-black transition-all ${isChatting ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border border-indigo-100'}`}
                          >
                            {isChatting ? '关闭提问' : '💬 问问AI助教'}
                          </button>
                        </div>
                        <p className="text-[13px] text-gray-600 leading-relaxed font-medium">
                          {q.explanation}
                        </p>
                      </div>

                      {isChatting && (
                        <div className="mt-4 p-5 bg-indigo-50/50 rounded-[24px] border border-indigo-100/50 animate-fadeIn">
                          <div className="space-y-3 mb-4 max-h-[200px] overflow-y-auto no-scrollbar">
                            {chatHistory.length === 0 && (
                              <p className="text-[11px] text-indigo-400 font-bold italic text-center py-2">这道题哪里不明白？请告诉我吧</p>
                            )}
                            {chatHistory.map((msg, cIdx) => (
                              <div key={cIdx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] p-3 rounded-2xl text-[12px] font-medium leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-gray-700 rounded-bl-none border border-indigo-50 shadow-sm'}`}>
                                  {msg.content}
                                </div>
                              </div>
                            ))}
                            {isAsking && (
                              <div className="flex justify-start">
                                <div className="bg-white p-2 rounded-xl flex gap-1 animate-pulse border border-indigo-50">
                                  <div className="w-1 h-1 bg-indigo-200 rounded-full"></div>
                                  <div className="w-1 h-1 bg-indigo-300 rounded-full"></div>
                                </div>
                              </div>
                            )}
                            <div ref={chatEndRef} />
                          </div>
                          
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <input
                                type="text"
                                value={followUpQuery}
                                onChange={(e) => setFollowUpQuery(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleAskTutor(q)}
                                placeholder={isRecognizing ? "聆听中..." : "输入语法疑问..."}
                                className={`w-full py-2.5 pl-4 pr-10 bg-white rounded-xl border-none text-[12px] font-bold shadow-sm focus:ring-2 focus:ring-indigo-500/20 ${isRecognizing ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''}`}
                              />
                              <button 
                                onClick={() => isRecognizing ? recognitionRef.current?.stop() : recognitionRef.current?.start()}
                                className={`absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg transition-all ${isRecognizing ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:text-indigo-400'}`}
                              >
                                🎙️
                              </button>
                            </div>
                            <button 
                              onClick={() => handleAskTutor(q)}
                              disabled={!followUpQuery.trim() || isAsking}
                              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${!followUpQuery.trim() || isAsking ? 'bg-gray-100 text-gray-300' : 'bg-indigo-600 text-white'}`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        )}
      </div>

      <footer className="h-10 flex items-center justify-center opacity-10 pointer-events-none sticky bottom-0 bg-transparent">
        <div className="flex gap-1.5">
          {[1,2,3].map(i => <div key={i} className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></div>)}
        </div>
      </footer>
    </div>
  );
};

export default ReviewView;
