
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { WrongQuestion, ChatMessage, Question } from '../types';
import { getGrammarDeepDive, askFollowUpQuestion } from '../services/geminiService';

interface ReviewViewProps {
  history: WrongQuestion[];
  savedHistory: WrongQuestion[];
  onBack: () => void;
  onClear: (type: 'details' | 'saved') => void;
  onDeleteWrong: (timestamp: number, text: string) => void;
  onDeleteSaved: (timestamp: number, text: string) => void;
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
  const [errorPoints, setErrorPoints] = useState<Record<string, boolean>>({});
  
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [followUpQuery, setFollowUpQuery] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isAsking]);

  const toggleChat = (id: string) => {
    if (activeChatId === id) {
      setActiveChatId(null);
      setChatHistory([]);
    } else {
      setActiveChatId(id);
      setChatHistory([]);
    }
  };

  // Explicitly type groupedData to ensure Object.entries works as expected and prevent 'unknown' inference
  const groupedData = useMemo<Record<string, WrongQuestion[]>>(() => {
    const currentList = activeTab === 'details' ? history : savedHistory;
    const map: Record<string, WrongQuestion[]> = {};
    currentList.forEach(q => {
      if (!map[q.grammarPoint]) map[q.grammarPoint] = [];
      map[q.grammarPoint].push(q);
    });
    return map;
  }, [activeTab, history, savedHistory]);

  // Explicitly type knowledgeMap to avoid 'unknown' inference in downstream memos and views
  const knowledgeMap = useMemo<Record<string, { count: number; questions: WrongQuestion[] }>>(() => {
    const map: Record<string, { count: number; questions: WrongQuestion[] }> = {};
    history.forEach(q => {
      if (!map[q.grammarPoint]) map[q.grammarPoint] = { count: 0, questions: [] };
      map[q.grammarPoint].count++;
      map[q.grammarPoint].questions.push(q);
    });
    return map;
  }, [history]);

  // Use explicit typing for sortedPoints to prevent 'unknown' property errors when mapping in the JSX
  const sortedPoints = useMemo<[string, { count: number; questions: WrongQuestion[] }][]>(() => {
    return (Object.entries(knowledgeMap) as [string, { count: number; questions: WrongQuestion[] }][])
      .sort((a, b) => b[1].count - a[1].count);
  }, [knowledgeMap]);

  const handleDeleteItem = (e: React.MouseEvent, q: WrongQuestion) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("确定要删除这条记录吗？")) {
      if (activeTab === 'details') onDeleteWrong(q.timestamp, q.question);
      else onDeleteSaved(q.timestamp, q.question);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    if (activeTab === 'details') onClear('details');
    else if (activeTab === 'saved') onClear('saved');
  };

  const handleTogglePoint = async (point: string) => {
    if (selectedPoint === point) {
      setSelectedPoint(null);
      return;
    }
    setSelectedPoint(point);
    if (!deepDives[point]) {
      setLoadingPoints(p => ({ ...p, [point]: true }));
      try {
        const data = await getGrammarDeepDive(point, knowledgeMap[point].questions);
        setDeepDives(p => ({ ...p, [point]: data }));
      } catch (e) {
        setErrorPoints(p => ({ ...p, [point]: true }));
      } finally {
        setLoadingPoints(p => ({ ...p, [point]: false }));
      }
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
            <h1 className="text-xl font-black text-gray-900">语法笔记</h1>
          </div>
          {(activeTab === 'details' && history.length > 0) || (activeTab === 'saved' && savedHistory.length > 0) ? (
            <button onClick={handleClear} className="px-4 py-2 text-[11px] font-black text-red-500 bg-red-50 rounded-xl active:scale-95">清空当前页</button>
          ) : null}
        </header>

        <div className="px-6 py-4 flex gap-2 overflow-x-auto no-scrollbar">
          {(['summary', 'details', 'saved'] as const).map(tab => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)} 
              className={`px-4 py-2.5 rounded-xl text-[11px] font-black transition-all border-2 ${activeTab === tab ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-gray-100 text-gray-400'}`}
            >
              {tab === 'summary' ? '📝 考点提炼' : tab === 'details' ? `📜 错题集 (${history.length})` : `⭐ 收藏本 (${savedHistory.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 px-6 pt-6">
        {Object.keys(groupedData).length === 0 && activeTab !== 'summary' ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-300">
            <span className="text-6xl mb-4">🍃</span>
            <p className="font-bold">暂无数据</p>
          </div>
        ) : activeTab === 'summary' ? (
          <div className="space-y-4">
            {sortedPoints.map(([point, data]) => (
              <div key={point} className="bg-white rounded-[24px] border border-gray-100 overflow-hidden transition-all">
                <button onClick={() => handleTogglePoint(point)} className="w-full p-6 flex justify-between items-center text-left">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black">{data.count}</div>
                    <span className="font-bold text-gray-900">{point}</span>
                  </div>
                  <svg className={`w-5 h-5 text-gray-300 transition-transform ${selectedPoint === point ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                </button>
                {selectedPoint === point && (
                  <div className="px-6 pb-6 border-t border-gray-50 animate-fadeIn pt-4 space-y-4">
                    {loadingPoints[point] ? (
                      <div className="py-8 flex justify-center"><div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>
                    ) : deepDives[point] ? (
                      <>
                        <div className="p-4 bg-indigo-50/50 rounded-2xl">
                          <h6 className="text-[10px] font-black text-indigo-700 uppercase mb-2">考点讲解</h6>
                          <p className="text-[13px] text-indigo-900 leading-relaxed">{deepDives[point].lecture}</p>
                        </div>
                        <div className="p-4 bg-red-50/50 rounded-2xl">
                          <h6 className="text-[10px] font-black text-red-700 uppercase mb-2">典型错因</h6>
                          <p className="text-[13px] text-red-900 leading-relaxed italic">{deepDives[point].mistakeAnalysis}</p>
                        </div>
                        {/* Render tips using a safe map call with a check for existence to avoid Property 'map' does not exist on type 'unknown' errors */}
                        {deepDives[point].tips && deepDives[point].tips.length > 0 && (
                          <div className="p-4 bg-amber-50/50 rounded-2xl">
                            <h6 className="text-[10px] font-black text-amber-700 uppercase mb-2">避坑指南</h6>
                            <ul className="space-y-1">
                              {deepDives[point].tips.map((tip, idx) => (
                                <li key={idx} className="text-[12px] text-amber-900 flex gap-2">
                                  <span className="text-amber-400">●</span>
                                  <span>{tip}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <button onClick={() => onStartQuiz(point)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm active:scale-95 shadow-lg">专项练习</button>
                      </>
                    ) : <p className="text-center text-xs text-gray-400 py-4">无法获取解析，请重试</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedData).map(([point, items]) => (
              <div key={point} className="space-y-4">
                <div className="flex items-center gap-3 py-2">
                   <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                   <h3 className="font-black text-gray-900">{point}</h3>
                </div>
                {items.map((q, idx) => (
                  <div key={q.timestamp || idx} className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm relative group">
                    <button 
                      onClick={(e) => handleDeleteItem(e, q)}
                      className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-red-50 text-red-500 active:scale-90 transition-all shadow-sm z-10"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                    <p className="text-[15px] font-bold text-gray-800 mb-4 pr-8">{q.question}</p>
                    <div className="space-y-2 mb-4">
                      {q.options.map((opt, i) => (
                        <div key={i} className={`p-3 rounded-xl text-[13px] border ${i === q.answerIndex ? 'bg-green-50 border-green-200 text-green-700 font-bold' : i === q.userAnswerIndex ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-50 text-gray-400'}`}>
                          {String.fromCharCode(65 + i)}. {opt}
                        </div>
                      ))}
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl text-[12px] text-gray-500 leading-relaxed font-medium">
                      <span className="font-black text-indigo-600 block mb-1">💡 详解：</span>
                      {q.explanation}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewView;
