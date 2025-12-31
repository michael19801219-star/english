
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
  const [isModalOpen, setIsModalOpen] = useState(false);

  const togglePoint = (point: string) => {
    setSelectedPoints(prev => 
      prev.includes(point) 
        ? prev.filter(p => p !== point) 
        : [...prev, point]
    );
  };

  const sortedWrongEntries = Object.entries(stats.wrongCounts).sort((a, b) => (b[1] as number) - (a[1] as number));
  const hasWrongStats = sortedWrongEntries.length > 0;
  const topWrongPoint = hasWrongStats ? sortedWrongEntries[0][0] : null;

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto animate-fadeIn pb-10 relative">
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

        {/* 考点专项选择 - 下拉展示形式 */}
        <section className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <span>🎯</span> 考点专项
            </h3>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="text-xs font-black text-indigo-600 px-3 py-1.5 bg-indigo-50 rounded-xl active:scale-95 transition-transform"
            >
              修改配置
            </button>
          </div>
          <div className="p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 min-h-[60px]">
            {selectedPoints.length === 0 ? (
              <div className="flex items-center gap-2 text-gray-400">
                <span className="text-lg">🎲</span>
                <span className="text-xs font-bold italic">智能全考点随机分布 (推荐)</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedPoints.map(p => (
                  <span key={p} className="px-2.5 py-1 bg-white border border-indigo-100 text-indigo-600 rounded-lg text-[10px] font-black">
                    #{p}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 智能分析 */}
        {hasWrongStats && topWrongPoint && (
          <section className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-5 rounded-3xl shadow-xl text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">📈</div>
            <h3 className="text-xs font-bold opacity-70 mb-2 uppercase tracking-widest">薄弱项预测</h3>
            <p className="text-base font-bold mb-4">你在 <span className="text-yellow-300">#{topWrongPoint}</span> 表现不佳</p>
            <button 
              onClick={() => onStart(count, difficulty, [topWrongPoint])}
              className="w-full bg-white text-indigo-600 py-3 rounded-2xl text-sm font-black transition-all active:scale-95 shadow-lg"
            >
              进行针对性提分
            </button>
          </section>
        )}
      </div>

      <footer className="py-8 sticky bottom-0 bg-gray-50/80 backdrop-blur-md z-10">
        <button
          onClick={() => onStart(count, difficulty, selectedPoints)}
          className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black text-xl shadow-xl shadow-indigo-200 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
        >
          <span>🚀</span> 开始 {selectedPoints.length === 0 ? '智能' : '专项'} 训练
        </button>
      </footer>

      {/* 考点选择 Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white animate-fadeIn">
          <header className="p-6 border-b border-gray-50 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-black text-gray-900">选择考点</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">GAOKAO SYLLABUS</p>
            </div>
            <button 
              onClick={() => setIsModalOpen(false)}
              className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-400"
            >
              关闭
            </button>
          </header>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-6 p-4 bg-indigo-50 rounded-2xl text-indigo-700 text-xs font-medium border border-indigo-100">
              提示：不勾选任何考点即视为“全考点随机模拟”。您可以多选。
            </div>
            <div className="grid grid-cols-2 gap-3">
              {GRAMMAR_POINTS.map(point => (
                <button
                  key={point}
                  onClick={() => togglePoint(point)}
                  className={`p-4 rounded-2xl text-xs font-black border transition-all text-left relative overflow-hidden ${
                    selectedPoints.includes(point)
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg'
                      : 'bg-white border-gray-100 text-gray-500'
                  }`}
                >
                  {point}
                  {selectedPoints.includes(point) && (
                    <div className="absolute -top-1 -right-1 opacity-20 text-3xl">✓</div>
                  )}
                </button>
              ))}
            </div>
          </div>
          <footer className="p-6 border-t border-gray-50">
            <button
              onClick={() => setIsModalOpen(false)}
              className="w-full bg-gray-900 text-white py-4.5 rounded-2xl font-black text-lg shadow-xl"
            >
              确定修改
            </button>
          </footer>
        </div>
      )}
    </div>
  );
};

export default HomeView;
