
import React from 'react';
import { QuizResults } from '../types';

interface ResultViewProps {
  results: QuizResults;
  onRestart: () => void;
  onConsolidate: () => void;
}

const ResultView: React.FC<ResultViewProps> = ({ results, onRestart, onConsolidate }) => {
  const percentage = (results.score / results.total) * 100;
  const hasMistakes = results.wrongGrammarPoints.length > 0;

  return (
    <div className="flex-1 flex flex-col p-6 animate-fadeIn bg-[#FDFCF8] min-h-screen overflow-y-auto">
      <header className="py-12 text-center bg-white rounded-[40px] shadow-sm border border-gray-100 mb-8 mt-4 relative overflow-hidden">
        {/* 背景装饰 */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl opacity-50 -mr-10 -mt-10"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-violet-50 rounded-full blur-3xl opacity-50 -ml-10 -mb-10"></div>
        
        <div className="relative z-10">
          <div className="text-6xl mb-6 transform hover:scale-110 transition-transform duration-500">
            {percentage === 100 ? '🏆' : percentage >= 80 ? '🌟' : '💪'}
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">测试报告完成</h1>
          <div className="text-6xl font-black text-indigo-600 mb-4 tracking-tighter">
            {results.score}<span className="text-gray-300 text-2xl font-normal mx-1">/</span>{results.total}
          </div>
          <div className="inline-block px-6 py-2 bg-indigo-50 rounded-full">
            <p className="text-indigo-600 font-black text-xs uppercase tracking-widest">
              {percentage === 100 ? '完美收官！全对！' : percentage >= 60 ? '表现不错，继续加油' : '别灰心，重点复盘'}
            </p>
          </div>
        </div>
      </header>

      {hasMistakes && (
        <section className="mb-8 animate-fadeIn">
          <h3 className="text-[11px] font-black text-gray-400 mb-4 uppercase tracking-[0.2em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span> 需要巩固的考点
          </h3>
          <div className="flex flex-wrap gap-2">
            {results.wrongGrammarPoints.map(point => (
              <span key={point} className="px-4 py-2.5 bg-white border border-red-100 text-red-600 rounded-2xl text-[13px] font-black shadow-sm">
                #{point}
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-30 grayscale pointer-events-none">
        <div className="text-4xl mb-2">📖</div>
        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">坚持每日训练<br/>让语法逻辑成为本能</p>
      </div>

      <footer className="py-6 safe-area-bottom space-y-4">
        {hasMistakes && (
          <button
            onClick={onConsolidate}
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-5 rounded-[28px] font-black text-lg shadow-xl shadow-indigo-100 active:scale-[0.97] transition-all flex items-center justify-center gap-3 relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            <span className="text-xl">🔥</span>
            <span>针对错题强化训练</span>
          </button>
        )}
        
        <button
          onClick={onRestart}
          className={`w-full py-5 rounded-[28px] font-black text-lg transition-all active:scale-[0.97] ${
            hasMistakes 
              ? 'bg-white border-2 border-gray-100 text-gray-500 shadow-sm' 
              : 'bg-indigo-600 text-white shadow-xl shadow-indigo-100'
          }`}
        >
          {hasMistakes ? '返回主页' : '再来一套测试'}
        </button>
      </footer>
    </div>
  );
};

export default ResultView;
