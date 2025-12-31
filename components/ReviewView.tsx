
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { WrongQuestion, ChatMessage } from '../types';
import { getGrammarDeepDive, askFollowUpQuestion } from '../services/geminiService';

interface ReviewViewProps {
  history: WrongQuestion[];
  savedHistory: WrongQuestion[];
  onBack: () => void;
  onClear: (type: 'details' | 'saved') => void;
  onDeleteWrong: (timestamp: number) => void;
  onDeleteSaved: (timestamp: number) => void;
  onStartQuiz: (point: string) => void;
  initialTab?: 'summary' | 'details' | 'saved';
}

interface DeepDiveData {
  lecture: string;
  mistakeAnalysis: string;
  tips: string[];
}

const ReviewView: React.FC<ReviewViewProps> = ({ history, savedHistory, onBack, onClear, onDeleteWrong, onDeleteSaved, onStartQuiz, initialTab = 'summary' }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'details' | 'saved'>(initialTab);
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);
  const [deepDives, setDeepDives] = useState<Record<string, DeepDiveData>>({});
  const [loadingPoints, setLoadingPoints] = useState<Record<string, boolean>>({});
  
  // AI 提问相关状态
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [followUpQuery, setFollowUpQuery] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [chatHistories, setChatHistories] = useState<Record<number, ChatMessage[]>>({});
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
  }, [chatHistories, isAsking, activeChatId]);

  // 初始化语音识别
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

  const currentItems = useMemo(() => {
    return activeTab === 'details' ? history : (activeTab === 'saved' ? savedHistory : []);
  }, [activeTab, history, savedHistory]);

  const knowledgeMap = useMemo<Record<string, { count: number; questions: WrongQuestion[] }>>(() => {
    const acc: Record<string, { count: number; questions: WrongQuestion[] }> = {};
    history.forEach(q => {
      const point = q.grammarPoint || '通用语法';
      if (!acc[point]) acc[point] = { count: 0, questions: [] };
      acc[point].count++;
      acc[point].questions.push(q);
    });
    return acc;
  }, [history]);

  const sortedPoints = useMemo(() => {
    const entries = Object.entries(knowledgeMap) as [string, { count: number; questions: WrongQuestion[] }][];
    return entries.sort((a, b) => b[1].count - a[1].count);
  }, [knowledgeMap]);

  const groupedDetailedData = useMemo<Record<string, WrongQuestion[]>>(() => {
    const acc: Record<string, WrongQuestion[]> = {};
    currentItems.forEach(q => {
      const point = q.grammarPoint || '通用语法';
      if (!acc[point]) acc[point] = [];
      acc[point].push(q);
    });
    return acc;
  }, [currentItems]);

  const handleTogglePoint = async (point: string) => {
    if (selectedPoint === point) {
      setSelectedPoint(null);
      return;
    }
    setSelectedPoint(point);
    
    if (!deepDives[point]) {
      setLoadingPoints(p => ({ ...p, [point]: true }));
      try {
        const pointData = knowledgeMap[point];
        if (pointData) {
          const data = await getGrammarDeepDive(point, pointData.questions);
          setDeepDives(p => ({ ...p, [point]: data }));
        }
      } catch (e) {
        console.error("Deep dive error:", e);
      } finally {
        setLoadingPoints(p => ({ ...p, [point]: false }));
      }
    }
  };

  const handleAskAI = async (question: WrongQuestion) => {
    if (!followUpQuery.trim() || isAsking) return;
    const query = followUpQuery.trim();
    const qId = question.timestamp;
    
    setChatHistories(prev => ({
      ...prev,
      [qId]: [...(prev[qId] || []), { role: 'user', content: query }]
    }));
    setFollowUpQuery('');
    setIsAsking(true);

    try {
      const currentChatHistory = chatHistories[qId] || [];
      const response = await askFollowUpQuestion(question, currentChatHistory, query);
      setChatHistories(prev => ({
        ...prev,
        [qId]: [...(prev[qId] || []), { role: 'model', content: response }]
      }));
    } catch (err) {
      alert("AI 暂时离线，请检查网络后再问。");
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#FDFCF8] min-h-screen">
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100">
        <header className="px-6 pt-6 pb-2 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 active:scale-90 transition-all">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">语法笔记本</h1>
          </div>
          {(activeTab === 'details' && history.length > 0) || (activeTab === 'saved' && savedHistory.length > 0) ? (
            <button onClick={() => onClear(activeTab === 'details' ? 'details' : 'saved')} className="px-4 py-2 text-[11px] font-black text-red-500 bg-red-50 rounded-xl active:scale-95">清空全部</button>
          ) : null}
        </header>

        <div className="px-6 py-4 flex gap-2 overflow-x-auto no-scrollbar">
          {(['summary', 'details', 'saved'] as const).map(tab => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)} 
              className={`px-4 py-2.5 rounded-xl text-[11px] font-black whitespace-nowrap transition-all border-2 ${activeTab === tab ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-gray-100 text-gray-400'}`}
            >
              {tab === 'summary' ? '📝 考点提炼' : tab === 'details' ? `错题集 (${history.length})` : `收藏本 (${savedHistory.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-32 px-6 pt-6 no-scrollbar">
        {activeTab === 'summary' ? (
          sortedPoints.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-300">
              <span className="text-6xl mb-4 opacity-50">📚</span>
              <p className="font-bold text-sm">还没有错题提炼，多刷题变强！</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedPoints.map(([point, data]) => {
                const diveData: DeepDiveData | undefined = deepDives[point];
                const isLoading = loadingPoints[point];
                return (
                  <div key={point} className="bg-white rounded-[24px] border border-gray-100 overflow-hidden shadow-sm transition-all duration-300">
                    <button onClick={() => handleTogglePoint(point)} className="w-full p-6 flex justify-between items-center text-left active:bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black shadow-sm">{data.count}</div>
                        <span className="font-bold text-gray-900 tracking-tight">{point}</span>
                      </div>
                      <svg className={`w-5 h-5 text-gray-300 transition-transform duration-300 ${selectedPoint === point ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"/></svg>
                    </button>
                    {selectedPoint === point && (
                      <div className="px-6 pb-6 border-t border-gray-50 animate-fadeIn pt-4 space-y-4">
                        {isLoading ? (
                          <div className="py-12 flex flex-col items-center gap-4">
                             <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                             <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest animate-pulse">AI 讲义深度构建中...</p>
                          </div>
                        ) : diveData ? (
                          <>
                            <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100/30">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded uppercase">Master Lecture</span>
                              </div>
                              <p className="text-[13px] text-indigo-900 leading-relaxed font-medium">{diveData.lecture}</p>
                            </div>
                            <div className="p-5 bg-red-50/50 rounded-2xl border border-red-100/30">
                              <h6 className="text-[10px] font-black text-red-700 uppercase mb-2">易错陷阱</h6>
                              <p className="text-[13px] text-red-900 leading-relaxed font-medium">{diveData.mistakeAnalysis}</p>
                            </div>
                            <div className="p-5 bg-green-50/50 rounded-2xl border border-green-100/30">
                              <h6 className="text-[10px] font-black text-green-700 uppercase mb-2">提分技巧</h6>
                              <ul className="space-y-2">
                                {/* FIXED: Explicitly cast diveData.tips to string[] to resolve the 'unknown' error */}
                                {Array.isArray(diveData.tips) && (diveData.tips as string[]).map((tip: string, i: number) => (
                                  <li key={i} className="text-[13px] text-green-900 leading-relaxed font-bold flex gap-2">
                                    <span className="text-green-400">#</span> {tip}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <button onClick={() => onStartQuiz(point)} className="w-full py-4.5 bg-indigo-600 text-white rounded-[20px] font-black text-sm active:scale-95 shadow-lg shadow-indigo-100 transition-all">
                              针对此考点强化训练
                            </button>
                          </>
                        ) : (
                          <div className="text-center py-8 text-gray-300">
                             <p className="text-xs mb-3">讲义加载失败，请检查网络或刷新</p>
                             <button onClick={() => handleTogglePoint(point)} className="px-4 py-2 bg-gray-100 text-gray-500 rounded-lg text-[10px] font-bold">重试加载</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          Object.keys(groupedDetailedData).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-300">
              <span className="text-6xl mb-4 opacity-50">🍃</span>
              <p className="font-bold">此考点下暂无题目</p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedDetailedData).map(([point, items]) => (
                <div key={point} className="space-y-4">
                  <div className="flex items-center gap-3 py-2">
                     <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                     <h3 className="font-black text-gray-900 tracking-tight">{point}</h3>
                  </div>
                  {items.map((q) => {
                    const isChatting = activeChatId === q.timestamp;
                    // FIXED: Explicitly type qChatHistory to prevent it being inferred as unknown
                    const qChatHistory: ChatMessage[] = chatHistories[q.timestamp] || [];
                    
                    return (
                      <div key={q.timestamp} className="bg-white rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden group">
                        {/* 题目内容 */}
                        <div className="p-6">
                          <button 
                            onClick={(e) => {
                              e.preventDefault();
                              onDeleteWrong(q.timestamp);
                            }}
                            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-red-50 text-red-400 opacity-0 group-hover:opacity-100 transition-all z-20 active:scale-90"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                          
                          <p className="text-[15px] font-bold text-gray-800 mb-5 pr-8 leading-relaxed">{q.question}</p>
                          <div className="space-y-2 mb-6">
                            {q.options.map((opt, i) => (
                              <div key={i} className={`p-4 rounded-2xl text-[13px] border-2 transition-all ${i === q.answerIndex ? 'bg-green-50 border-green-200 text-green-700 font-black' : i === q.userAnswerIndex ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-transparent text-gray-400'}`}>
                                {String.fromCharCode(65 + i)}. {opt}
                              </div>
                            ))}
                          </div>
                          <div className="p-5 bg-indigo-50/30 rounded-2xl text-[12px] text-gray-600 leading-relaxed border border-indigo-100/20 mb-4">
                            <span className="font-black text-indigo-600 block mb-2 tracking-widest uppercase text-[10px]">考点深度解析</span>
                            {q.explanation}
                          </div>

                          <button 
                            onClick={() => setActiveChatId(isChatting ? null : q.timestamp)}
                            className={`w-full py-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all ${isChatting ? 'bg-gray-900 text-white' : 'bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm'}`}
                          >
                            <span>{isChatting ? '收起 AI 答疑' : '🤖 针对此题向 AI 提问'}</span>
                            {!isChatting && <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse"></div>}
                          </button>
                        </div>

                        {/* AI 答疑区 */}
                        {isChatting && (
                          <div className="bg-indigo-50/50 p-6 border-t border-indigo-100/30 animate-fadeIn">
                            <div className="flex flex-col gap-4 mb-6 max-h-[350px] overflow-y-auto no-scrollbar">
                              {qChatHistory.length === 0 && (
                                <p className="text-center text-[11px] text-indigo-300 font-bold italic py-4">
                                  这题哪里不明白？或者想知道相关的变式题？直接问我！
                                </p>
                              )}
                              {/* FIXED: Using typed qChatHistory to avoid mapping on 'unknown' */}
                              {qChatHistory.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-[85%] p-4 rounded-[22px] text-[13px] font-medium leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-gray-700 rounded-bl-none shadow-sm border border-indigo-50'}`}>
                                    {msg.content}
                                  </div>
                                </div>
                              ))}
                              {isAsking && (
                                <div className="flex justify-start">
                                  <div className="bg-white p-4 rounded-2xl border border-indigo-50 flex gap-1.5 animate-pulse">
                                    <div className="w-1 h-1 bg-indigo-200 rounded-full"></div>
                                    <div className="w-1 h-1 bg-indigo-300 rounded-full"></div>
                                    <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
                                  </div>
                                </div>
                              )}
                              <div ref={chatEndRef} />
                            </div>

                            <div className="relative flex gap-2">
                              <div className="relative flex-1">
                                <input
                                  type="text"
                                  value={followUpQuery}
                                  onChange={(e) => setFollowUpQuery(e.target.value)}
                                  onKeyPress={(e) => e.key === 'Enter' && handleAskAI(q)}
                                  placeholder={isRecognizing ? "正在倾听..." : "输入你的语法疑问..."}
                                  className={`w-full py-4 pl-5 pr-12 bg-white rounded-2xl border-none text-[13px] font-bold shadow-lg transition-all ${isRecognizing ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''}`}
                                />
                                <button 
                                  onClick={() => isRecognizing ? recognitionRef.current?.stop() : recognitionRef.current?.start()}
                                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center ${isRecognizing ? 'bg-indigo-600 text-white animate-pulse' : 'text-gray-300 hover:text-indigo-400'}`}
                                >
                                  🎙️
                                </button>
                              </div>
                              <button 
                                onClick={() => handleAskAI(q)} 
                                disabled={!followUpQuery.trim() || isAsking}
                                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${!followUpQuery.trim() || isAsking ? 'bg-gray-100 text-gray-300' : 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 active:scale-90'}`}
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 12h14M12 5l7 7-7 7"/></svg>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default ReviewView;
