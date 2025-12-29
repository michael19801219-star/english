
import React, { useState } from 'react';
import { Question } from '../types';

interface QuizViewProps {
  questions: Question[];
  onFinish: (answers: number[]) => void;
}

const QuizView: React.FC<QuizViewProps> = ({ questions, onFinish }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  const handleNext = () => {
    if (selectedOption === null) return;

    const newAnswers = [...userAnswers, selectedOption];
    setUserAnswers(newAnswers);
    setSelectedOption(null);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onFinish(newAnswers);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 animate-fadeIn">
      <header className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm font-bold text-indigo-600">
            第 {currentIndex + 1} 题 / 共 {questions.length} 题
          </span>
          <span className="text-sm text-gray-400">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-indigo-500 transition-all duration-300" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
          <div className="mb-2 text-xs font-semibold text-indigo-500 uppercase tracking-wider">
            [{currentQuestion.grammarPoint}]
          </div>
          <p className="text-lg font-medium leading-relaxed text-gray-800">
            {currentQuestion.question}
          </p>
        </div>

        <div className="space-y-3">
          {currentQuestion.options.map((option, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedOption(idx)}
              className={`w-full p-4 rounded-xl text-left transition-all border-2 ${
                selectedOption === idx
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                  : 'border-gray-100 bg-white text-gray-700'
              }`}
            >
              <span className="inline-block w-8 h-8 rounded-lg bg-gray-100 text-gray-500 text-center leading-8 mr-3 font-bold text-sm">
                {String.fromCharCode(65 + idx)}
              </span>
              {option}
            </button>
          ))}
        </div>
      </main>

      <footer className="py-6 safe-area-bottom">
        <button
          disabled={selectedOption === null}
          onClick={handleNext}
          className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all ${
            selectedOption === null
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-indigo-600 text-white shadow-indigo-200'
          }`}
        >
          {currentIndex === questions.length - 1 ? '提交结果' : '下一题'}
        </button>
      </footer>
    </div>
  );
};

export default QuizView;
