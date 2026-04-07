import React from 'react';

interface LogoProps {
  /**
   * Color mode:
   * - light: dark text (for white/cream navbar after scroll)
   * - dark: white text + glow (for transparent navbar over hero, footer)
   */
  variant?: 'light' | 'dark';
  /** show "Papera" wordmark next to the icon */
  showWordmark?: boolean;
  /** height of the logo icon in pixels */
  size?: number;
  className?: string;
}

/**
 * Papera logo — uses the actual brand PNG (cyan circuit-P with notebook spine).
 *
 * The PNG is the gradient cyan version (Branding/6.png), trimmed of transparent
 * padding for tight rendering at small sizes. On dark backgrounds we add a cyan
 * glow filter; on light backgrounds we add a soft drop shadow for depth.
 */
export const Logo: React.FC<LogoProps> = ({
  variant = 'light',
  showWordmark = true,
  size = 40,
  className = '',
}) => {
  const isDark = variant === 'dark';

  return (
    <div
      className={`inline-flex items-center gap-2.5 select-none ${className}`}
      style={{ lineHeight: 0 }}
    >
      <img
        src="/brand/papera-icon-trimmed.png"
        alt="Papera"
        width={size}
        height={size}
        draggable={false}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          // Cyan glow on dark, soft shadow on light
          filter: isDark
            ? 'drop-shadow(0 0 10px rgba(56,189,248,0.5)) drop-shadow(0 0 4px rgba(56,189,248,0.35))'
            : 'drop-shadow(0 1px 2px rgba(15,23,42,0.18))',
          flexShrink: 0,
        }}
      />

      {showWordmark && (
        <span
          className="font-serif font-bold tracking-tight"
          style={{
            fontSize: `${Math.round(size * 0.55)}px`,
            color: isDark ? '#ffffff' : '#1a1c23',
            letterSpacing: '-0.025em',
            lineHeight: 1,
            marginLeft: '2px',
            // Soft shadow on dark for legibility over hero gradient
            textShadow: isDark
              ? '0 1px 12px rgba(0,0,0,0.5), 0 0 1px rgba(0,0,0,0.3)'
              : 'none',
          }}
        >
          Papera
        </span>
      )}
    </div>
  );
};
