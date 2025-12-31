
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { WrongQuestion, ChatMessage, Question } from '../types';
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
  const [errorPoints, setErrorPoints] = useState<Record<string, boolean>>({});
  
  // 用于自定义删除弹窗的状态
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; timestamp: number | null }>({ isOpen: false, timestamp: null });

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const groupedData = useMemo<Record<string, WrongQuestion[]>>(() => {
    const currentList = activeTab === 'details' ? history : savedHistory;
    const acc: Record<string, WrongQuestion[]> = {};
    currentList.forEach(q => {
      if (!acc[q.grammarPoint]) acc[q.grammarPoint] = [];
      acc[q.grammarPoint].push(q);
    });
    return acc;
  }, [activeTab, history, savedHistory]);

  const knowledgeMap = useMemo<Record<string, { count: number; questions: WrongQuestion[] }>>(() => {
    const acc: Record<string, { count: number; questions: WrongQuestion[] }> = {};
    history.forEach(q => {
      if (!acc[q.grammarPoint]) acc[q.grammarPoint] = { count: 0, questions: [] };
      acc[q.grammarPoint].count++;
      acc[q.grammarPoint].questions.push(q);
    });
    return acc;
  }, [history]);

  const sortedPoints = useMemo(() => {
    return (Object.entries(knowledgeMap) as [string, { count: number; questions: WrongQuestion[] }][])
      .sort((a, b) => b[1].count - a[1].count);
  }, [knowledgeMap]);

  // 打开确认弹窗
  const handleRequestDelete = (e: React.MouseEvent | React.PointerEvent, timestamp: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, timestamp });
  };

  // 执行删除动作
  const confirmDelete = () => {
    if (deleteConfirm.timestamp) {
      if (activeTab === 'details') onDeleteWrong(deleteConfirm.timestamp);
      else onDeleteSaved(deleteConfirm.timestamp);
    }
    setDeleteConfirm({ isOpen: false, timestamp: null });
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
        const pointData = knowledgeMap[point];
        if (pointData) {
          const data = await getGrammarDeepDive(point, pointData.questions);
          setDeepDives(p => ({ ...p, [point]: data }));
        }
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
            <button onClick={() => onClear(activeTab === 'details' ? 'details' : 'saved')} className="px-4 py-2 text-[11px] font-black text-red-500 bg-red-50 rounded-xl active:scale-95">清空当前页</button>
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

      <div className="flex-1 overflow-y-auto pb-24 px-6 pt-6 no-scrollbar">
        {Object.keys(groupedData).length === 0 && activeTab !== 'summary' ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-300">
            <span className="text-6xl mb-4">🍃</span>
            <p className="font-bold">暂无数据</p>
          </div>
        ) : activeTab === 'summary' ? (
          <div className="space-y-4">
            {sortedPoints.map(([point, data]) => {
              const diveData: DeepDiveData | undefined = deepDives[point];
              return (
                <div key={point} className="bg-white rounded-[24px] border border-gray-100 overflow-hidden shadow-sm">
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
                      ) : diveData ? (
                        <>
                          <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                            <h6 className="text-[10px] font-black text-indigo-700 uppercase mb-2">考点讲解</h6>
                            <p className="text-[13px] text-indigo-900 leading-relaxed">{diveData.lecture}</p>
                          </div>
                          <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100/50">
                            <h6 className="text-[10px] font-black text-red-700 uppercase mb-2">典型错因</h6>
                            <p className="text-[13px] text-red-900 leading-relaxed italic">{diveData.mistakeAnalysis}</p>
                          </div>
                          <div className="p-4 bg-green-50/50 rounded-2xl border border-green-100/50">
                            <h6 className="text-[10px] font-black text-green-700 uppercase mb-2">避坑指南</h6>
                            <ul className="list-disc list-inside space-y-1">
                              {Array.isArray(diveData.tips) && (diveData.tips as string[]).map((tip: string, i: number) => (
                                <li key={i} className="text-[13px] text-green-900 leading-relaxed">{tip}</li>
                              ))}
                            </ul>
                          </div>
                          <button onClick={() => onStartQuiz(point)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm active:scale-95 shadow-lg shadow-indigo-100">开始专项练习</button>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-8">
            {(Object.entries(groupedData) as [string, WrongQuestion[]][]).map(([point, items]) => (
              <div key={point} className="space-y-4">
                <div className="flex items-center gap-3 py-2">
                   <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                   <h3 className="font-black text-gray-900">{point}</h3>
                </div>
                {items.map((q) => (
                  <div key={q.timestamp} className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm relative overflow-hidden">
                    <button 
                      onPointerDown={(e) => handleRequestDelete(e, q.timestamp)}
                      className="absolute top-2 right-2 w-12 h-12 flex items-center justify-center rounded-full bg-red-50/50 text-red-500 active:scale-90 transition-all z-20"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                    
                    <p className="text-[15px] font-bold text-gray-800 mb-4 pr-10">{q.question}</p>
                    <div className="space-y-2 mb-4">
                      {q.options.map((opt, i) => (
                        <div key={i} className={`p-3 rounded-xl text-[13px] border ${i === q.answerIndex ? 'bg-green-50 border-green-200 text-green-700 font-bold' : i === q.userAnswerIndex ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-50 text-gray-400'}`}>
                          {String.fromCharCode(65 + i)}. {opt}
                        </div>
                      ))}
                    </div>
                    <div className="p-4 bg-gray-50/80 rounded-2xl text-[12px] text-gray-500 leading-relaxed border border-gray-100 font-medium">
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

      {/* 自定义删除确认弹窗 */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl scale-100 animate-fadeIn">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🗑️</div>
              <h3 className="text-xl font-black text-gray-900">确定要删除这条记录吗？</h3>
              <p className="text-xs text-gray-400 mt-2 font-medium">删除后将无法通过此页面找回。</p>
            </div>
            <div className="flex flex-col gap-3">
              <button 
                onClick={confirmDelete} 
                className="w-full py-4.5 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-2xl font-black shadow-lg shadow-red-100 active:scale-95 transition-all"
              >
                确认删除
              </button>
              <button 
                onClick={() => setDeleteConfirm({ isOpen: false, timestamp: null })} 
                className="w-full py-4.5 bg-gray-50 text-gray-500 rounded-2xl font-bold active:scale-95 transition-all"
              >
                返回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewView;
