
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { WrongQuestion, ChatMessage } from '../types';
import { getGrammarDeepDive, askFollowUpQuestion } from '../services/geminiService';

interface ReviewViewProps {
  history: WrongQuestion[];
  savedHistory: WrongQuestion[];
  onBack: () => void;
  onClearWrong: () => void;
  onClearSaved: () => void;
  onStartQuiz: (point: string) => void;
  onRemoveWrong: (timestamp: number) => void;
  onRemoveSaved: (timestamp: number) => void;
  initialTab?: 'summary' | 'details' | 'saved';
}

interface DeepDiveData {
  lecture: string;
  mistakeAnalysis: string;
  tips: string[];
}

const ReviewView: React.FC<ReviewViewProps> = ({ 
  history, 
  savedHistory, 
  onBack, 
  onClearWrong, 
  onClearSaved, 
  onStartQuiz, 
  onRemoveWrong, 
  onRemoveSaved, 
  initialTab = 'summary' 
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'details' | 'saved'>(initialTab);
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);
  const [deepDives, setDeepDives] = useState<Record<string, DeepDiveData>>({});
  const [loadingPoints, setLoadingPoints] = useState<Record<string, boolean>>({});

  // 统一删除确认状态
  const [pendingDelete, setPendingDelete] = useState<WrongQuestion | null>(null);
  const [pendingClear, setPendingClear] = useState(false);

  // AI 答疑相关状态
  const [activeAiTimestamp, setActiveAiTimestamp] = useState<number | null>(null);
  const [cardChatHistories, setCardChatHistories] = useState<Record<number, ChatMessage[]>>({});
  const [cardQueries, setCardQueries] = useState<Record<number, string>>({});
  const [cardAskingState, setCardAskingState] = useState<Record<number, boolean>>({});
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [cardChatHistories, cardAskingState]);

  const knowledgeMap = useMemo(() => {
    const map: Record<string, { count: number; questions: WrongQuestion[] }> = {};
    const source = history || [];
    source.forEach(q => {
      if (!map[q.grammarPoint]) map[q.grammarPoint] = { count: 0, questions: [] };
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
    if (loadingPoints[point]) return;
    setLoadingPoints(prev => ({ ...prev, [point]: true }));
    try {
      const data = await getGrammarDeepDive(point, knowledgeMap[point].questions);
      setDeepDives(prev => ({ ...prev, [point]: data }));
    } catch (err) { console.error(err); }
    finally { setLoadingPoints(prev => ({ ...prev, [point]: false })); }
  };

  const handleTogglePoint = (point: string) => {
    if (selectedPoint === point) { setSelectedPoint(null); return; }
    setSelectedPoint(point);
    if (!deepDives[point] && knowledgeMap[point]) fetchDeepDive(point);
  };

  const executeDelete = () => {
    if (!pendingDelete) return;
    if (activeTab === 'details') {
      onRemoveWrong(pendingDelete.timestamp);
    } else {
      onRemoveSaved(pendingDelete.timestamp);
    }
    setPendingDelete(null);
  };

  const executeClear = () => {
    if (activeTab === 'details') {
      onClearWrong();
    } else if (activeTab === 'saved') {
      onClearSaved();
    }
    setPendingClear(false);
  };

  const handleCardAsk = async (q: WrongQuestion) => {
    const query = cardQueries[q.timestamp]?.trim();
    if (!query || cardAskingState[q.timestamp]) return;

    const currentHistory = cardChatHistories[q.timestamp] || [];
    const newHistory: ChatMessage[] = [...currentHistory, { role: 'user', content: query }];
    
    setCardChatHistories(prev => ({ ...prev, [q.timestamp]: newHistory }));
    setCardQueries(prev => ({ ...prev, [q.timestamp]: '' }));
    setCardAskingState(prev => ({ ...prev, [q.timestamp]: true }));

    try {
      const response = await askFollowUpQuestion(q, currentHistory, query);
      setCardChatHistories(prev => ({ 
        ...prev, 
        [q.timestamp]: [...newHistory, { role: 'model', content: response }] 
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setCardAskingState(prev => ({ ...prev, [q.timestamp]: false }));
    }
  };

  const renderQuestionCard = (q: WrongQuestion, idx: number) => {
    const isAiOpen = activeAiTimestamp === q.timestamp;
    const currentChatHistory = cardChatHistories[q.timestamp] || [];
    const isAsking = cardAskingState[q.timestamp] || false;

    return (
      <div key={`${q.timestamp}-${idx}`} className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm relative animate-fadeIn mb-4">
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col gap-2">
            <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-lg border border-indigo-100 w-fit">#{q.grammarPoint}</span>
            <span className="text-[10px] text-gray-400 font-medium">{new Date(q.timestamp).toLocaleDateString()}</span>
          </div>
          
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); setPendingDelete(q); }}
            className="p-3 bg-red-50 text-red-500 rounded-2xl active:scale-90 transition-all border border-red-100/30 shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
        
        <p className="text-sm text-gray-800 font-bold mb-4 leading-relaxed">{q.question}</p>
        
        {q.translation && (
          <div className="mb-4 p-3 bg-amber-50/50 rounded-xl border border-amber-100/30">
            <p className="text-[11px] text-amber-900 font-medium italic">【译文】{q.translation}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-4">
          {q.options.map((opt, i) => (
            <div key={i} className={`p-3 rounded-xl text-[13px] border ${i === q.answerIndex ? 'bg-green-50 border-green-100 text-green-700 font-bold' : i === q.userAnswerIndex ? 'bg-red-50 border-red-100 text-red-700' : 'bg-gray-50 border-gray-50 text-gray-400'}`}>
              {String.fromCharCode(65 + i)}. {opt}
            </div>
          ))}
        </div>
        
        <div className="p-4 bg-gray-50 rounded-2xl text-[12px] text-gray-600 leading-relaxed border border-gray-100 shadow-inner mb-4">
          <span className="text-[10px] font-black text-indigo-600 block mb-1 uppercase tracking-widest">解析</span>
          {q.explanation}
        </div>

        <button 
          onClick={() => setActiveAiTimestamp(isAiOpen ? null : q.timestamp)}
          className={`w-full py-3.5 rounded-2xl flex items-center justify-center gap-3 text-[12px] font-black transition-all ${isAiOpen ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white text-indigo-600 border border-indigo-100 active:bg-indigo-50'}`}
        >
          <span className="text-sm">{isAiOpen ? '✨ 收起答疑' : '🤖 AI 深度解析'}</span>
          <svg className={`w-4 h-4 transition-transform ${isAiOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>

        {isAiOpen && (
          <div className="mt-4 p-5 bg-indigo-50/30 rounded-[32px] border border-indigo-100 flex flex-col animate-fadeIn">
            <div className="flex flex-col gap-3 mb-4 max-h-[250px] overflow-y-auto no-scrollbar">
              {currentChatHistory.length === 0 && (
                <div className="text-center py-4 px-4">
                  <p className="text-[11px] text-indigo-500 font-bold mb-1 tracking-tight">本题难点在哪里？</p>
                  <p className="text-[10px] text-gray-400">问 AI：为什么选 A 不选 B？</p>
                </div>
              )}
              {currentChatHistory.map((msg, midx) => (
                <div key={midx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
                  <div className={`max-w-[85%] p-3.5 rounded-[20px] text-[12px] font-medium leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none shadow-md' : 'bg-white text-gray-700 rounded-bl-none border border-indigo-50 shadow-sm'}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isAsking && (
                <div className="flex justify-start">
                  <div className="bg-white p-3 rounded-2xl border border-indigo-50 flex gap-1.5 animate-pulse shadow-sm">
                    <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full"></div>
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></div>
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            
            <div className="relative flex items-center gap-2">
              <input
                type="text"
                value={cardQueries[q.timestamp] || ''}
                onChange={(e) => setCardQueries(prev => ({ ...prev, [q.timestamp]: e.target.value }))}
                onKeyPress={(e) => e.key === 'Enter' && handleCardAsk(q)}
                placeholder="在此向名师提问..."
                className="flex-1 py-3 px-5 bg-white rounded-2xl border-none text-[12px] font-bold shadow-md outline-none focus:ring-2 focus:ring-indigo-100"
              />
              <button 
                onClick={() => handleCardAsk(q)}
                disabled={!cardQueries[q.timestamp]?.trim() || isAsking}
                className="w-11 h-11 bg-indigo-600 text-white rounded-xl shadow-xl flex items-center justify-center active:scale-90 disabled:opacity-50 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 12h14M12 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-[#FDFCF8] min-h-screen h-screen overflow-hidden relative">
      {/* 全屏模态框：确认删除 */}
      {pendingDelete && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 backdrop-blur-md p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-xs rounded-[40px] p-8 shadow-2xl text-center scale-up">
            <div className="text-4xl mb-4">🗑️</div>
            <h3 className="text-xl font-black text-gray-900 mb-2">确认删除吗？</h3>
            <p className="text-xs text-gray-400 font-bold mb-8 uppercase tracking-widest">此操作不可撤销</p>
            <div className="flex flex-col gap-3">
              <button onClick={executeDelete} className="w-full py-4.5 bg-red-500 text-white rounded-2xl font-black shadow-lg shadow-red-100 active:scale-95 transition-all">确定删除</button>
              <button onClick={() => setPendingDelete(null)} className="w-full py-4.5 bg-gray-50 text-gray-400 rounded-2xl font-bold">先留着</button>
            </div>
          </div>
        </div>
      )}

      {/* 全屏模态框：确认清空本页 */}
      {pendingClear && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 backdrop-blur-md p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-xs rounded-[40px] p-8 shadow-2xl text-center scale-up">
            <div className="text-4xl mb-4">🚨</div>
            <h3 className="text-xl font-black text-gray-900 mb-2">清空当前列表？</h3>
            <p className="text-xs text-gray-400 font-bold mb-8 uppercase tracking-widest">
              确认要清空所有的{activeTab === 'details' ? '错题记录' : '收藏题目'}吗？
            </p>
            <div className="flex flex-col gap-3 mt-4">
              <button onClick={executeClear} className="w-full py-4.5 bg-red-600 text-white rounded-2xl font-black shadow-lg shadow-red-100 active:scale-95 transition-all">确认清空</button>
              <button onClick={() => setPendingClear(false)} className="w-full py-4.5 bg-gray-50 text-gray-400 rounded-2xl font-bold">取消</button>
            </div>
          </div>
        </div>
      )}

      <header className="p-6 bg-white border-b border-gray-100 flex justify-between items-center flex-shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 active:scale-90 transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">学习笔记本</h1>
        </div>
        {(activeTab === 'details' || activeTab === 'saved') && (activeTab === 'details' ? history.length > 0 : savedHistory.length > 0) && (
          <button 
            onClick={() => setPendingClear(true)} 
            className="px-4 py-2 text-[11px] font-black text-red-500 bg-red-50 rounded-xl active:scale-95 border border-red-100"
          >
            清空本页
          </button>
        )}
      </header>

      <div className="px-6 py-4 bg-white border-b border-gray-100 flex gap-2 overflow-x-auto no-scrollbar flex-shrink-0">
        <button onClick={() => setActiveTab('summary')} className={`flex-1 py-3 px-4 rounded-2xl text-xs font-black transition-all whitespace-nowrap border-2 ${activeTab === 'summary' ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-gray-100 text-gray-400'}`}>📝 考点提炼</button>
        <button onClick={() => setActiveTab('details')} className={`flex-1 py-3 px-4 rounded-2xl text-xs font-black transition-all whitespace-nowrap border-2 ${activeTab === 'details' ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-gray-100 text-gray-400'}`}>📜 错题集 ({history.length})</button>
        <button onClick={() => setActiveTab('saved')} className={`flex-1 py-3 px-4 rounded-2xl text-xs font-black transition-all whitespace-nowrap border-2 ${activeTab === 'saved' ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-100' : 'bg-white border-gray-100 text-gray-400'}`}>⭐ 收藏本 ({savedHistory.length})</button>
      </div>

      <main className="flex-1 p-6 space-y-2 animate-fadeIn pb-24 no-scrollbar overflow-y-auto">
        {activeTab === 'summary' ? (
          <div className="space-y-4">
            {sortedPoints.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center opacity-30">
                <span className="text-4xl mb-3">📭</span>
                <span className="font-black">暂无错题考点分析</span>
              </div>
            ) : sortedPoints.map(([point, data]) => (
              <div key={point} className={`bg-white rounded-[28px] border ${selectedPoint === point ? 'ring-2 ring-indigo-500 border-transparent shadow-lg' : 'border-gray-100'}`}>
                <button onClick={() => handleTogglePoint(point)} className="w-full p-6 flex items-center justify-between text-left">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl bg-indigo-50 text-indigo-500`}>{data.count >= 5 ? '🔥' : '💡'}</div>
                    <div><h5 className="font-bold text-gray-900">{point}</h5><p className="text-xs text-gray-400 font-medium">涉及 {data.count} 道错题</p></div>
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform ${selectedPoint === point ? 'rotate-180 bg-indigo-50 text-indigo-600' : 'bg-gray-50 text-gray-300'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg></div>
                </button>
                {selectedPoint === point && (
                  <div className="px-6 pb-6 animate-fadeIn pt-4 border-t border-gray-50 space-y-4">
                    {loadingPoints[point] ? (
                      <div className="py-8 text-center text-xs font-bold text-gray-400 animate-pulse">AI 正在调取错题库并生成解析...</div>
                    ) : deepDives[point] ? (
                      <div className="space-y-4">
                        <div className="bg-indigo-50/50 p-5 rounded-[22px] border border-indigo-100/50">
                          <h6 className="text-[11px] font-black text-indigo-700 mb-2 uppercase tracking-widest">考点精讲</h6>
                          <p className="text-[13px] text-indigo-900 font-medium leading-relaxed">{deepDives[point].lecture}</p>
                        </div>
                        <div className="bg-red-50/50 p-5 rounded-[22px] border border-red-100/50">
                          <h6 className="text-[11px] font-black text-red-700 mb-2 uppercase tracking-widest">错因总结</h6>
                          <p className="text-[13px] text-red-900 font-medium leading-relaxed italic">{deepDives[point].mistakeAnalysis}</p>
                        </div>
                        <div className="bg-amber-50/50 p-5 rounded-[22px] border border-amber-100/50">
                          <h6 className="text-[11px] font-black text-amber-700 mb-2 uppercase tracking-widest">提分技巧</h6>
                          <ul className="space-y-1">{deepDives[point].tips.map((tip, i) => <li key={i} className="text-[12px] text-amber-900 font-bold flex gap-2"><span>•</span>{tip}</li>)}</ul>
                        </div>
                        <button onClick={() => onStartQuiz(point)} className="w-full py-4.5 bg-indigo-600 text-white rounded-[24px] font-black text-[15px] shadow-xl shadow-indigo-100 active:scale-95">开启专项突破</button>
                      </div>
                    ) : <div className="p-4 text-center text-xs text-gray-400 italic">加载失败，请重试。</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : activeTab === 'details' ? (
          history.length === 0 ? <div className="py-20 text-center flex flex-col items-center opacity-30"><span className="text-4xl mb-3">📜</span><span className="font-black">暂无错题记录</span></div> : history.map((q, i) => renderQuestionCard(q, i))
        ) : (
          savedHistory.length === 0 ? <div className="py-20 text-center flex flex-col items-center opacity-30"><span className="text-4xl mb-3">⭐</span><span className="font-black">暂无收藏题目</span></div> : savedHistory.map((q, i) => renderQuestionCard(q, i))
        )}
      </main>

      <style>{`
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.85); }
          to { opacity: 1; transform: scale(1); }
        }
        .scale-up {
          animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>
    </div>
  );
};

export default ReviewView;
