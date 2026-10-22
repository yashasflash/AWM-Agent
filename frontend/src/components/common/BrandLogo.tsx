import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  hideText?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 'md',
  hideText = false,
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Stylized leaf-within-pin logo matching reference identity */}
      <div
        className={`${iconSizes[size]} rounded-xl bg-[#16836A] flex items-center justify-center text-white shadow-sm shrink-0`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5 text-white"
        >
          {/* Location pin contour */}
          <path
            d="M12 2C8.13401 2 5 5.13401 5 9C5 14.1 11.2 21.3 11.6 21.7C11.8 21.9 12.2 21.9 12.4 21.7C12.8 21.3 19 14.1 19 9C19 5.13401 15.866 2 12 2Z"
            fill="currentColor"
          />
          {/* Internal clean eco leaf */}
          <path
            d="M12 6C10.2 7.8 9.2 9.8 9.2 12C10.5 12 12.6 11.2 13.6 9.6C14.4 8.2 13.8 6.5 12 6Z"
            fill="#FFFFFF"
          />
          <path
            d="M12 12.5C12 10.2 12.8 8.8 14.5 8C14.1 9.8 13.2 11.2 12 12.5Z"
            fill="#E9F5EF"
          />
        </svg>
      </div>

      {!hideText && (
        <div className="flex flex-col leading-none">
          <span className={`font-extrabold tracking-tight text-[#103D35] ${textSizes[size]}`}>
            AWM <span className="text-[#16836A]">Agent</span>
          </span>
          <span className="text-[10px] text-slate-500 font-medium tracking-tight mt-0.5">
            Autonomous Waste Management
          </span>
        </div>
      )}
    </div>
  );
};
