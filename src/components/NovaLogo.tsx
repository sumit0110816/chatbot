import React from 'react';

interface NovaLogoProps {
  className?: string;
  showText?: boolean;
  darkText?: boolean;
}

export const NovaLogo: React.FC<NovaLogoProps> = ({
  className = '',
  showText = true,
  darkText = false,
}) => {
  return (
    <span className={`inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 ${className}`}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="novaGrad" x1="2" y1="2" x2="26" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
        <rect width="28" height="28" rx="8" fill="url(#novaGrad)" />
        <path
          d="M14 6.5L16.1 11.9L21.5 14L16.1 16.1L14 21.5L11.9 16.1L6.5 14L11.9 11.9L14 6.5Z"
          fill="#FFFFFF"
        />
      </svg>
      {showText && (
        <span
          className={`font-display text-lg font-bold tracking-tight whitespace-nowrap shrink-0 ${
            darkText ? 'text-white' : 'text-slate-900 dark:text-slate-100'
          }`}
        >
          NOVA AI
        </span>
      )}
    </span>
  );
};
