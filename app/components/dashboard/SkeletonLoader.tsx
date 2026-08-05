'use client';

import React from 'react';

export default function SkeletonLoader({ height = '120px', width = '100%' }: { height?: string; width?: string }) {
  return (
    <div
      style={{
        height,
        width,
        background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.03) 25%, rgba(255, 255, 255, 0.08) 50%, rgba(255, 255, 255, 0.03) 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.5s infinite',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    />
  );
}
