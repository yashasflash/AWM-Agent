import React, { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode, forwardRef } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-[#103D35] uppercase tracking-wider mb-1.5">
            {label}
            {props.required && <span className="text-[#FF6848] ml-1">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full bg-white border rounded-lg text-sm text-slate-800 placeholder-slate-400 transition-colors py-2.5 px-3.5 focus:outline-none focus:ring-2 focus:ring-[#16836A]/20 focus:border-[#16836A] disabled:bg-[#F5F8F5] disabled:cursor-not-allowed ${
              leftIcon ? 'pl-10' : ''
            } ${rightIcon ? 'pr-10' : ''} ${
              error ? 'border-[#E76F51] focus:ring-[#E76F51]/20 focus:border-[#E76F51]' : 'border-[#DCE8E2]'
            } ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 flex items-center text-slate-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error ? (
          <p className="mt-1 text-xs text-[#E76F51] font-medium">{error}</p>
        ) : helperText ? (
          <p className="mt-1 text-xs text-slate-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-[#103D35] uppercase tracking-wider mb-1.5">
            {label}
            {props.required && <span className="text-[#FF6848] ml-1">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={`w-full bg-white border rounded-lg text-sm text-slate-800 placeholder-slate-400 transition-colors py-2.5 px-3.5 focus:outline-none focus:ring-2 focus:ring-[#16836A]/20 focus:border-[#16836A] disabled:bg-[#F5F8F5] disabled:cursor-not-allowed resize-y ${
            error ? 'border-[#E76F51] focus:ring-[#E76F51]/20 focus:border-[#E76F51]' : 'border-[#DCE8E2]'
          } ${className}`}
          {...props}
        />
        {error ? (
          <p className="mt-1 text-xs text-[#E76F51] font-medium">{error}</p>
        ) : helperText ? (
          <p className="mt-1 text-xs text-slate-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: Array<{ label: string; value: string | number }>;
  children?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, children, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-[#103D35] uppercase tracking-wider mb-1.5">
            {label}
            {props.required && <span className="text-[#FF6848] ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={`w-full bg-white border rounded-lg text-sm text-slate-800 transition-colors py-2.5 px-3.5 focus:outline-none focus:ring-2 focus:ring-[#16836A]/20 focus:border-[#16836A] disabled:bg-[#F5F8F5] disabled:cursor-not-allowed cursor-pointer ${
            error ? 'border-[#E76F51] focus:ring-[#E76F51]/20 focus:border-[#E76F51]' : 'border-[#DCE8E2]'
          } ${className}`}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {error ? (
          <p className="mt-1 text-xs text-[#E76F51] font-medium">{error}</p>
        ) : helperText ? (
          <p className="mt-1 text-xs text-slate-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);
Select.displayName = 'Select';
