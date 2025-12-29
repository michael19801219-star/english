
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
  const [showFeedback, setShowFeedback] = useState(false);

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const isCorrect = selectedOption === currentQuestion.answerIndex;

  const handleConfirm = () => {
    if (selectedOption === null) return;
    setShowFeedback(true);
  };

  const handleNext = () => {
    const newAnswers = [...userAnswers, selectedOption!];
    setUserAnswers(newAnswers);
    setSelectedOption(null);
    setShowFeedback(false);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onFinish(newAnswers);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 animate-fadeIn">
      <header className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-bold text-indigo-600 uppercase tracking-tighter">
            Progress: {currentIndex + 1} / {questions.length}
          </span>
          <div className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold">
            {currentQuestion.grammarPoint}
          </div>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-indigo-500 transition-all duration-500" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <p className="text-lg font-medium leading-relaxed text-gray-800">
            {currentQuestion.question}
          </p>
        </div>

        <div className="space-y-3">
          {currentQuestion.options.map((option, idx) => {
            let style = "border-gray-100 bg-white text-gray-700";
            if (selectedOption === idx) {
              style = "border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600";
            }
            if (showFeedback) {
              if (idx === currentQuestion.answerIndex) {
                style = "border-green-500 bg-green-50 text-green-700 font-bold";
              } else if (selectedOption === idx) {
                style = "border-red-500 bg-red-50 text-red-700";
              } else {
                style = "opacity-50 border-gray-100 bg-white";
              }
            }

            return (
              <button
                key={idx}
                disabled={showFeedback}
                onClick={() => setSelectedOption(idx)}
                className={`w-full p-4 rounded-xl text-left transition-all border-2 relative ${style}`}
              >
                <span className={`inline-block w-7 h-7 rounded text-center leading-7 mr-3 font-bold text-sm ${
                  selectedOption === idx ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {String.fromCharCode(65 + idx)}
                </span>
                {option}
                {showFeedback && idx === currentQuestion.answerIndex && (
                  <span className="absolute right-4 top-4 text-green-500">✓</span>
                )}
                {showFeedback && selectedOption === idx && idx !== currentQuestion.answerIndex && (
                  <span className="absolute right-4 top-4 text-red-500">✕</span>
                )}
              </button>
            );
          })}
        </div>

        {showFeedback && (
          <div className="mt-6 p-5 bg-indigo-50 rounded-2xl border border-indigo-100 animate-fadeIn">
            <h4 className={`font-bold mb-2 ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
              {isCorrect ? '✨ 回答正确！' : '📚 解析纠错：'}
            </h4>
            <p className="text-sm text-indigo-900 leading-relaxed">
              {currentQuestion.explanation}
            </p>
          </div>
        )}
      </main>

      <footer className="py-6 safe-area-bottom">
        {!showFeedback ? (
          <button
            disabled={selectedOption === null}
            onClick={handleConfirm}
            className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all ${
              selectedOption === null
                ? 'bg-gray-200 text-gray-400'
                : 'bg-indigo-600 text-white'
            }`}
          >
            确认选择
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-all"
          >
            {currentIndex === questions.length - 1 ? '查看测试报告' : '下一题'}
          </button>
        )}
      </footer>
    </div>
  );
};

export default QuizView;
