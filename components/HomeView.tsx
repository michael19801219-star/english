
import React, { useState, useEffect } from 'react';
import { UserStats, Difficulty, GRAMMAR_POINTS } from '../types';
import { generateSyncId, uploadToCloud, downloadFromCloud } from '../services/syncService';

interface HomeViewProps {
  onStart: (count: number, difficulty: Difficulty, points: string[]) => void;
  stats: UserStats;
  onGoToReview: (tab?: 'summary' | 'details' | 'saved') => void;
  onUpdateStats: (newStats: UserStats) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onStart, stats, onGoToReview, onUpdateStats }) => {
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty>('中等');
  const [selectedPoints, setSelectedPoints] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [syncIdInput, setSyncIdInput] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  
  const [downloadConfirm, setDownloadConfirm] = useState<{ isOpen: boolean; data: UserStats | null }>({ isOpen: false, data: null });

  const togglePoint = (point: string) => {
    setSelectedPoints(prev => 
      prev.includes(point) 
        ? prev.filter(p => p !== point) 
        : [...prev, point]
    );
  };

  const handleCreateSync = async () => {
    setIsSyncing(true);
    setSyncStatus('idle');
    setErrorMsg('');
    const newId = generateSyncId();
    const initialStats = { ...stats, syncId: newId };
    
    try {
      const time = await uploadToCloud(newId, initialStats);
      onUpdateStats({ ...initialStats, lastSyncTime: time });
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (e: any) {
      // 记录ID即使上传失败，用户可以后续再试
      onUpdateStats(initialStats);
      setSyncStatus('error');
      setErrorMsg(e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpload = async () => {
    if (!stats.syncId) return;
    setIsSyncing(true);
    setSyncStatus('idle');
    setErrorMsg('');
    try {
      const time = await uploadToCloud(stats.syncId, stats);
      onUpdateStats({ ...stats, lastSyncTime: time });
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (e: any) {
      setSyncStatus('error');
      setErrorMsg(e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFetchRemote = async () => {
    const code = syncIdInput.trim().toUpperCase();
    if (code.length < 6) {
      setSyncStatus('error');
      setErrorMsg("请输入完整的6位同步码");
      return;
    }
    
    setIsSyncing(true);
    setSyncStatus('idle');
    setErrorMsg('');
    try {
      const remoteData = await downloadFromCloud(code);
      if (remoteData) {
        setDownloadConfirm({ isOpen: true, data: remoteData });
      } else {
        setSyncStatus('error');
        setErrorMsg("此代码对应的云端存档不存在");
      }
    } catch (e: any) {
      setSyncStatus('error');
      setErrorMsg(e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const executeDownload = () => {
    if (downloadConfirm.data) {
      const code = syncIdInput.trim().toUpperCase();
      onUpdateStats({ ...downloadConfirm.data, syncId: code });
      setSyncStatus('success');
      setSyncIdInput('');
      setDownloadConfirm({ isOpen: false, data: null });
      setTimeout(() => {
        setIsSyncOpen(false);
        setSyncStatus('idle');
      }, 1500);
    }
  };

  const sortedWrongEntries = Object.entries(stats.wrongCounts).sort((a, b) => (b[1] as number) - (a[1] as number));
  const hasWrongStats = sortedWrongEntries.length > 0;
  const topWrongPoint = hasWrongStats ? sortedWrongEntries[0][0] : null;

  return (
    <div className="flex-1 flex flex-col bg-gray-50 animate-fadeIn relative">
      <div className="absolute top-[-80px] left-[-40px] w-72 h-72 bg-indigo-200 rounded-full blur-[90px] opacity-30 -z-10"></div>
      
      <div className="flex-1 overflow-y-auto px-6 pb-40 no-scrollbar">
        <header className="py-8 flex justify-between items-start">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-tighter">周琮钦专属定制版</span>
            </div>
            <h1 className="text-[30px] font-black text-gray-900 leading-[1.1] tracking-tight">
              英语语法<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600">通关大师</span>
            </h1>
            <div className="mt-4 flex gap-2">
              <button 
                onClick={() => { setIsSyncOpen(true); setSyncStatus('idle'); setErrorMsg(''); }}
                className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full shadow-sm border border-gray-100 active:scale-95 transition-all"
              >
                <span className="text-xs font-medium text-gray-600">{stats.syncId ? `☁️ 代码: ${stats.syncId}` : '☁️ 开启同步'}</span>
                <div className={`w-2 h-2 rounded-full ${stats.syncId ? 'bg-green-500' : 'bg-gray-300 animate-pulse'}`}></div>
              </button>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button onClick={() => onGoToReview('saved')} className="bg-white p-3 rounded-[20px] shadow-sm border border-gray-100 flex flex-col items-center relative active:scale-90 transition-all">
              <span className="text-xl">⭐</span>
              <span className="text-[8px] font-black text-gray-400 mt-1 uppercase tracking-tighter">收藏本</span>
              {stats.savedHistory.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border-2 border-white shadow-sm">{stats.savedHistory.length}</span>
              )}
            </button>
            <button onClick={() => onGoToReview('details')} className="bg-white p-3 rounded-[20px] shadow-sm border border-gray-100 flex flex-col items-center relative active:scale-90 transition-all">
              <span className="text-xl">📕</span>
              <span className="text-[8px] font-black text-gray-400 mt-1 uppercase tracking-tighter">错题集</span>
              {stats.wrongHistory.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border-2 border-white shadow-sm">{stats.wrongHistory.length}</span>
              )}
            </button>
          </div>
        </header>

        <div className="space-y-8">
          <section className="bg-white/70 backdrop-blur-sm p-6 rounded-[36px] shadow-sm border border-white">
            <h3 className="text-[11px] font-black text-gray-400 mb-5 uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span> 训练题量
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {[5, 10, 20, 30].map(c => (
                <button key={c} onClick={() => setCount(c)} className={`py-3.5 rounded-[20px] text-sm font-black transition-all ${count === c ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'bg-white/80 text-gray-400 border border-gray-100'}`}>{c}</button>
              ))}
            </div>
          </section>

          <section className="bg-white/70 backdrop-blur-sm p-6 rounded-[36px] shadow-sm border border-white">
            <h3 className="text-[11px] font-black text-gray-400 mb-5 uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full"></span> 难度等级
            </h3>
            <div className="flex bg-gray-100/50 p-1.5 rounded-[24px] gap-1 overflow-x-auto no-scrollbar">
              {(['简单', '中等', '较难', '随机'] as Difficulty[]).map(d => (
                <button key={d} onClick={() => setDifficulty(d)} className={`flex-1 py-3.5 px-4 rounded-[18px] text-sm font-black transition-all ${difficulty === d ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-400 opacity-60'}`}>{d}</button>
              ))}
            </div>
          </section>

          <section className="bg-white/70 backdrop-blur-sm p-6 rounded-[36px] shadow-sm border border-white">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span> 考点专项
              </h3>
              <button onClick={() => setIsModalOpen(true)} className="text-[10px] font-black text-indigo-600 px-4 py-2 bg-indigo-50 rounded-xl active:scale-95 transition-transform">修改</button>
            </div>
            <div className="p-5 bg-white/50 rounded-[28px] border border-dashed border-gray-200 flex flex-wrap gap-2">
              {selectedPoints.length === 0 ? (
                <span className="text-[13px] text-gray-400 italic">智能混练：全考点覆盖</span>
              ) : (
                selectedPoints.map(p => <span key={p} className="px-3.5 py-2 bg-white border border-indigo-50 text-indigo-600 rounded-2xl text-[11px] font-black shadow-sm">#{p}</span>)
              )}
            </div>
          </section>

          {hasWrongStats && topWrongPoint && (
            <section className="bg-gradient-to-br from-indigo-700 to-violet-700 p-8 rounded-[42px] shadow-2xl text-white relative overflow-hidden group">
              <div className="absolute top-[-20px] right-[-20px] w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
              <h3 className="text-xl font-bold mb-6 leading-tight relative z-10">针对您的薄弱考点 <span className="text-yellow-300 font-black">#{topWrongPoint}</span> 开启突破？</h3>
              <button onClick={() => onStart(count, difficulty, [topWrongPoint])} className="w-full bg-white text-indigo-700 py-4.5 rounded-[22px] text-[15px] font-black transition-all active:scale-95 shadow-xl relative z-10">立即突破</button>
            </section>
          )}
        </div>
      </div>

      <footer className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none">
        <div className="h-24 bg-gradient-to-t from-gray-50 via-gray-50/90 to-transparent"></div>
        <div className="bg-gray-50/95 backdrop-blur-xl px-6 pb-10 pt-2 border-t border-gray-100/50 pointer-events-auto shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
          <button 
            onClick={() => onStart(count, difficulty, selectedPoints)} 
            className="w-full bg-indigo-600 text-white py-5 rounded-[30px] font-black text-xl shadow-[0_15px_35px_rgba(79,70,229,0.3)] active:scale-[0.97] transition-all flex items-center justify-center gap-4 group"
          >
            <span className="text-2xl group-active:rotate-12 transition-transform">🚀</span> 
            <span>开始训练</span>
          </button>
        </div>
      </footer>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end justify-center p-4 animate-fadeIn" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-fadeIn" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-gray-900 tracking-tight">考点选择</h3>
              <button onClick={() => setSelectedPoints([])} className="text-[11px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl active:scale-90 transition-all">重置</button>
            </div>
            <div className="grid grid-cols-2 gap-3 max-h-[350px] overflow-y-auto no-scrollbar mb-8">
              {GRAMMAR_POINTS.map(point => (
                <button 
                  key={point} 
                  onClick={() => togglePoint(point)} 
                  className={`p-4 rounded-[22px] text-[12px] font-black transition-all border-2 text-center ${selectedPoints.includes(point) ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-gray-50 border-transparent text-gray-500 hover:bg-white hover:border-indigo-100'}`}
                >
                  {point}
                </button>
              ))}
            </div>
            <button onClick={() => setIsModalOpen(false)} className="w-full py-4.5 bg-gray-900 text-white rounded-[24px] font-black shadow-xl active:scale-95 transition-all">确定修改</button>
          </div>
        </div>
      )}

      {isSyncOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn" onClick={() => setIsSyncOpen(false)}>
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-black text-gray-900">云同步专家</h3>
              <button onClick={() => setIsSyncOpen(false)} className="text-gray-300">✕</button>
            </div>
            <p className="text-[11px] text-gray-400 mb-6 font-medium leading-relaxed">如果同步失败，请尝试**切换为流量(5G)并关闭 WiFi** 后再次操作。</p>
            
            <div className="space-y-6">
              {stats.syncId ? (
                <div className="p-5 bg-indigo-50/50 rounded-[24px] border border-indigo-100/50 text-center">
                   <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">当前同步码（请记下）</p>
                   <p className="text-3xl font-black text-indigo-600 tracking-widest mb-3">{stats.syncId}</p>
                   <button 
                    disabled={isSyncing}
                    onClick={handleUpload} 
                    className={`w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${isSyncing ? 'opacity-50' : ''}`}
                   >
                     {isSyncing ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : '📤'}
                     {isSyncing ? '连接中...' : '备份记录到云端'}
                   </button>
                </div>
              ) : (
                <button 
                  disabled={isSyncing}
                  onClick={handleCreateSync}
                  className={`w-full py-4.5 bg-indigo-600 text-white rounded-2xl font-black shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${isSyncing ? 'opacity-50' : ''}`}
                >
                  {isSyncing ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : '🚀'}
                  开启云端存储
                </button>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
                <div className="relative flex justify-center text-[10px] uppercase font-black text-gray-300 bg-white px-2">同步已有存档</div>
              </div>

              <div className="space-y-3">
                <input 
                  type="text" 
                  placeholder="输入6位代码" 
                  value={syncIdInput}
                  maxLength={6}
                  onChange={e => setSyncIdInput(e.target.value.toUpperCase())}
                  className="w-full p-4 bg-gray-50 rounded-2xl text-center font-black text-gray-700 border-none focus:ring-2 focus:ring-indigo-500/20 uppercase tracking-[0.3em]"
                />
                <button 
                  disabled={isSyncing || syncIdInput.length < 6}
                  onClick={handleFetchRemote}
                  className={`w-full py-3.5 bg-gray-900 text-white rounded-2xl font-black active:scale-95 transition-all flex items-center justify-center gap-2 ${isSyncing || syncIdInput.length < 6 ? 'opacity-30' : ''}`}
                >
                  {isSyncing ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : '📥'}
                  下载云端数据
                </button>
              </div>
            </div>
            
            {syncStatus === 'success' && <p className="text-center text-[10px] text-green-500 font-black mt-4 animate-bounce">✨ 成功！数据已更新</p>}
            {syncStatus === 'error' && (
              <div className="mt-4 p-4 bg-red-50 rounded-[20px] border border-red-100">
                <p className="text-center text-[10px] text-red-600 font-black">❌ 同步受限</p>
                <p className="text-center text-[9px] text-red-400 mt-2 font-medium leading-relaxed">
                  检测到连接失败。建议：<br/>
                  1. 关闭手机 WiFi 切换到 5G 流量<br/>
                  2. 确认未开启任何 VPN 或广告过滤
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {downloadConfirm.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-fadeIn">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">☁️</div>
              <h3 className="text-xl font-black text-gray-900">同步至本机？</h3>
              <p className="text-xs text-gray-400 mt-2 font-medium leading-relaxed">
                发现云端存档：{downloadConfirm.data?.wrongHistory.length} 错题 / {downloadConfirm.data?.savedHistory.length} 收藏。<br/>
                <span className="text-red-500 font-bold underline">注意：下载将覆盖您手机上的当前记录！</span>
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button 
                onClick={executeDownload} 
                className="w-full py-4.5 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 active:scale-95 transition-all"
              >
                覆盖并同步
              </button>
              <button 
                onClick={() => setDownloadConfirm({ isOpen: false, data: null })} 
                className="w-full py-4.5 bg-gray-50 text-gray-500 rounded-2xl font-bold active:scale-95 transition-all"
              >
                点错了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeView;
