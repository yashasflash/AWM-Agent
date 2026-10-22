import React, { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`p-10 text-center flex flex-col items-center justify-center bg-white border border-[#DCE8E2] rounded-xl ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-[#F5F8F5] border border-[#DCE8E2] flex items-center justify-center text-[#16836A] mb-4 shadow-subtle">
        {icon || <Inbox className="w-7 h-7" />}
      </div>
      <h3 className="text-base font-semibold text-[#103D35] mb-1.5">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm mb-5 leading-relaxed">{description}</p>
      {actionText && onAction && (
        <Button variant="emerald" size="md" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
};
