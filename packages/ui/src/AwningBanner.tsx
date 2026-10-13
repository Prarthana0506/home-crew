import React from 'react';

export const AwningBanner: React.FC<{ height?: number; className?: string }> = ({
  height = 12,
  className = ''
}) => {
  return (
    <div
      className={`awning-banner ${className}`}
      style={{ height: `${height}px` }}
      aria-hidden="true"
    />
  );
};
