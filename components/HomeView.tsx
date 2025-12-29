import React, { useState } from 'react';
import { UserStats } from '../types';

interface HomeViewProps {
  onStart: (count: number, targeted?: boolean) => void;
  stats: UserStats;
}

const HomeView: React.FC<HomeViewProps> = ({ onStart, stats }) => {
  const [count, setCount] = useState(10);
  const options = [5, 10, 20];
  const hasHistory = Object.keys(stats.wrongCounts).length > 0;

  return (
    <div className="flex-1 flex flex-col p-6 animate-fadeIn">
      <header className="py-10 text-center">
        <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3">
          <span className="text-white text-3xl font-bold">A+</span>
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">高考英语语法通</h1>
        <p className="text-gray-500">无限智能题库 · 即时解析反馈</p>
      </header>

      <main className="flex-1 space-y-6">
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <span className="w-1.5 h-6 bg-indigo-500 rounded-full mr-3"></span>
            训练模式
          </h2>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 mb-4">
              {options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setCount(opt)}
                  className={`py-3 rounded-xl font-medium transition-all text-sm ${
                    count === opt
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-gray-50 text-gray-600 border border-gray-100'
                  }`}
                >
                  {opt} 题
                </button>
              ))}
            </div>
            
            <button
              onClick={() => onStart(count)}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-[0.98] transition-all"
            >
              🚀 开始全考点随机练
            </button>

            {hasHistory && (
              <button
                onClick={() => onStart(count, true)}
                className="w-full bg-orange-50 text-orange-600 py-4 rounded-2xl font-bold text-lg border-2 border-orange-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                🎯 针对弱项强化练习
              </button>
            )}
          </div>
        </section>

        {hasHistory && (
          <section className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-gray-800 font-bold mb-3 text-sm">📊 最近弱项统计</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.wrongCounts)
                // Fix: Ensure the values from Object.entries are treated as numbers for the sort subtraction
                .sort((a, b) => (b[1] as number) - (a[1] as number))
                .slice(0, 4)
                .map(([pt, count]) => (
                  <span key={pt} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-full text-xs font-medium border border-red-100">
                    {pt} (错{count}次)
                  </span>
                ))}
            </div>
          </section>
        )}
      </main>

      <footer className="py-6 safe-area-bottom">
        <p className="text-center text-xs text-gray-400">智能 AI 命题专家为你服务</p>
      </footer>
    </div>
  );
};

export default HomeView;