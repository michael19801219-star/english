
import React, { useState, useMemo, useEffect } from 'react';
import { WrongQuestion } from '../types';
import { getGrammarDeepDive } from '../services/geminiService';

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

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const knowledgeMap = useMemo(() => {
    const map: Record<string, { count: number; questions: WrongQuestion[] }> = {};
    history.forEach(q => {
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

  const renderQuestionCard = (q: WrongQuestion, idx: number) => (
    <div key={`${q.id}-${idx}`} className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-lg border border-indigo-100">#{q.grammarPoint}</span>
        <span className="text-[10px] text-gray-400 font-medium">{new Date(q.timestamp).toLocaleDateString()}</span>
      </div>
      <p className="text-sm text-gray-800 font-bold mb-4 leading-relaxed">{q.question}</p>
      
      {/* 中文翻译 */}
      {q.translation && (
        <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-50">
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
      <div className="p-4 bg-gray-50 rounded-2xl text-[12px] text-gray-600 leading-relaxed border border-gray-100">
        <span className="text-[10px] font-black text-indigo-600 block mb-1 uppercase">解析</span>
        {q.explanation}
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col bg-[#FDFCF8] min-h-screen">
      <header className="p-6 bg-white border-b border-gray-100 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 active:scale-90 transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">学习笔记本</h1>
        </div>
        {activeTab !== 'summary' && (history.length > 0 || savedHistory.length > 0) && (
          <button onClick={onClear} className="px-4 py-2 text-[11px] font-black text-red-400 bg-red-50 rounded-xl">清空</button>
        )}
      </header>

      <div className="px-6 py-4 bg-white/50 backdrop-blur-sm border-b border-gray-100 flex gap-2 overflow-x-auto no-scrollbar">
        <button onClick={() => setActiveTab('summary')} className={`flex-1 py-3 px-4 rounded-2xl text-xs font-black transition-all whitespace-nowrap border-2 ${activeTab === 'summary' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-100 text-gray-400'}`}>📝 考点提炼</button>
        <button onClick={() => setActiveTab('details')} className={`flex-1 py-3 px-4 rounded-2xl text-xs font-black transition-all whitespace-nowrap border-2 ${activeTab === 'details' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-100 text-gray-400'}`}>📜 错题集 ({history.length})</button>
        <button onClick={() => setActiveTab('saved')} className={`flex-1 py-3 px-4 rounded-2xl text-xs font-black transition-all whitespace-nowrap border-2 ${activeTab === 'saved' ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-100' : 'bg-white border-gray-100 text-gray-400'}`}>⭐ 收藏本 ({savedHistory.length})</button>
      </div>

      <main className="flex-1 p-6 space-y-6 animate-fadeIn pb-20 no-scrollbar overflow-y-auto">
        {activeTab === 'summary' ? (
          <div className="space-y-4">
            {sortedPoints.map(([point, data]) => (
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
                      <div className="py-8 text-center text-xs font-bold text-gray-400">AI 正在调取错题库并生成解析...</div>
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
          history.length === 0 ? <div className="py-20 text-center opacity-30 font-black">暂无错题记录</div> : history.map((q, i) => renderQuestionCard(q, i))
        ) : (
          savedHistory.length === 0 ? <div className="py-20 text-center opacity-30 font-black">暂无收藏题目</div> : savedHistory.map((q, i) => renderQuestionCard(q, i))
        )}
      </main>
    </div>
  );
};

export default ReviewView;
