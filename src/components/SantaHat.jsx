'use client'

/**
 * Santa Hat SVG Component - Add to any element for festive flair!
 * Use position: relative on parent, then position this absolutely
 */
export default function SantaHat({
  size = 24,
  className = '',
  style = {}
}) {
  return (
    <svg
      width={size}
      height={size * 0.75}
      viewBox="0 0 80 60"
      className={className}
      style={style}
    >
      {/* White fur trim */}
      <ellipse cx="40" cy="55" rx="42" ry="10" fill="white" opacity="0.95"/>
      {/* Red hat body */}
      <path d="M 0 55 Q 40 -15, 80 55" fill="#c41e3a"/>
      {/* Hat highlight */}
      <path d="M 15 50 Q 40 5, 65 50" fill="#e63946" opacity="0.5"/>
      {/* White pom-pom */}
      <circle cx="68" cy="8" r="10" fill="white" opacity="0.98"/>
      {/* Pom-pom shadow */}
      <circle cx="70" cy="10" r="6" fill="#f0f0f0" opacity="0.5"/>
    </svg>
  )
}
