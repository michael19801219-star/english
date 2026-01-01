
import React, { useState } from 'react';
import { UserStats, Difficulty, GRAMMAR_POINTS } from '../types';

interface HomeViewProps {
  onStart: (count: number, difficulty: Difficulty, points: string[]) => void;
  stats: UserStats;
  onGoToReview: (tab?: 'summary' | 'details' | 'saved') => void;
  isUsingPersonalKey: boolean;
  onOpenQuotaModal: () => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onStart, stats, onGoToReview, isUsingPersonalKey, onOpenQuotaModal }) => {
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
      <div className="absolute top-[-80px] left-[-40px] w-72 h-72 bg-indigo-200 rounded-full blur-[90px] opacity-30 -z-10"></div>
      
      {/* 状态栏图标 - 仅在首页显示 */}
      <div 
        onClick={onOpenQuotaModal}
        className={`mx-auto mb-4 px-3 py-1.5 rounded-full backdrop-blur-md border flex items-center gap-2 cursor-pointer transition-all active:scale-95 w-max ${isUsingPersonalKey ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-white/80 text-gray-500 border-gray-100 shadow-sm'}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isUsingPersonalKey ? 'bg-green-400 animate-pulse' : 'bg-gray-300'}`}></span>
        <span className="text-[10px] font-black uppercase tracking-widest">
          {isUsingPersonalKey ? '个人密钥已激活' : '公共模式 (额度受限)'}
        </span>
        <span className="text-xs">⚙️</span>
      </div>

      <header className="py-8 flex justify-between items-start">
        <div className="flex flex-col">
          <h1 className="text-[30px] font-black text-gray-900 leading-[1.1] tracking-tight">
            高考英语<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600">语法大师</span>
          </h1>
          <div className="mt-4 flex gap-2">
            <div className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full shadow-lg border border-white/30">
              <span className="text-[11px] font-black text-white tracking-[0.08em] uppercase drop-shadow-sm">
                周琮钦专属定制版
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => onGoToReview('saved')}
            className="bg-white/90 backdrop-blur-md p-3.5 rounded-[22px] shadow-sm border border-gray-100 flex flex-col items-center relative active:scale-90 transition-all"
            title="收藏本"
          >
            <span className="text-xl">⭐</span>
            <span className="text-[8px] font-black text-gray-400 mt-1 uppercase tracking-widest">收藏本</span>
            {stats.savedHistory?.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center border border-white font-black">
                {stats.savedHistory.length}
              </span>
            )}
          </button>

          <button 
            onClick={() => onGoToReview('details')}
            className="bg-white/90 backdrop-blur-md p-3.5 rounded-[22px] shadow-sm border border-gray-100 flex flex-col items-center relative active:scale-90 transition-all"
          >
            <span className="text-xl">📕</span>
            <span className="text-[8px] font-black text-gray-400 mt-1 uppercase tracking-widest">错题集</span>
            {stats.wrongHistory.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center border border-white font-black">
                {stats.wrongHistory.length}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="space-y-8 flex-1">
        <section className="bg-white/70 backdrop-blur-sm p-6 rounded-[36px] shadow-sm border border-white">
          <h3 className="text-[11px] font-black text-gray-400 mb-5 uppercase tracking-[0.2em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full shadow-sm shadow-indigo-200"></span> 训练题量
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {[5, 10, 20, 30].map(c => (
              <button key={c} onClick={() => setCount(c)} className={`py-3.5 rounded-[20px] text-sm font-black transition-all ${count === c ? 'bg-indigo-600 text-white shadow-lg scale-[1.05]' : 'bg-gray-100/50 text-gray-400'}`}>{c}</button>
            ))}
          </div>
        </section>

        <section className="bg-white/70 backdrop-blur-sm p-6 rounded-[36px] shadow-sm border border-white">
          <h3 className="text-[11px] font-black text-gray-400 mb-5 uppercase tracking-[0.2em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-violet-400 rounded-full shadow-sm shadow-violet-200"></span> 难度等级
          </h3>
          <div className="flex bg-gray-100/50 p-1.5 rounded-[24px] gap-1 overflow-x-auto no-scrollbar">
            {(['简单', '中等', '较难', '随机'] as Difficulty[]).map(d => (
              <button key={d} onClick={() => setDifficulty(d)} className={`flex-1 py-3.5 px-4 rounded-[18px] text-sm font-black transition-all ${difficulty === d ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 opacity-60'}`}>{d}</button>
            ))}
          </div>
        </section>

        <section className="bg-white/70 backdrop-blur-sm p-6 rounded-[36px] shadow-sm border border-white">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full shadow-sm shadow-indigo-200"></span> 考点专项
            </h3>
            <button onClick={() => setIsModalOpen(true)} className="text-[10px] font-black text-indigo-600 px-4 py-2 bg-indigo-50 rounded-xl active:scale-95 transition-transform border border-indigo-100/50">修改考点</button>
          </div>
          <div className="p-5 bg-white/50 rounded-[28px] border border-dashed border-gray-200 min-h-[80px] flex items-center">
            {selectedPoints.length === 0 ? (
              <span className="text-[13px] font-bold italic tracking-tight opacity-70 text-gray-400">全真模拟：智能分发核心考点</span>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedPoints.map(p => <span key={p} className="px-3.5 py-2 bg-white border border-indigo-50 text-indigo-600 rounded-2xl text-[11px] font-black shadow-sm">#{p}</span>)}
              </div>
            )}
          </div>
        </section>

        {hasWrongStats && topWrongPoint && (
          <section className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-700 p-8 rounded-[42px] shadow-2xl text-white relative overflow-hidden group">
            <div className="relative z-10">
              <h3 className="text-xl font-bold mb-6 leading-tight">你的 <span className="text-yellow-300 font-black underline underline-offset-8 decoration-yellow-300/40">#{topWrongPoint}</span><br/>是目前的薄弱环节</h3>
              <button onClick={() => onStart(count, difficulty, [topWrongPoint])} className="w-full bg-white text-indigo-700 py-4.5 rounded-[22px] text-[15px] font-black transition-all active:scale-95 shadow-xl">启动针对性突破</button>
            </div>
          </section>
        )}
      </div>

      <footer className="py-8 sticky bottom-0 bg-gray-50/95 backdrop-blur-xl z-20">
        <button onClick={() => onStart(count, difficulty, selectedPoints)} className="w-full bg-indigo-600 text-white py-5 rounded-[30px] font-black text-xl shadow-xl active:scale-[0.97] transition-all flex items-center justify-center gap-4">
          <span className="text-2xl">🚀</span> <span className="tracking-tight">开始{selectedPoints.length === 0 ? '智能' : '专项'}训练</span>
        </button>
      </footer>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-white animate-fadeIn">
          <header className="p-8 border-b border-gray-50 flex justify-between items-center">
            <h2 className="text-[26px] font-black text-gray-900 tracking-tight">配置训练考点</h2>
            <button onClick={() => setIsModalOpen(false)} className="w-14 h-14 bg-gray-50 rounded-[22px] flex items-center justify-center text-gray-400 active:scale-90 transition-all border border-gray-100">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </header>
          <div className="flex-1 overflow-y-auto p-8 pt-4 grid grid-cols-2 gap-4">
            {GRAMMAR_POINTS.map(point => (
              <button key={point} onClick={() => togglePoint(point)} className={`p-6 rounded-[28px] text-[15px] font-black border-2 transition-all text-left ${selectedPoints.includes(point) ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl' : 'bg-white border-gray-100 text-gray-500'}`}>{point}</button>
            ))}
          </div>
          <footer className="p-8 border-t border-gray-50 bg-white/80 backdrop-blur-md">
            <button onClick={() => setIsModalOpen(false)} className="w-full bg-gray-900 text-white py-5 rounded-[26px] font-black text-lg shadow-2xl active:scale-95 transition-all">完成配置</button>
          </footer>
        </div>
      )}
    </div>
  );
};

export default HomeView;
