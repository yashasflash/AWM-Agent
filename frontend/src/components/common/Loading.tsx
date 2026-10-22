import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; text?: string; className?: string }> = ({
  size = 'md',
  text,
  className = '',
}) => {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 p-6 ${className}`}>
      <Loader2 className={`${sizeMap[size]} text-[#16836A] animate-spin`} />
      {text && <p className="text-xs font-medium text-slate-500 tracking-wide">{text}</p>}
    </div>
  );
};

export const LoadingPage: React.FC<{ text?: string }> = ({ text = 'Initializing municipal workspace...' }) => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8">
      <div className="w-12 h-12 rounded-2xl bg-[#E8F5F1] flex items-center justify-center mb-4 border border-[#16836A]/20">
        <Loader2 className="w-6 h-6 text-[#16836A] animate-spin" />
      </div>
      <p className="text-sm font-semibold text-[#103D35]">{text}</p>
      <p className="text-xs text-slate-400 mt-1">Connecting to AWM Municipal Agent...</p>
    </div>
  );
};

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return <div className={`animate-pulse bg-[#DCE8E2]/60 rounded-lg ${className}`} />;
};
