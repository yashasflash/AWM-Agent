import React, { ReactNode } from 'react';
import { getStatusBadgeStyle, getPriorityBadgeStyle } from '../../utils/formatters';
import { ReportStatus, AIPriority } from '../../types/report';
import { UserRole } from '../../types/auth';

export interface BadgeProps {
  children?: ReactNode;
  variant?: 'default' | 'status' | 'priority' | 'role' | 'outline';
  status?: ReportStatus | string | null;
  priority?: AIPriority | string | null;
  role?: UserRole | string | null;
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  status,
  priority,
  role,
  size = 'md',
  className = '',
}) => {
  const sizeStyles = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  if (variant === 'status' && status) {
    const style = getStatusBadgeStyle(status);
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-semibold rounded-full border ${style.bg} ${style.text} ${style.border} ${sizeStyles} ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
        {status}
      </span>
    );
  }

  if (variant === 'priority' && priority) {
    const style = getPriorityBadgeStyle(priority);
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider rounded-md border ${style.bg} ${style.text} ${style.border} ${sizeStyles} ${className}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${style.dotColor}`} />
        {priority} Priority
      </span>
    );
  }

  if (variant === 'role' && role) {
    let roleText = 'Citizen';
    let roleColor = 'bg-[#103D35]/10 text-[#103D35] border-[#103D35]/20';

    if (role === 'manager' || role === 'admin') {
      roleText = 'Operations Manager';
      roleColor = 'bg-[#103D35] text-white border-[#103D35]';
    } else if (role === 'municipal_staff' || role === 'staff') {
      roleText = 'Municipal Staff';
      roleColor = 'bg-[#16836A] text-white border-[#16836A]';
    }

    return (
      <span
        className={`inline-flex items-center gap-1 font-semibold rounded-full border ${roleColor} ${sizeStyles} ${className}`}
      >
        {roleText}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full bg-[#F5F8F5] text-slate-700 border border-[#DCE8E2] ${sizeStyles} ${className}`}
    >
      {children}
    </span>
  );
};
