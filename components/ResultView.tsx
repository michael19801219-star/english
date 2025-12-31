
import React from 'react';
import { QuizResults } from '../types';

interface ResultViewProps {
  results: QuizResults;
  onRestart: () => void;
  onConsolidate: () => void;
}

const ResultView: React.FC<ResultViewProps> = ({ results, onRestart }) => {
  const percentage = (results.score / results.total) * 100;

  return (
    <div className="flex-1 flex flex-col p-6 animate-fadeIn bg-gray-50 min-h-screen overflow-y-auto">
      <header className="py-12 text-center bg-white rounded-3xl shadow-sm border border-gray-100 mb-8 mt-4">
        <div className="text-6xl mb-4">{percentage === 100 ? '🏆' : '💪'}</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">训练完成</h1>
        <div className="text-5xl font-extrabold text-indigo-600 mb-4">
          {results.score}<span className="text-gray-300 text-2xl font-normal">/{results.total}</span>
        </div>
        <p className="text-gray-500 font-medium">{percentage === 100 ? '太棒了！满分通过！' : '继续努力，查漏补缺。'}</p>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-40">
        <div className="text-4xl mb-2">🎓</div>
        <p className="text-xs font-bold text-gray-400">坚持每日训练，语法更上一层楼</p>
      </div>

      <footer className="py-6 safe-area-bottom">
        <button
          onClick={onRestart}
          className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black text-lg shadow-xl shadow-indigo-100 active:scale-95 transition-all"
        >
          返回主页
        </button>
      </footer>
    </div>
  );
};

export default ResultView;
