'use client'

import { useEffect, useState } from 'react'

/**
 * ULTIMATE CHRISTMAS THEME - Level 10 Festivity!
 * Features: TONS of snow, Santa hats, snowman, red/green accents, golden ribbons
 */
export default function AnkerBackground() {
  const [snowflakes, setSnowflakes] = useState([])

  useEffect(() => {
    // Generate LOTS of random snowflakes - 150 for maximum festivity!
    const flakes = Array.from({ length: 150 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 15,
      duration: 8 + Math.random() * 15,
      size: 6 + Math.random() * 18,
      opacity: 0.4 + Math.random() * 0.6,
      type: Math.random() > 0.7 ? 'crystal' : 'dot', // Mix of snowflake types
    }))
    setSnowflakes(flakes)
  }, [])

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Christmas gradient - dark with red and green hints */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(180deg,
              #0a1020 0%,
              #102030 20%,
              #1a2a4a 40%,
              #2a3a5a 60%,
              #1a2030 80%,
              #0f1520 100%
            )
          `,
        }}
      />

      {/* Red Christmas glow from corners */}
      <div
        className="absolute top-0 left-0 w-96 h-96"
        style={{
          background: 'radial-gradient(circle at top left, rgba(200, 50, 50, 0.15) 0%, transparent 60%)',
        }}
      />
      <div
        className="absolute top-0 right-0 w-96 h-96"
        style={{
          background: 'radial-gradient(circle at top right, rgba(50, 150, 50, 0.12) 0%, transparent 60%)',
        }}
      />
      <div
        className="absolute bottom-0 left-0 w-96 h-96"
        style={{
          background: 'radial-gradient(circle at bottom left, rgba(50, 150, 50, 0.12) 0%, transparent 60%)',
        }}
      />
      <div
        className="absolute bottom-0 right-0 w-96 h-96"
        style={{
          background: 'radial-gradient(circle at bottom right, rgba(200, 50, 50, 0.15) 0%, transparent 60%)',
        }}
      />

      {/* Snow ground effect at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32"
        style={{
          background: `
            linear-gradient(to top,
              rgba(255, 255, 255, 0.15) 0%,
              rgba(200, 220, 240, 0.1) 40%,
              transparent 100%
            )
          `,
        }}
      />

      {/* Snowman in bottom left! */}
      <div className="absolute bottom-4 left-8 opacity-30">
        {/* Bottom snowball */}
        <div className="w-20 h-20 bg-white/80 rounded-full relative" style={{ filter: 'blur(0.5px)' }}>
          {/* Middle snowball */}
          <div className="absolute -top-12 left-2 w-16 h-16 bg-white/80 rounded-full">
            {/* Head */}
            <div className="absolute -top-10 left-1 w-14 h-14 bg-white/80 rounded-full">
              {/* Eyes */}
              <div className="absolute top-3 left-3 w-2 h-2 bg-black/60 rounded-full" />
              <div className="absolute top-3 right-3 w-2 h-2 bg-black/60 rounded-full" />
              {/* Carrot nose */}
              <div className="absolute top-5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-8 border-l-transparent border-r-transparent border-b-orange-500/70" style={{ transform: 'translateX(-50%) rotate(90deg)' }} />
              {/* Santa hat on snowman! */}
              <div className="absolute -top-6 left-0 right-0">
                <div className="w-14 h-4 bg-red-600/80 rounded-b-lg" />
                <div className="absolute -top-4 left-1 w-12 h-8 bg-red-600/80" style={{ clipPath: 'polygon(20% 100%, 50% 0%, 80% 100%)' }} />
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white/90 rounded-full" />
                <div className="absolute top-3 -left-1 right-0 w-16 h-2 bg-white/80 rounded-full" />
              </div>
            </div>
            {/* Buttons */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-2 h-2 bg-black/50 rounded-full" />
            <div className="absolute top-6 left-1/2 -translate-x-1/2 w-2 h-2 bg-black/50 rounded-full" />
          </div>
          {/* Buttons on bottom */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-2 h-2 bg-black/50 rounded-full" />
          <div className="absolute top-8 left-1/2 -translate-x-1/2 w-2 h-2 bg-black/50 rounded-full" />
        </div>
        {/* Stick arms */}
        <div className="absolute top-8 -left-6 w-8 h-1 bg-amber-800/50 rounded-full transform -rotate-30" />
        <div className="absolute top-8 -right-2 w-8 h-1 bg-amber-800/50 rounded-full transform rotate-30" />
      </div>

      {/* Golden ribbon decorative elements */}
      <svg className="absolute inset-0 w-full h-full opacity-50" preserveAspectRatio="none">
        <defs>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d4a54a" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#f5d78e" stopOpacity="1" />
            <stop offset="100%" stopColor="#c4954a" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="redRibbon" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#c41e3a" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#ff4444" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#c41e3a" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="greenRibbon" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1a5f2a" stopOpacity="0.7" />
            <stop offset="50%" stopColor="#2d8a3e" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#1a5f2a" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        {/* Gold ribbon */}
        <path
          d="M -50 80 Q 200 130, 400 60 T 800 100 T 1200 40 T 1600 80"
          fill="none"
          stroke="url(#goldGradient)"
          strokeWidth="10"
          className="opacity-40"
        />
        {/* Red ribbon */}
        <path
          d="M -100 200 Q 300 150, 600 220 T 1000 180 T 1400 240 T 1800 200"
          fill="none"
          stroke="url(#redRibbon)"
          strokeWidth="8"
          className="opacity-35"
        />
        {/* Green ribbon */}
        <path
          d="M -50 350 Q 250 400, 500 330 T 900 380 T 1300 320 T 1700 360"
          fill="none"
          stroke="url(#greenRibbon)"
          strokeWidth="6"
          className="opacity-30"
        />
      </svg>

      {/* Christmas lights string effect at top */}
      <div className="absolute top-0 left-0 right-0 h-2 flex justify-around items-center">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="w-3 h-3 rounded-full animate-pulse"
            style={{
              backgroundColor: ['#ff0000', '#00ff00', '#ffcc00', '#0066ff', '#ff00ff'][i % 5],
              opacity: 0.7,
              animationDelay: `${i * 0.2}s`,
              boxShadow: `0 0 10px ${['#ff0000', '#00ff00', '#ffcc00', '#0066ff', '#ff00ff'][i % 5]}`,
            }}
          />
        ))}
      </div>

      {/* TONS of Snowflakes */}
      <div className="absolute inset-0">
        {snowflakes.map((flake) => (
          <div
            key={flake.id}
            className="absolute text-white"
            style={{
              left: `${flake.left}%`,
              top: '-30px',
              fontSize: `${flake.size}px`,
              opacity: flake.opacity,
              animation: `fall ${flake.duration}s linear infinite`,
              animationDelay: `${flake.delay}s`,
              textShadow: '0 0 5px rgba(255,255,255,0.5)',
            }}
          >
            {flake.type === 'crystal' ? '❄' : '•'}
          </div>
        ))}
      </div>

      {/* Sparkle/star effects - more of them! */}
      <div className="absolute top-[15%] left-[20%] w-2 h-2 bg-white rounded-full opacity-70 animate-pulse" />
      <div className="absolute top-[25%] right-[25%] w-2.5 h-2.5 bg-yellow-200 rounded-full opacity-60 animate-pulse" style={{ animationDelay: '0.3s' }} />
      <div className="absolute top-[10%] right-[40%] w-1.5 h-1.5 bg-white rounded-full opacity-50 animate-pulse" style={{ animationDelay: '0.6s' }} />
      <div className="absolute top-[35%] left-[15%] w-2 h-2 bg-yellow-100 rounded-full opacity-55 animate-pulse" style={{ animationDelay: '0.9s' }} />
      <div className="absolute top-[20%] left-[60%] w-3 h-3 bg-white rounded-full opacity-50 animate-pulse" style={{ animationDelay: '1.2s' }} />
      <div className="absolute top-[45%] right-[15%] w-2 h-2 bg-yellow-200 rounded-full opacity-45 animate-pulse" style={{ animationDelay: '1.5s' }} />
      <div className="absolute top-[30%] left-[80%] w-1.5 h-1.5 bg-white rounded-full opacity-60 animate-pulse" style={{ animationDelay: '1.8s' }} />
      <div className="absolute top-[50%] left-[30%] w-2 h-2 bg-yellow-100 rounded-full opacity-50 animate-pulse" style={{ animationDelay: '2.1s' }} />

      {/* Anker branding with Christmas touch */}
      <div
        className="absolute bottom-8 right-8 text-7xl font-bold tracking-wider opacity-8 select-none"
        style={{
          background: 'linear-gradient(135deg, #c41e3a 0%, #00A0E9 50%, #2d8a3e 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        ANKER
      </div>
      <div
        className="absolute bottom-4 right-8 text-sm tracking-widest uppercase opacity-15 select-none"
        style={{
          background: 'linear-gradient(90deg, #c41e3a, #2d8a3e)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Charging Team - Happy Holidays!
      </div>

      {/* Floating Santa hat decoration in top right */}
      <div className="absolute top-20 right-20 opacity-25 transform rotate-12">
        <svg width="80" height="60" viewBox="0 0 80 60">
          <ellipse cx="40" cy="55" rx="40" ry="8" fill="white" opacity="0.9"/>
          <path d="M 5 55 Q 40 -10, 75 55" fill="#c41e3a"/>
          <circle cx="65" cy="10" r="8" fill="white" opacity="0.95"/>
        </svg>
      </div>

      {/* Another Santa hat bottom center */}
      <div className="absolute bottom-32 left-1/2 -translate-x-1/2 opacity-20 transform -rotate-6">
        <svg width="60" height="45" viewBox="0 0 80 60">
          <ellipse cx="40" cy="55" rx="40" ry="8" fill="white" opacity="0.9"/>
          <path d="M 5 55 Q 40 -10, 75 55" fill="#c41e3a"/>
          <circle cx="65" cy="10" r="8" fill="white" opacity="0.95"/>
        </svg>
      </div>

      {/* CSS Animation for snowfall */}
      <style jsx>{`
        @keyframes fall {
          0% {
            transform: translateY(-30px) rotate(0deg) translateX(0);
            opacity: 0;
          }
          5% {
            opacity: 1;
          }
          50% {
            transform: translateY(50vh) rotate(180deg) translateX(20px);
          }
          95% {
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(360deg) translateX(-20px);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
