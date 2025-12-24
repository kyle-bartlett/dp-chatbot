'use client'

import { useEffect, useState } from 'react'

/**
 * Anker Charging-inspired background with Christmas/Winter theme
 * Features: snowflakes, golden ribbon accents, blue/purple gradient, Anker branding
 */
export default function AnkerBackground() {
  const [snowflakes, setSnowflakes] = useState([])

  useEffect(() => {
    // Generate random snowflakes
    const flakes = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 10,
      duration: 10 + Math.random() * 20,
      size: 4 + Math.random() * 12,
      opacity: 0.3 + Math.random() * 0.5,
    }))
    setSnowflakes(flakes)
  }, [])

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Base gradient - dark blue to purple inspired by the image */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(180deg,
              #0a1628 0%,
              #1a2a4a 30%,
              #2a3a6a 50%,
              #3a2a5a 70%,
              #2a1a4a 85%,
              #1a1a3a 100%
            )
          `,
        }}
      />

      {/* Horizon glow effect (like snow reflection) */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1/3"
        style={{
          background: `
            linear-gradient(to top,
              rgba(180, 200, 220, 0.15) 0%,
              rgba(100, 120, 180, 0.1) 30%,
              transparent 100%
            )
          `,
        }}
      />

      {/* Purple/magenta accent glow from bottom */}
      <div
        className="absolute bottom-0 left-1/4 right-1/4 h-64"
        style={{
          background: 'radial-gradient(ellipse at bottom, rgba(150, 50, 200, 0.3) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Blue accent glow */}
      <div
        className="absolute bottom-20 left-0 right-0 h-48"
        style={{
          background: 'linear-gradient(to top, rgba(0, 160, 233, 0.2) 0%, transparent 100%)',
        }}
      />

      {/* Golden ribbon decorative elements */}
      <svg className="absolute inset-0 w-full h-full opacity-40" preserveAspectRatio="none">
        {/* Main diagonal ribbon */}
        <defs>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d4a54a" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#f5d78e" stopOpacity="1" />
            <stop offset="100%" stopColor="#c4954a" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="goldGradient2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#c4954a" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#e5c77e" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#d4a54a" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        {/* Flowing ribbon curve */}
        <path
          d="M -50 100 Q 200 150, 400 80 T 800 120 T 1200 60 T 1600 100"
          fill="none"
          stroke="url(#goldGradient)"
          strokeWidth="8"
          className="opacity-30"
          style={{ filter: 'blur(1px)' }}
        />
        <path
          d="M -100 400 Q 300 350, 600 420 T 1000 380 T 1400 440 T 1800 400"
          fill="none"
          stroke="url(#goldGradient2)"
          strokeWidth="6"
          className="opacity-20"
          style={{ filter: 'blur(1px)' }}
        />
      </svg>

      {/* Snowflakes */}
      <div className="absolute inset-0">
        {snowflakes.map((flake) => (
          <div
            key={flake.id}
            className="absolute text-white animate-fall"
            style={{
              left: `${flake.left}%`,
              top: '-20px',
              fontSize: `${flake.size}px`,
              opacity: flake.opacity,
              animation: `fall ${flake.duration}s linear infinite`,
              animationDelay: `${flake.delay}s`,
            }}
          >
            *
          </div>
        ))}
      </div>

      {/* Sparkle/star effects */}
      <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-white rounded-full opacity-60 animate-pulse" />
      <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 bg-white rounded-full opacity-50 animate-pulse" style={{ animationDelay: '0.5s' }} />
      <div className="absolute top-1/5 right-1/4 w-1 h-1 bg-white rounded-full opacity-40 animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-2/5 left-1/5 w-1.5 h-1.5 bg-white rounded-full opacity-45 animate-pulse" style={{ animationDelay: '1.5s' }} />
      <div className="absolute bottom-1/3 right-1/5 w-2 h-2 bg-white rounded-full opacity-50 animate-pulse" style={{ animationDelay: '2s' }} />

      {/* Anker branding watermark */}
      <div
        className="absolute bottom-8 right-8 text-6xl font-bold tracking-wider opacity-5 select-none"
        style={{
          background: 'linear-gradient(135deg, #00A0E9 0%, #00d4aa 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        ANKER
      </div>

      {/* Subtle "Charging Team" text */}
      <div
        className="absolute bottom-4 right-8 text-xs tracking-widest uppercase opacity-10 text-[#00A0E9] select-none"
      >
        Charging Team
      </div>

      {/* Vertical light streaks (keeping some original elements) */}
      <div className="absolute inset-0 opacity-15">
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: '15%',
            background: 'linear-gradient(to bottom, transparent 0%, rgba(0, 160, 233, 0.3) 20%, rgba(0, 160, 233, 0.5) 50%, rgba(0, 160, 233, 0.3) 80%, transparent 100%)',
            filter: 'blur(3px)',
            width: '2px',
          }}
        />
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: '47%',
            background: 'linear-gradient(to bottom, transparent 0%, rgba(0, 160, 233, 0.2) 20%, rgba(0, 160, 233, 0.4) 50%, rgba(0, 160, 233, 0.2) 80%, transparent 100%)',
            filter: 'blur(3px)',
            width: '2px',
          }}
        />
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: '77%',
            background: 'linear-gradient(to bottom, transparent 0%, rgba(0, 160, 233, 0.25) 20%, rgba(0, 160, 233, 0.45) 50%, rgba(0, 160, 233, 0.25) 80%, transparent 100%)',
            filter: 'blur(3px)',
            width: '2px',
          }}
        />
      </div>

      {/* CSS Animation for snowfall */}
      <style jsx>{`
        @keyframes fall {
          0% {
            transform: translateY(-20px) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
