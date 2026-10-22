import React, { ReactNode } from 'react';
import { AlertCircle, RefreshCw, XCircle } from 'lucide-react';
import { Button } from './Button';

export interface AlertBannerProps {
  title?: string;
  message: string | ReactNode;
  variant?: 'error' | 'warning' | 'info';
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  title,
  message,
  variant = 'error',
  onRetry,
  onDismiss,
  className = '',
}) => {
  const styles = {
    error: 'bg-[#FDEEEB] border-[#E76F51]/30 text-[#E76F51]',
    warning: 'bg-[#FEF7E6] border-[#F59E0B]/30 text-[#B45309]',
    info: 'bg-[#E8F5F1] border-[#16836A]/30 text-[#103D35]',
  };

  const icons = {
    error: <AlertCircle className="w-5 h-5 text-[#E76F51] shrink-0 mt-0.5" />,
    warning: <AlertCircle className="w-5 h-5 text-[#F59E0B] shrink-0 mt-0.5" />,
    info: <AlertCircle className="w-5 h-5 text-[#16836A] shrink-0 mt-0.5" />,
  };

  return (
    <div className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${styles[variant]} ${className}`}>
      <div className="flex items-start gap-3">
        {icons[variant]}
        <div>
          {title && <h4 className="text-xs font-bold uppercase tracking-wider mb-0.5">{title}</h4>}
          <div className="text-sm font-medium leading-relaxed text-slate-800">{message}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Retry
          </Button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-slate-600 p-1"
            aria-label="Dismiss banner"
          >
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export const ErrorState: React.FC<{
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}> = ({
  title = 'Service Unavailable',
  message = 'Failed to communicate with municipal service. Please ensure the backend is running.',
  onRetry,
  className = '',
}) => {
  return (
    <div className={`p-8 text-center flex flex-col items-center justify-center bg-white border border-[#DCE8E2] rounded-xl ${className}`}>
      <div className="w-12 h-12 rounded-full bg-[#FDEEEB] flex items-center justify-center mb-3 text-[#E76F51]">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-800 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 max-w-md mb-4">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
          Try Again
        </Button>
      )}
    </div>
  );
};
