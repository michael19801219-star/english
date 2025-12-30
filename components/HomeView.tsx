
import React, { useState } from 'react';
import { UserStats, Difficulty, GRAMMAR_POINTS } from '../types';

interface HomeViewProps {
  onStart: (count: number, difficulty: Difficulty, points: string[]) => void;
  stats: UserStats;
  onGoToReview: () => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onStart, stats, onGoToReview }) => {
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty>('中等');
  const [selectedPoints, setSelectedPoints] = useState<string[]>([]);
  const [showPointsModal, setShowPointsModal] = useState(false);

  const togglePoint = (point: string) => {
    setSelectedPoints(prev => 
      prev.includes(point) ? prev.filter(p => p !== point) : [...prev, point]
    );
  };

  const selectRandom = () => {
    setSelectedPoints([]);
    setShowPointsModal(false);
  };

  // 排序错题统计
  const sortedWrongEntries = Object.entries(stats.wrongCounts).sort((a, b) => (b[1] as number) - (a[1] as number));
  const hasWrongStats = sortedWrongEntries.length > 0;
  const topWrongPoint = hasWrongStats ? sortedWrongEntries[0][0] : null;

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto animate-fadeIn pb-10">
      <header className="py-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-900 leading-tight">高考英语<br/><span className="text-indigo-600">语法大师</span></h1>
        </div>
        <button 
          onClick={onGoToReview}
          className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center relative active:scale-95 transition-transform"
        >
          <span className="text-xl">📒</span>
          <span className="text-[10px] font-bold text-gray-500 mt-1">错题本</span>
          {stats.wrongHistory.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
              {stats.wrongHistory.length}
            </span>
          )}
        </button>
      </header>

      <div className="space-y-6 flex-1">
        {/* 题量选择 */}
        <section className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-widest flex items-center gap-2">
            <span>📊</span> 训练题量
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {[5, 10, 20, 30].map(c => (
              <button
                key={c}
                onClick={() => setCount(c)}
                className={`py-2.5 rounded-xl text-sm font-black transition-all ${
                  count === c ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >
                {c}题
              </button>
            ))}
          </div>
        </section>

        {/* 难度选择 */}
        <section className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-widest flex items-center gap-2">
            <span>🔥</span> 难度等级
          </h3>
          <div className="flex bg-gray-50 p-1.5 rounded-2xl">
            {(['简单', '中等', '较难'] as Difficulty[]).map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${
                  difficulty === d ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </section>

        {/* 考点选择 */}
        <section className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <span>🎯</span> 专项考点
            </h3>
            <button 
              onClick={() => setShowPointsModal(true)}
              className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full"
            >
              修改设置 &gt;
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedPoints.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl text-xs font-black shadow-md">
                <span>🎲</span> 随机考点 (全考点覆盖)
              </div>
            ) : (
              selectedPoints.map(p => (
                <span key={p} className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-100">
                  {p}
                </span>
              ))
            )}
          </div>
        </section>

        {/* 智能分析回顾 */}
        {hasWrongStats && topWrongPoint && (
          <section className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-5 rounded-3xl shadow-xl text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">📈</div>
            <h3 className="text-xs font-bold opacity-70 mb-2 uppercase tracking-widest">薄弱项预测</h3>
            <p className="text-base font-bold mb-4">你在 <span className="text-yellow-300">#{topWrongPoint}</span> 表现不佳</p>
            <button 
              onClick={() => onStart(count, difficulty, [topWrongPoint])}
              className="w-full bg-white text-indigo-600 py-3 rounded-2xl text-sm font-black transition-all active:scale-95 shadow-lg"
            >
              针对该考点专项提分
            </button>
          </section>
        )}
      </div>

      <footer className="py-8 sticky bottom-0 bg-gray-50/80 backdrop-blur-md">
        <button
          onClick={() => onStart(count, difficulty, selectedPoints)}
          className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black text-xl shadow-xl shadow-indigo-200 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
        >
          <span>🚀</span> 开始智能训练
        </button>
      </footer>

      {/* 考点选择弹窗 */}
      {showPointsModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-t-[40px] p-8 animate-fadeIn shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-gray-900">选择训练范围</h2>
              <button onClick={() => setShowPointsModal(false)} className="text-gray-400 p-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-8 max-h-[50vh] overflow-y-auto pr-2">
              {/* 随机选项 */}
              <button
                onClick={selectRandom}
                className={`col-span-2 p-4 rounded-2xl text-sm font-black border-2 transition-all flex items-center justify-center gap-2 ${
                  selectedPoints.length === 0 
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg' 
                    : 'border-indigo-100 bg-indigo-50 text-indigo-600'
                }`}
              >
                <span>🎲</span> 随机考点 (不限范围)
              </button>

              <div className="col-span-2 border-t border-gray-100 my-2"></div>
              
              {GRAMMAR_POINTS.map(p => (
                <button
                  key={p}
                  onClick={() => togglePoint(p)}
                  className={`p-3.5 rounded-2xl text-xs font-bold border-2 transition-all ${
                    selectedPoints.includes(p) 
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' 
                      : 'border-gray-50 bg-gray-50 text-gray-500'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <button 
              onClick={() => setShowPointsModal(false)}
              className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all"
            >
              确 认
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeView;
