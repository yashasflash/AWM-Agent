import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'emerald' | 'coral' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children: ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'text-xs font-semibold px-3 py-1.5 gap-1.5',
    md: 'text-sm font-medium px-4 py-2 gap-2',
    lg: 'text-base font-medium px-6 py-2.5 gap-2.5',
  };

  const variantStyles: Record<ButtonVariant, string> = {
    primary:
      'bg-[#103D35] hover:bg-[#0C2E28] text-white focus:ring-[#103D35]/40 shadow-sm',
    emerald:
      'bg-[#16836A] hover:bg-[#126B57] text-white focus:ring-[#16836A]/40 shadow-sm',
    coral:
      'bg-[#FF6848] hover:bg-[#E65334] text-white focus:ring-[#FF6848]/40 shadow-sm',
    secondary:
      'bg-white hover:bg-[#F5F8F5] text-[#103D35] border border-[#DCE8E2] hover:border-[#B8D1C4] focus:ring-[#16836A]/20 shadow-subtle',
    ghost:
      'bg-transparent hover:bg-[#16836A]/5 text-[#103D35] focus:ring-[#16836A]/20',
    danger:
      'bg-[#E76F51] hover:bg-[#D45D3F] text-white focus:ring-[#E76F51]/40 shadow-sm',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </button>
  );
};
