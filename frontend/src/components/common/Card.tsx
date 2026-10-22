import React, { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'flat' | 'interactive' | 'forest';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  className = '',
  ...props
}) => {
  const variantStyles = {
    default: 'bg-white border border-[#DCE8E2] shadow-subtle',
    flat: 'bg-white border border-[#DCE8E2]',
    interactive:
      'bg-white border border-[#DCE8E2] shadow-subtle hover:shadow-card hover:border-[#16836A]/50 transition-all duration-200 cursor-pointer',
    forest: 'bg-[#103D35] text-white border border-[#103D35] shadow-card',
  };

  return (
    <div
      className={`rounded-xl overflow-hidden ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{
  title: string | ReactNode;
  subtitle?: string | ReactNode;
  action?: ReactNode;
  className?: string;
}> = ({ title, subtitle, action, className = '' }) => (
  <div className={`p-5 border-b border-[#DCE8E2] flex items-center justify-between gap-4 ${className}`}>
    <div>
      <h3 className="text-base font-semibold text-[#103D35]">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export const CardContent: React.FC<{ children: ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <div className={`p-5 ${className}`}>{children}</div>;

export const CardFooter: React.FC<{ children: ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`p-4 bg-[#F5F8F5]/60 border-t border-[#DCE8E2] flex items-center justify-between gap-3 ${className}`}>
    {children}
  </div>
);
