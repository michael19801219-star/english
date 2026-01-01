
import React, { useState } from 'react';
import { UserStats, Difficulty, GRAMMAR_POINTS } from '../types';
import { getManualBackupCode, importFromManualCode } from '../services/syncService';

interface HomeViewProps {
  onStart: (count: number, difficulty: Difficulty, points: string[]) => void;
  stats: UserStats;
  onGoToReview: (tab?: 'summary' | 'details' | 'saved') => void;
  onGoToStats: () => void;
  onUpdateStats: (newStats: UserStats) => void;
  apiKeyReady: boolean;
  apiInfo: {
    fingerprint: string;
    uid: string;
    isPlaceholder: boolean;
    lastUpdate: string;
  };
  onSelectKey: () => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onStart, stats, onGoToReview, onGoToStats, onUpdateStats, apiKeyReady, apiInfo, onSelectKey }) => {
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty>('中等');
  const [selectedPoints, setSelectedPoints] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isApiStatusOpen, setIsApiStatusOpen] = useState(false);
  
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [downloadConfirm, setDownloadConfirm] = useState<{ isOpen: boolean; data: UserStats | null }>({ isOpen: false, data: null });

  const togglePoint = (point: string) => {
    setSelectedPoints(prev => prev.includes(point) ? prev.filter(p => p !== point) : [...prev, point]);
  };

  const handleManualExport = () => {
    const code = getManualBackupCode(stats);
    setManualCode(code);
    navigator.clipboard.writeText(code).then(() => {
      alert("✅ 备份代码已成功复制！\n请通过微信发送给另一台手机粘贴。");
    });
  };

  const handleManualImport = () => {
    const data = importFromManualCode(manualCode);
    if (data) {
      setDownloadConfirm({ isOpen: true, data: data });
    } else {
      alert("❌ 备份代码格式无效。");
    }
  };

  const executeDownload = () => {
    if (downloadConfirm.data) {
      onUpdateStats(downloadConfirm.data);
      setDownloadConfirm({ isOpen: false, data: null });
      setIsSyncOpen(false);
      alert("🎉 离线数据迁移完成！");
    }
  };

  const topWrongPoints = Object.entries(stats.wrongCounts || {})
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 3)
    .map(entry => entry[0]);

  return (
    <div className="flex-1 flex flex-col bg-gray-50 animate-fadeIn h-full overflow-hidden">
      <div className="absolute top-[-80px] left-[-40px] w-72 h-72 bg-indigo-200 rounded-full blur-[90px] opacity-30 -z-10"></div>
      
      <div className="flex-1 overflow-y-auto px-6 no-scrollbar pb-10">
        <header className="py-8 flex justify-between items-start">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md uppercase">周琮钦专属定制版</span>
              <button 
                onClick={() => setIsApiStatusOpen(true)}
                className={`w-6 h-6 flex items-center justify-center rounded-full transition-all ${apiKeyReady && !apiInfo.isPlaceholder ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600 animate-pulse'}`}
              >
                <span className="text-[10px]">{apiKeyReady && !apiInfo.isPlaceholder ? '✅' : '⚠️'}</span>
              </button>
            </div>
            <h1 className="text-[30px] font-black text-gray-900 leading-[1.1]">英语语法<br/><span className="text-indigo-600">通关大师</span></h1>
          </div>
          <div className="flex gap-2">
            <button onClick={onGoToStats} className="bg-white p-3 rounded-[20px] shadow-sm border border-gray-100 flex flex-col items-center active:scale-90 transition-all">
              <span className="text-xl">📊</span>
              <span className="text-[8px] font-black text-gray-400 mt-1 uppercase">统计</span>
            </button>
            <button onClick={() => onGoToReview('details')} className="bg-white p-3 rounded-[20px] shadow-sm border border-gray-100 flex flex-col items-center active:scale-90 transition-all">
              <span className="text-xl">📕</span>
              <span className="text-[8px] font-black text-gray-400 mt-1 uppercase">错题</span>
            </button>
          </div>
        </header>

        <div className="space-y-6">
           {topWrongPoints.length > 0 && (
             <section className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-[32px] shadow-lg shadow-indigo-100 relative overflow-hidden group">
               <div className="relative z-10">
                 <h3 className="text-white font-black text-lg mb-1 tracking-tight">薄弱环节专项突破</h3>
                 <p className="text-indigo-100 text-[10px] opacity-80 mb-4">AI 已为您锁定高频失分点</p>
                 <div className="flex flex-wrap gap-2 mb-6">
                   {topWrongPoints.map(p => (
                     <span key={p} className="px-2.5 py-1 bg-white/20 backdrop-blur-md rounded-lg text-[10px] text-white font-bold border border-white/10">#{p}</span>
                   ))}
                 </div>
                 <button 
                  onClick={() => onStart(count, difficulty, topWrongPoints)}
                  className="w-full py-3.5 bg-white text-indigo-600 rounded-2xl font-black text-sm active:scale-95 transition-all"
                 >
                   立即开启针对性训练
                 </button>
               </div>
             </section>
           )}

           <section className="bg-white/80 backdrop-blur-md p-6 rounded-[32px] border border-white shadow-sm">
             <h3 className="text-[11px] font-black text-gray-400 mb-4 uppercase tracking-widest">练习题量</h3>
             <div className="grid grid-cols-4 gap-2">
               {[5, 10, 20, 30].map(c => (
                 <button key={c} onClick={() => setCount(c)} className={`py-3 rounded-2xl text-sm font-black transition-all ${count === c ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-50 text-gray-400 border border-transparent'}`}>{c}</button>
               ))}
             </div>
           </section>

           <section className="bg-white/80 backdrop-blur-md p-6 rounded-[32px] border border-white shadow-sm">
             <h3 className="text-[11px] font-black text-gray-400 mb-4 uppercase tracking-widest">考点范围</h3>
             <div className="flex flex-wrap gap-1.5 min-h-[40px] mb-4">
               {selectedPoints.length === 0 ? <span className="text-xs text-gray-300 italic">全考点混合随机出题</span> : selectedPoints.map(p => <span key={p} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold">#{p}</span>)}
             </div>
             <button onClick={() => setIsModalOpen(true)} className="w-full py-3 border-2 border-indigo-50 text-indigo-600 rounded-xl text-xs font-black active:bg-indigo-50">点击配置考点</button>
           </section>
        </div>
      </div>

      {isApiStatusOpen && (
        <div className="fixed inset-0 z-[600] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setIsApiStatusOpen(false)}>
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-fadeIn overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl shadow-lg transition-colors ${apiInfo.isPlaceholder ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
                {apiInfo.isPlaceholder ? '⚠️' : 'Ready'}
              </div>
              <h3 className="text-lg font-black text-gray-900">API 连接状态</h3>
              <p className="text-[10px] text-gray-400 mt-1">若指纹没变，请点击下方重联按钮</p>
            </div>
            
            <div className="space-y-3 mb-8">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">项目 ID</span>
                <span className={`text-xs font-black px-2 py-1 rounded ${apiInfo.isPlaceholder ? 'bg-gray-200 text-gray-600' : 'bg-indigo-600 text-white'}`}>
                  {apiInfo.uid}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">API 摘要 (Key)</span>
                <span className="text-xs font-mono font-bold text-gray-800">
                  {apiInfo.fingerprint}
                </span>
              </div>

              <div className={`p-4 rounded-xl border flex flex-col gap-2 ${apiInfo.isPlaceholder ? 'bg-amber-50 border-amber-100' : 'bg-green-50 border-green-100'}`}>
                <p className="text-[10px] font-bold">
                  {apiInfo.isPlaceholder ? '💡 提示：当前未关联您的个人项目。请点击下方重试按钮，并确保在对话框中勾选了一个项目。' : '✨ 连接正常！当前的 API 已生效。'}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button 
                onClick={() => {
                  onSelectKey();
                  setIsApiStatusOpen(false);
                }}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black shadow-lg active:scale-95 transition-all text-sm"
              >
                🔄 强制重选项目 (推荐)
              </button>
              <button onClick={() => setIsApiStatusOpen(false)} className="w-full py-3.5 bg-gray-100 text-gray-500 rounded-2xl font-bold text-sm">关闭</button>
            </div>
            
            <p className="text-center text-[8px] text-gray-300 mt-6 font-bold uppercase tracking-widest">
              Last Refresh: {apiInfo.lastUpdate}
            </p>
          </div>
        </div>
      )}

      <footer className="p-6 bg-white border-t border-gray-100 safe-area-bottom shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.05)]">
        <button onClick={() => onStart(count, difficulty, selectedPoints)} className="w-full bg-indigo-600 text-white py-5 rounded-[28px] font-black text-lg shadow-xl active:scale-95 transition-all">🚀 启动练习</button>
      </footer>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end justify-center p-4" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
             <h3 className="text-xl font-black mb-6">配置考点</h3>
             <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto no-scrollbar mb-8">
               {GRAMMAR_POINTS.map(p => (
                 <button key={p} onClick={() => togglePoint(p)} className={`p-4 rounded-2xl text-[11px] font-black border-2 transition-all ${selectedPoints.includes(p) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-gray-50 border-transparent text-gray-400'}`}>{p}</button>
               ))}
             </div>
             <button onClick={() => setIsModalOpen(false)} className="w-full py-4 bg-gray-900 text-white rounded-[20px] font-black">完成</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeView;
