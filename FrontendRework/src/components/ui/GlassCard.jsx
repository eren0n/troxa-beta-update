/**
 * GlassCard — shared glassmorphism surface for the Troxa dashboard.
 * Colors are driven by CSS custom properties so all three color modes
 * (dark / light / custom-violet) apply automatically.
 */

export const GLASS_STYLE = {
  background:           'var(--glass-bg)',
  backdropFilter:       'var(--glass-filter)',
  WebkitBackdropFilter: 'var(--glass-filter)',
  border:               '1px solid var(--glass-border)',
  boxShadow: [
    'inset 0 1px 0 var(--glass-rim)',
    '0 2px 8px  var(--shadow-close)',
    '0 10px 48px var(--shadow-far)',
  ].join(', '),
};

export const GLASS_HOVER_STYLE = {
  ...GLASS_STYLE,
  border:    '1px solid var(--border-strong)',
  boxShadow: [
    'inset 0 1px 0 var(--glass-rim)',
    '0 4px 12px  var(--shadow-close)',
    '0 16px 56px var(--shadow-far)',
  ].join(', '),
};

import { useState } from 'react';

export function GlassCard({ className = '', hover = false, style, children, ...props }) {
  const [isHovered, setIsHovered] = useState(false);

  const activeStyle = hover && isHovered ? GLASS_HOVER_STYLE : GLASS_STYLE;

  return (
    <div
      className={`rounded-2xl transition-shadow duration-200 ${className}`}
      style={{ ...activeStyle, ...style }}
      onMouseEnter={hover ? () => setIsHovered(true)  : undefined}
      onMouseLeave={hover ? () => setIsHovered(false) : undefined}
      {...props}
    >
      {children}
    </div>
  );
}
