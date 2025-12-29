
import React from 'react';

interface LoadingViewProps {
  message: string;
}

const LoadingView: React.FC<LoadingViewProps> = ({ message }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 animate-pulse">
      <div className="relative mb-8">
        <div className="w-24 h-24 border-4 border-indigo-200 rounded-full"></div>
        <div className="w-24 h-24 border-t-4 border-indigo-600 rounded-full absolute top-0 left-0 animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center text-indigo-600 font-bold">
          AI
        </div>
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">正在准备中</h2>
      <p className="text-gray-500 text-center animate-bounce">{message}</p>
      
      <div className="mt-12 space-y-4 w-full">
        <div className="h-4 bg-gray-100 rounded-full w-3/4 mx-auto opacity-50"></div>
        <div className="h-4 bg-gray-100 rounded-full w-1/2 mx-auto opacity-30"></div>
      </div>
    </div>
  );
};

export default LoadingView;
