import { ReportStatus, AIPriority } from '../types/report';
import { UserRole } from '../types/auth';

export function formatReportNumber(num: number | string | undefined | null): string {
  if (num === undefined || num === null) return 'WM-0000';
  const parsed = typeof num === 'string' ? parseInt(num.replace(/\D/g, ''), 10) || 0 : num;
  return `WM-${parsed.toString().padStart(4, '0')}`;
}

export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export function formatShortDate(dateString: string | undefined | null): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function getStatusBadgeStyle(status: ReportStatus | string): {
  bg: string;
  text: string;
  border: string;
} {
  const norm = (status || '').toLowerCase();
  switch (norm) {
    case 'resolved':
    case 'completed':
      return {
        bg: 'bg-[#E8F5F1]',
        text: 'text-[#16836A]',
        border: 'border-[#16836A]/30',
      };
    case 'in progress':
      return {
        bg: 'bg-[#FEF7E6]',
        text: 'text-[#D97706]',
        border: 'border-[#F59E0B]/40',
      };
    case 'under review':
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
      };
    case 'assigned':
      return {
        bg: 'bg-indigo-50',
        text: 'text-indigo-700',
        border: 'border-indigo-200',
      };
    case 'submitted':
    case 'pending':
      return {
        bg: 'bg-emerald-50',
        text: 'text-[#103D35]',
        border: 'border-[#DCE8E2]',
      };
    case 'rejected':
      return {
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-200',
      };
    default:
      return {
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        border: 'border-gray-200',
      };
  }
}

export function getPriorityBadgeStyle(priority: AIPriority | string | undefined | null): {
  bg: string;
  text: string;
  border: string;
  dotColor: string;
} {
  const norm = (priority || '').toUpperCase();
  if (norm === 'HIGH' || norm === 'CRITICAL') {
    return {
      bg: 'bg-[#FDEEEB]',
      text: 'text-[#E76F51]',
      border: 'border-[#E76F51]/30',
      dotColor: 'bg-[#E76F51]',
    };
  }
  if (norm === 'MEDIUM') {
    return {
      bg: 'bg-[#FEF7E6]',
      text: 'text-[#B45309]',
      border: 'border-[#F59E0B]/30',
      dotColor: 'bg-[#F59E0B]',
    };
  }
  return {
    bg: 'bg-[#E8F5F1]',
    text: 'text-[#16836A]',
    border: 'border-[#16836A]/30',
    dotColor: 'bg-[#16836A]',
  };
}

export function getRoleDisplayName(role: UserRole | string | undefined): string {
  switch (role) {
    case 'manager':
      return 'Operations Manager';
    case 'municipal_staff':
      return 'Municipal Field Staff';
    case 'citizen':
    default:
      return 'Citizen';
  }
}
