
import React, { useState, useMemo, useEffect } from 'react';
import { WrongQuestion, GRAMMAR_POINTS } from '../types';
import { getGrammarDeepDive } from '../services/geminiService';

interface ReviewViewProps {
  history: WrongQuestion[];
  onBack: () => void;
  onClear: () => void;
  onStartQuiz: (point: string) => void;
  initialTab?: 'summary' | 'details';
}

interface DeepDiveData {
  lecture: string;
  mistakeAnalysis: string;
  tips: string[];
}

const ReviewView: React.FC<ReviewViewProps> = ({ history, onBack, onClear, onStartQuiz, initialTab = 'summary' }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'details'>(initialTab);
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);
  const [deepDives, setDeepDives] = useState<Record<string, DeepDiveData>>({});
  const [loadingPoints, setLoadingPoints] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // 按语法点聚合错题数据
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

  const handleTogglePoint = async (point: string) => {
    if (selectedPoint === point) {
      setSelectedPoint(null);
      return;
    }

    setSelectedPoint(point);

    // 如果没有加载过深度分析且当前有错题，则请求 AI
    if (!deepDives[point] && !loadingPoints[point] && knowledgeMap[point]) {
      setLoadingPoints(prev => ({ ...prev, [point]: true }));
      try {
        const data = await getGrammarDeepDive(point, knowledgeMap[point].questions);
        setDeepDives(prev => ({ ...prev, [point]: data }));
      } catch (err) {
        console.error("Deep dive generation failed");
      } finally {
        setLoadingPoints(prev => ({ ...prev, [point]: false }));
      }
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

  return (
    <div className="flex-1 flex flex-col bg-[#FDFCF8] min-h-screen">
      {/* 笔记本风格页眉 */}
      <header className="p-6 bg-white border-b border-gray-100 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack} 
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 active:scale-90 transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">语法笔记</h1>
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Mastery Notes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button 
              onClick={onClear} 
              className="px-4 py-2 text-[11px] font-black text-red-400 bg-red-50 rounded-xl active:opacity-60"
            >
              清空
            </button>
          )}
        </div>
      </header>

      {/* 标签切换 */}
      <div className="px-6 py-4 bg-white/50 backdrop-blur-sm border-b border-gray-100 flex gap-4 overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveTab('summary')}
          className={`flex-1 py-3 px-4 rounded-2xl text-xs font-black transition-all whitespace-nowrap border-2 ${
            activeTab === 'summary' 
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' 
              : 'bg-white border-gray-100 text-gray-400'
          }`}
        >
          📝 知识点提炼
        </button>
        <button 
          onClick={() => setActiveTab('details')}
          className={`flex-1 py-3 px-4 rounded-2xl text-xs font-black transition-all whitespace-nowrap border-2 ${
            activeTab === 'details' 
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' 
              : 'bg-white border-gray-100 text-gray-400'
          }`}
        >
          📜 错题明细
        </button>
      </div>

      {history.length === 0 ? (
        <main className="flex-1 flex flex-col items-center justify-center p-12 text-center">
          <div className="w-32 h-32 bg-indigo-50 rounded-full flex items-center justify-center text-5xl mb-6 grayscale opacity-50">✍️</div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">笔记簿空空如也</h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            开始练习，AI 将会自动为你整理<br/>错题中的核心考点与知识逻辑。
          </p>
        </main>
      ) : (
        <main className="flex-1 p-6 space-y-8 animate-fadeIn pb-20">
          {activeTab === 'summary' ? (
            <div className="space-y-6">
              {/* 核心薄弱环节分析卡片 */}
              {sortedPoints.length > 0 && (
                <section className="bg-gradient-to-br from-indigo-700 to-violet-700 rounded-[32px] p-8 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
                  <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                  <div className="relative z-10">
                    <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-4">Focus Analysis</p>
                    <h2 className="text-2xl font-black mb-6 leading-tight">
                      你需要重点关注<br/>
                      <span className="text-yellow-300">#{sortedPoints[0][0]}</span>
                    </h2>
                    <div className="flex items-center gap-4 p-4 bg-white/10 rounded-2xl border border-white/10">
                      <div className="text-2xl">🎯</div>
                      <p className="text-xs text-white/90 font-medium leading-relaxed italic">
                        该考点错误率最高，AI 建议你深入查阅下方的“考点逻辑清单”进行复盘。
                      </p>
                    </div>
                  </div>
                </section>
              )}

              {/* 知识点归纳 */}
              <div className="space-y-4">
                <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span> 考点逻辑清单
                </h4>
                {sortedPoints.map(([point, data]) => (
                  <div 
                    key={point}
                    className={`bg-white rounded-[28px] border transition-all duration-300 ${
                      selectedPoint === point ? 'ring-2 ring-indigo-500 border-transparent shadow-lg' : 'border-gray-100'
                    }`}
                  >
                    <button 
                      onClick={() => handleTogglePoint(point)}
                      className="w-full p-6 flex items-center justify-between text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm ${
                          data.count >= 5 ? 'bg-red-50 text-red-500' : 'bg-indigo-50 text-indigo-500'
                        }`}>
                          {data.count >= 5 ? '🔥' : '💡'}
                        </div>
                        <div>
                          <h5 className="font-bold text-gray-900">{point}</h5>
                          <p className="text-xs text-gray-400 font-medium">涉及 {data.count} 道错题记录</p>
                        </div>
                      </div>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform ${selectedPoint === point ? 'rotate-180 bg-indigo-50 text-indigo-600' : 'bg-gray-50 text-gray-300'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                      </div>
                    </button>
                    
                    {selectedPoint === point && (
                      <div className="px-6 pb-6 animate-fadeIn">
                        <div className="pt-4 border-t border-gray-50 space-y-5">
                          {/* AI 深度分析部分 */}
                          {loadingPoints[point] ? (
                            <div className="py-8 flex flex-col items-center justify-center space-y-3">
                              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                              <p className="text-[11px] text-gray-400 font-bold animate-pulse">AI 正在调取错题库并生成解析...</p>
                            </div>
                          ) : deepDives[point] ? (
                            <div className="space-y-4">
                              {/* 1. 考点讲解 */}
                              <div className="bg-indigo-50/50 p-5 rounded-[22px] border border-indigo-100/50">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-lg">📘</span>
                                  <h6 className="text-[12px] font-black text-indigo-700 uppercase tracking-tight">考点深度精讲</h6>
                                </div>
                                <p className="text-[13px] text-indigo-900 font-medium leading-relaxed">
                                  {deepDives[point].lecture}
                                </p>
                              </div>

                              {/* 2. 错因溯源 */}
                              <div className="bg-red-50/50 p-5 rounded-[22px] border border-red-100/50">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-lg">🔍</span>
                                  <h6 className="text-[12px] font-black text-red-700 uppercase tracking-tight">个性化错因分析</h6>
                                </div>
                                <p className="text-[13px] text-red-900 font-medium leading-relaxed italic">
                                  “{deepDives[point].mistakeAnalysis}”
                                </p>
                              </div>

                              {/* 3. 注意事项 */}
                              <div className="bg-amber-50/50 p-5 rounded-[22px] border border-amber-100/50">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-lg">⚠️</span>
                                  <h6 className="text-[12px] font-black text-amber-700 uppercase tracking-tight">高考避坑指南</h6>
                                </div>
                                <ul className="space-y-2">
                                  {deepDives[point].tips.map((tip, i) => (
                                    <li key={i} className="text-[12px] text-amber-900 font-bold flex gap-2">
                                      <span className="opacity-40">•</span>
                                      {tip}
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {/* 4. 专项训练入口 */}
                              <button
                                onClick={() => onStartQuiz(point)}
                                className="w-full py-4.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-[24px] font-black text-[15px] shadow-xl shadow-indigo-100 active:scale-[0.97] transition-all flex items-center justify-center gap-3"
                              >
                                <span className="text-xl">🚀</span>
                                <span>立即开启该考点专项突破</span>
                              </button>
                            </div>
                          ) : (
                            <div className="p-4 text-center text-xs text-gray-400 italic">未能生成深度解析，请稍后重试。</div>
                          )}

                          {/* 关联错题回顾 */}
                          <div className="mt-8 pt-4 border-t border-gray-50">
                            <h6 className="text-[10px] font-black text-gray-300 mb-4 uppercase tracking-widest text-center">— 关联错题回顾 —</h6>
                            <div className="space-y-4">
                              {data.questions.map((q, idx) => (
                                <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                                  <p className="text-[13px] text-gray-700 font-bold leading-relaxed mb-4">
                                    {q.question.replace('_____', '____')}
                                  </p>
                                  <div className="space-y-2">
                                    <div className="flex items-start gap-3 p-3 bg-red-50/50 rounded-xl border border-red-50">
                                      <span className="text-[10px] bg-red-500 text-white w-4 h-4 rounded-md flex items-center justify-center font-black mt-0.5">
                                        {String.fromCharCode(65 + q.userAnswerIndex)}
                                      </span>
                                      <div className="flex-1">
                                        <p className="text-[11px] text-gray-400 font-bold uppercase mb-0.5">你的选择</p>
                                        <p className="text-[13px] text-red-700 font-medium">{q.options[q.userAnswerIndex]}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-3 p-3 bg-green-50/50 rounded-xl border border-green-50">
                                      <span className="text-[10px] bg-green-500 text-white w-4 h-4 rounded-md flex items-center justify-center font-black mt-0.5">
                                        {String.fromCharCode(65 + q.answerIndex)}
                                      </span>
                                      <div className="flex-1">
                                        <p className="text-[11px] text-gray-400 font-bold uppercase mb-0.5">正确答案</p>
                                        <p className="text-[13px] text-green-700 font-bold">{q.options[q.answerIndex]}</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-violet-500 rounded-full"></span> 历史错题记录
              </h4>
              {history.map((q, idx) => (
                <div key={idx} className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex gap-2">
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-lg border border-indigo-100">#{q.grammarPoint}</span>
                      <span className={`px-2 py-1 text-[10px] font-black rounded-lg border transition-colors ${getDifficultyColor(q.difficulty)}`}>
                        {q.difficulty || '中等'}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-medium">{new Date(q.timestamp).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-gray-800 font-bold mb-4 leading-relaxed">{q.question}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {q.options.map((opt, i) => (
                      <div key={i} className={`p-3 rounded-xl text-[13px] border ${
                        i === q.answerIndex 
                          ? 'bg-green-50 border-green-100 text-green-700 font-bold' 
                          : i === q.userAnswerIndex 
                            ? 'bg-red-50 border-red-100 text-red-700' 
                            : 'bg-gray-50 border-gray-50 text-gray-400'
                      }`}>
                        {String.fromCharCode(65 + i)}. {opt}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      <footer className="h-10 flex items-center justify-center opacity-20 pointer-events-none sticky bottom-0">
        <div className="flex gap-1.5">
          {[1,2,3].map(i => <div key={i} className="w-1.5 h-1.5 bg-indigo-200 rounded-full"></div>)}
        </div>
      </footer>
      
      <style>{`
        .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default ReviewView;
