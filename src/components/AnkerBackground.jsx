'use client'

/**
 * Anker Charging-inspired background elements
 * Adds dynamic lighting effects similar to Anker Prime webpage
 */
export default function AnkerBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Diagonal light streak animation */}
      <div 
        className="absolute bottom-0 left-0 w-full h-full opacity-30"
        style={{
          background: `linear-gradient(
            135deg,
            transparent 0%,
            transparent 38%,
            rgba(0, 160, 233, 0.2) 42%,
            rgba(0, 160, 233, 0.4) 50%,
            rgba(0, 160, 233, 0.2) 58%,
            transparent 62%,
            transparent 100%
          )`,
          transform: 'translateX(-10%) translateY(10%)',
          filter: 'blur(1px)',
        }}
      />

      {/* Vertical light streaks */}
      <div className="absolute inset-0 opacity-20">
        <div 
          className="absolute top-0 bottom-0 w-px"
          style={{
            left: '15%',
            background: 'linear-gradient(to bottom, transparent 0%, rgba(0, 160, 233, 0.3) 20%, rgba(0, 160, 233, 0.5) 50%, rgba(0, 160, 233, 0.3) 80%, transparent 100%)',
            filter: 'blur(2px)',
            width: '2px',
          }}
        />
        <div 
          className="absolute top-0 bottom-0 w-px"
          style={{
            left: '47%',
            background: 'linear-gradient(to bottom, transparent 0%, rgba(0, 160, 233, 0.2) 20%, rgba(0, 160, 233, 0.4) 50%, rgba(0, 160, 233, 0.2) 80%, transparent 100%)',
            filter: 'blur(2px)',
            width: '2px',
          }}
        />
        <div 
          className="absolute top-0 bottom-0 w-px"
          style={{
            left: '77%',
            background: 'linear-gradient(to bottom, transparent 0%, rgba(0, 160, 233, 0.25) 20%, rgba(0, 160, 233, 0.45) 50%, rgba(0, 160, 233, 0.25) 80%, transparent 100%)',
            filter: 'blur(2px)',
            width: '2px',
          }}
        />
      </div>

      {/* Animated glow orbs (subtle) */}
      <div 
        className="absolute rounded-full opacity-10"
        style={{
          width: '600px',
          height: '600px',
          left: '5%',
          top: '10%',
          background: 'radial-gradient(circle, rgba(0, 160, 233, 0.4) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      <div 
        className="absolute rounded-full opacity-8"
        style={{
          width: '500px',
          height: '500px',
          right: '5%',
          bottom: '20%',
          background: 'radial-gradient(circle, rgba(0, 160, 233, 0.3) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
    </div>
  )
}

