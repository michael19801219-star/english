
import React, { useState } from 'react';

interface HomeViewProps {
  onStart: (count: number) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onStart }) => {
  const [count, setCount] = useState(10);
  const options = [5, 10, 20, 30];

  return (
    <div className="flex-1 flex flex-col p-6 animate-fadeIn">
      <header className="py-12 text-center">
        <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3">
          <span className="text-white text-3xl font-bold">A+</span>
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">高考英语语法通</h1>
        <p className="text-gray-500">掌握语法核心，直击高考痛点</p>
      </header>

      <main className="flex-1 space-y-8 mt-4">
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <span className="w-1.5 h-6 bg-indigo-500 rounded-full mr-3"></span>
            选择测试题量
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => setCount(opt)}
                className={`py-4 rounded-xl font-medium transition-all ${
                  count === opt
                    ? 'bg-indigo-600 text-white shadow-md scale-105'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {opt} 题
              </button>
            ))}
          </div>
        </section>

        <section className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100">
          <h3 className="text-indigo-800 font-bold mb-2 flex items-center">
            ✨ 考点覆盖
          </h3>
          <ul className="text-sm text-indigo-700 space-y-1 opacity-80">
            <li>• 时态语态 / 非谓语动词</li>
            <li>• 定语从句 / 名词性从句</li>
            <li>• 倒装虚拟 / 连词介词</li>
          </ul>
        </section>
      </main>

      <footer className="py-6 safe-area-bottom">
        <button
          onClick={() => onStart(count)}
          className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-indigo-200 active:scale-95 transition-transform"
        >
          开始刷题
        </button>
        <p className="text-center text-xs text-gray-400 mt-4">Powered by Gemini-3 Flash</p>
      </footer>
    </div>
  );
};

export default HomeView;
