import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'badge';
  variant?: 'full' | 'icon' | 'text-only' | 'delivery';
  textColor?: 'dark' | 'light' | 'white';
}

export const GrajaFoodLogo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  variant = 'full',
  textColor = 'dark',
}) => {
  // Dimensions based on size preset
  const sizeClasses = {
    sm: 'h-8',
    md: 'h-12',
    lg: 'h-16',
    xl: 'h-24',
    badge: 'w-14 h-14',
  };

  const textColors = {
    dark: 'text-neutral-900',
    light: 'text-sky-500',
    white: 'text-white',
  };

  // High-fidelity vector rendition of the GrajaFood brand mark
  const renderIcon = (customSize?: string) => (
    <svg
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${customSize || 'w-full h-full'} drop-shadow-md select-none`}
    >
      {/* Glossy App Icon Background (Squircle with 48px radius equivalent) */}
      <rect
        x="2"
        y="2"
        width="156"
        height="156"
        rx="46"
        fill="url(#skyGradient)"
        stroke="#FFFFFF"
        strokeWidth="3.5"
      />
      {/* Base shadow layer */}
      <rect
        x="6"
        y="6"
        width="148"
        height="148"
        rx="42"
        fill="black"
        opacity="0.04"
      />

      {/* Top Gloss Highlight Ring */}
      <path
        d="M 12 50 C 12 28, 28 12, 50 12 L 110 12 C 132 12, 148 28, 148 50 C 148 35, 120 18, 80 18 C 40 18, 12 35, 12 50 Z"
        fill="#FFFFFF"
        opacity="0.25"
      />

      {/* The White Logo Border Contour (makes the stickers / logo stand out beautifully) */}
      <g filter="url(#dropShadow)">
        {/* Speed-lines outline */}
        <path
          d="M 32 65 L 52 65 M 20 74 L 52 74 M 14 83 L 52 83 M 22 92 L 52 92 M 34 101 L 52 101"
          stroke="#FFFFFF"
          strokeWidth="13"
          strokeLinecap="round"
        />

        {/* Outer White Contour of the main G loop */}
        <path
          d="M 121 82 L 121 95 C 121 110, 107 123, 86 123 C 61 123, 44 107, 44 82 C 44 57, 60 41, 85 41 C 98 41, 110 47, 116 57 L 105 65 C 101 58, 94 52, 85 52 C 70 52, 57 64, 57 82 C 57 100, 71 112, 86 112 C 100 112, 109 101, 109 93 L 82 93 L 82 82 Z"
          stroke="#FFFFFF"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="#FFFFFF"
        />
      </g>

      {/* Inner Fill Layer of the G Logo (Deep Royal Dark Blue) */}
      {/* Speed lines */}
      <path
        d="M 32 65 L 52 65 M 20 74 L 52 74 M 14 83 L 52 83 M 22 92 L 52 92 M 34 101 L 52 101"
        stroke="#0F2E45"
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* G main block fill */}
      <path
        d="M 121 82 L 121 95 C 121 110, 107 123, 86 123 C 61 123, 44 107, 44 82 C 44 57, 60 41, 85 41 C 98 41, 110 47, 116 57 L 105 65 C 101 58, 94 52, 85 52 C 70 52, 57 64, 57 82 C 57 100, 71 112, 86 112 C 100 112, 109 101, 109 93 L 82 93 L 82 82 Z"
        fill="#0F2E45"
      />

      {/* Dynamic Internal Speed Grooves (accentuating speed/direction inside the G) */}
      <path
        d="M 48 74 L 75 74 M 46 83 L 70 83 M 48 92 L 65 92"
        stroke="#9BD5F8"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.9"
      />

      {/* Gradients and Filters Definitions */}
      <defs>
        <linearGradient id="skyGradient" x1="0" y1="0" x2="160" y2="160" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9BD5F8" />
          <stop offset="50%" stopColor="#75C3F0" />
          <stop offset="100%" stopColor="#4AACE6" />
        </linearGradient>
        <filter id="dropShadow" x="-10" y="-10" width="180" height="180" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#0F2E45" floodOpacity="0.25" />
        </filter>
      </defs>
    </svg>
  );

  return (
    <div className={`flex items-center gap-3.5 select-none ${className}`}>
      {/* Vector Logo Badge */}
      {(variant === 'full' || variant === 'icon' || variant === 'delivery') && (
        <div className={`shrink-0 ${sizeClasses[size] || sizeClasses.md}`}>
          {renderIcon()}
        </div>
      )}

      {/* Styled Wordmark & Slogan based on variant selection */}
      {(variant === 'full' || variant === 'text-only' || variant === 'delivery') && (
        <div className="flex flex-col text-left">
          {/* Main Brand Wordmark */}
          <div className="flex items-baseline gap-0.5 leading-none">
            <span className={`text-2xl font-black italic tracking-tighter font-sans ${textColor === 'white' ? 'text-white' : 'text-[#0F2E45]'}`}>
              Graja
              <span className={textColor === 'white' ? 'text-white/85' : 'text-sky-500'}>
                {variant === 'delivery' ? 'Food Entregas' : 'Food'}
              </span>
            </span>
          </div>
          
          {/* Slogan Subtitle */}
          <span className={`text-[10px] font-black uppercase tracking-widest mt-0.5 leading-none font-sans opacity-75 ${textColor === 'white' ? 'text-sky-100' : 'text-neutral-400'}`}>
            {variant === 'delivery' ? 'O APP EXCLUSIVO DO MOTOBOY' : 'O delivery do Grajaú'}
          </span>
        </div>
      )}
    </div>
  );
};
