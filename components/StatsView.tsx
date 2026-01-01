
import React from 'react';
import { UserStats, GRAMMAR_POINTS } from '../types';

interface StatsViewProps {
  stats: UserStats;
  onBack: () => void;
}

const StatsView: React.FC<StatsViewProps> = ({ stats, onBack }) => {
  const accuracy = stats.totalAnswered > 0 
    ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100) 
    : 0;

  // 获取最近 7 天数据
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('zh-CN', { weekday: 'short' });
    return { dateStr, label, count: stats.dailyProgress[dateStr] || 0 };
  });

  const maxDailyCount = Math.max(...last7Days.map(d => d.count), 1);

  // 精准掌握度计算
  const masteryData = GRAMMAR_POINTS.map(point => {
    const attempts = stats.pointAttempts?.[point] || 0;
    const errors = stats.wrongCounts[point] || 0;
    
    let mastery = 0;
    let isTested = attempts > 0;
    
    if (isTested) {
      mastery = Math.round(((attempts - errors) / attempts) * 100);
      mastery = Math.max(0, Math.min(100, mastery)); // 确保在0-100之间
    }
    
    return { point, mastery, isTested, attempts };
  }).sort((a, b) => {
    // 排序逻辑：
    // 1. 已练习的考点排在前面
    // 2. 在已练习考点中，掌握度低的排在前面（需要优先攻克）
    if (a.isTested && !b.isTested) return -1;
    if (!a.isTested && b.isTested) return 1;
    return a.mastery - b.mastery;
  });

  return (
    <div className="flex-1 flex flex-col bg-[#FDFCF8] min-h-screen overflow-y-auto pb-20 no-scrollbar">
      <header className="sticky top-0 p-6 bg-white/80 backdrop-blur-lg z-10 border-b border-gray-50 flex items-center gap-4">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 active:scale-90 transition-all">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <h1 className="text-xl font-black text-gray-900 tracking-tight">学习成就洞察</h1>
      </header>

      <main className="p-6 space-y-6 animate-fadeIn">
        {/* 核心看板 */}
        <section className="grid grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-50">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">累计答题</span>
            <div className="text-3xl font-black text-gray-900">{stats.totalAnswered} <span className="text-xs text-gray-300 font-bold uppercase">道</span></div>
          </div>
          <div className="bg-indigo-600 p-6 rounded-[32px] shadow-xl shadow-indigo-100 text-white">
            <span className="text-[10px] font-black text-indigo-200 uppercase tracking-widest block mb-1">综合正确率</span>
            <div className="text-3xl font-black">{accuracy}%</div>
          </div>
        </section>

        {/* 柱状图：最近活跃 */}
        <section className="bg-white p-6 rounded-[40px] shadow-sm border border-gray-50">
          <h3 className="text-[11px] font-black text-gray-400 mb-8 uppercase tracking-[0.2em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span> 最近 7 天练习趋势
          </h3>
          <div className="flex items-end justify-between h-32 gap-2 px-2">
            {last7Days.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="w-full relative flex items-end justify-center h-full">
                  <div 
                    className={`w-full rounded-t-xl transition-all duration-700 ${d.count > 0 ? 'bg-indigo-500 shadow-lg shadow-indigo-50' : 'bg-gray-50'}`}
                    style={{ height: `${(d.count / maxDailyCount) * 100}%`, minHeight: d.count > 0 ? '4px' : '0px' }}
                  >
                    {d.count > 0 && (
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] font-black px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        {d.count}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-bold text-gray-300">{d.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 掌握度列表 */}
        <section className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-50">
          <h3 className="text-[11px] font-black text-gray-400 mb-6 uppercase tracking-[0.2em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span> 语法考点掌握度榜单
          </h3>
          <div className="space-y-6">
            {masteryData.map((item, i) => (
              <div key={i} className={`space-y-2 transition-opacity ${item.isTested ? 'opacity-100' : 'opacity-40'}`}>
                <div className="flex justify-between items-center px-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-black ${!item.isTested ? 'text-gray-400' : item.mastery < 60 ? 'text-red-600' : 'text-gray-700'}`}>
                      {item.point}
                    </span>
                    {item.isTested && <span className="text-[8px] bg-gray-50 text-gray-400 px-1.5 py-0.5 rounded-md font-bold">试题x{item.attempts}</span>}
                  </div>
                  <span className="text-[10px] font-mono font-black text-gray-400">
                    {item.isTested ? `${item.mastery}%` : '未练习'}
                  </span>
                </div>
                <div className="h-2 bg-gray-50 rounded-full overflow-hidden shadow-inner">
                  {item.isTested && (
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${item.mastery < 60 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' : item.mastery < 85 ? 'bg-amber-400' : 'bg-green-400'}`}
                      style={{ width: `${item.mastery}%` }}
                    ></div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!stats.totalAnswered && (
            <div className="mt-8 p-4 bg-indigo-50 rounded-2xl text-center">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">完成一次训练即可开启精准分析</p>
            </div>
          )}
        </section>

        <section className="py-10 text-center opacity-20">
          <div className="text-4xl mb-2">🏔️</div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            每攻克一个薄弱考点<br/>离理想大学就更近一步
          </p>
        </section>
      </main>
    </div>
  );
};

export default StatsView;
