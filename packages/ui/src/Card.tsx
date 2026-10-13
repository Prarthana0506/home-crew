import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'teal' | 'terracotta';
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  className = '',
  children,
  ...props
}) => {
  const variantClass =
    variant === 'teal'
      ? 'flat-card-teal'
      : variant === 'terracotta'
      ? 'flat-card-terracotta'
      : '';

  return (
    <div className={`flat-card ${variantClass} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
};
