
import React from 'react';
import { QuizResults } from '../types';

interface ResultViewProps {
  results: QuizResults;
  onRestart: () => void;
  onConsolidate: () => void;
}

const ResultView: React.FC<ResultViewProps> = ({ results, onRestart, onConsolidate }) => {
  const percentage = (results.score / results.total) * 100;
  const hasErrors = results.score < results.total;

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

      {hasErrors && (
        <div className="bg-orange-50 p-6 rounded-2xl border border-orange-200 mb-8">
          <h3 className="text-orange-800 font-bold mb-2 flex items-center gap-2">
            <span>🎯</span> 发现薄弱语法点
          </h3>
          <p className="text-sm text-orange-700 mb-4">
            你在以下考点上出现了失误，建议立即进行巩固练习：
          </p>
          <div className="flex flex-wrap gap-2 mb-6">
            {results.wrongGrammarPoints.map(pt => (
              <span key={pt} className="px-3 py-1 bg-white border border-orange-200 rounded-full text-xs text-orange-600 font-bold">
                {pt}
              </span>
            ))}
          </div>
          <button
            onClick={onConsolidate}
            className="w-full bg-orange-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-orange-100 active:scale-95 transition-all"
          >
            立即出同类题巩固 (新)
          </button>
        </div>
      )}

      <footer className="py-6 safe-area-bottom space-y-3">
        <button
          onClick={onRestart}
          className="w-full bg-white text-indigo-600 border-2 border-indigo-600 py-4 rounded-2xl font-bold text-lg active:scale-95 transition-all"
        >
          返回主页
        </button>
      </footer>
    </div>
  );
};

export default ResultView;
