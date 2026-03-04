
import React, { useEffect, useState } from 'react';

interface LoginMascotProps {
  focusedField: 'name' | 'email' | 'passcode' | 'department' | 'role' | 'none';
  hasError: boolean;
  isSuccess: boolean;
  message?: string;
}

const LoginMascot: React.FC<LoginMascotProps> = ({ focusedField, hasError, isSuccess, message }) => {
  const [blink, setBlink] = useState(false);

  // Auto blinking logic
  useEffect(() => {
    const interval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 200);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Determine State
  const isCoveringEyes = focusedField === 'passcode';
  const isLookingDown = ['name', 'email', 'department', 'role'].includes(focusedField);
  
  // Eye Position Logic
  // Default (0,0), Looking Down (0, 8), Error (Shake handled via CSS)
  const eyeX = 0; 
  const eyeY = isLookingDown ? 10 : 0;

  // Colors
  // Use CSS Variable for the primary theme color (indigo-600 is mapped to --color-primary-600)
  const baseColor = hasError ? '#ef4444' : isSuccess ? '#10b981' : 'var(--color-primary-600)'; 
  const faceColor = hasError ? '#fef2f2' : '#ffffff'; // Red tint or white

  return (
    <div className={`relative w-32 h-32 mx-auto mb-4 transition-all duration-500 ${isSuccess ? 'animate-bounce' : 'animate-float'}`}>
      {/* Speech Bubble */}
      {message && (
        <div className="absolute -top-6 -right-16 bg-white border-2 border-indigo-50 rounded-xl px-4 py-2 shadow-sm animate-fade-in-up z-20 min-w-[100px] text-center transform rotate-2 origin-bottom-left">
           <p className="text-xs font-bold text-indigo-900 whitespace-nowrap">{message}</p>
           {/* Bubble Tail */}
           <div className="absolute top-full left-3 -mt-1.5 w-3 h-3 bg-white border-b-2 border-r-2 border-indigo-50 transform rotate-45"></div>
        </div>
      )}

      <svg
        viewBox="0 0 120 120"
        className={`w-full h-full drop-shadow-xl transition-transform duration-300 ${hasError ? 'animate-shake' : ''}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <style>
          {`
            @keyframes float {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-5px); }
            }
            .animate-float { animation: float 3s ease-in-out infinite; }
            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              25% { transform: translateX(-5px) rotate(-5deg); }
              75% { transform: translateX(5px) rotate(5deg); }
            }
            .animate-shake { animation: shake 0.4s ease-in-out; }
          `}
        </style>

        {/* --- BODY/HEAD --- */}
        {/* Antenna */}
        <path d="M60 10V20" stroke={baseColor} strokeWidth="4" strokeLinecap="round" />
        <circle cx="60" cy="10" r="4" fill={hasError ? '#ef4444' : '#fbbf24'} className="animate-pulse" />

        {/* Head Shape */}
        <rect x="20" y="20" width="80" height="70" rx="16" fill={baseColor} />
        <rect x="25" y="25" width="70" height="60" rx="12" fill={faceColor} />

        {/* --- FACE --- */}
        
        {/* Eyes Container */}
        <g style={{ transition: 'all 0.3s ease-out' }}>
          {/* Left Eye */}
          <g transform="translate(40, 45)">
             {/* Eye Background */}
             <rect x="-8" y="-8" width="16" height="22" rx="8" fill={baseColor} opacity="0.1" />
             {/* Eyelid (Blink) */}
             <rect x="-8" y="-8" width="16" height={blink ? 22 : 0} rx="8" fill={baseColor} className="transition-all duration-100" />
             {/* Pupil */}
             {!blink && (
                 <circle 
                    cx="0" 
                    cy="0" 
                    r="4" 
                    fill={baseColor} 
                    style={{ transform: `translate(${eyeX}px, ${eyeY}px)`, transition: 'transform 0.2s ease-out' }} 
                 />
             )}
          </g>

          {/* Right Eye */}
          <g transform="translate(80, 45)">
             <rect x="-8" y="-8" width="16" height="22" rx="8" fill={baseColor} opacity="0.1" />
             <rect x="-8" y="-8" width="16" height={blink ? 22 : 0} rx="8" fill={baseColor} className="transition-all duration-100" />
             {!blink && (
                 <circle 
                    cx="0" 
                    cy="0" 
                    r="4" 
                    fill={baseColor} 
                    style={{ transform: `translate(${eyeX}px, ${eyeY}px)`, transition: 'transform 0.2s ease-out' }} 
                 />
             )}
          </g>
        </g>

        {/* Mouth */}
        <g transform="translate(60, 75)">
           {hasError ? (
               // Sad Mouth
               <path d="M-10 5 Q0 0 10 5" stroke={baseColor} strokeWidth="3" strokeLinecap="round" />
           ) : isSuccess ? (
               // Happy Mouth
               <path d="M-10 0 Q0 8 10 0" stroke={baseColor} strokeWidth="3" strokeLinecap="round" />
           ) : (
               // Neutral/Talking Mouth
               <rect x="-6" y="-2" width="12" height="4" rx="2" fill={baseColor} opacity="0.3" />
           )}
        </g>

        {/* --- HANDS (For covering eyes) --- */}
        {/* Left Hand */}
        <g 
            transform={isCoveringEyes ? "translate(35, 45) rotate(-10)" : "translate(10, 100)"} 
            style={{ transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        >
            <circle r="12" fill={baseColor} stroke="white" strokeWidth="2" />
        </g>

        {/* Right Hand */}
        <g 
            transform={isCoveringEyes ? "translate(85, 45) rotate(10)" : "translate(110, 100)"} 
            style={{ transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        >
            <circle r="12" fill={baseColor} stroke="white" strokeWidth="2" />
        </g>

      </svg>
    </div>
  );
};

export default LoginMascot;
