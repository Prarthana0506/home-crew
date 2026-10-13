import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'red' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const variantClass =
    variant === 'secondary'
      ? 'btn-flat-secondary'
      : variant === 'red'
      ? 'btn-flat-red'
      : variant === 'gold'
      ? 'btn-flat-gold'
      : '';

  const sizeClass = size === 'sm' ? 'btn-flat-sm' : '';

  return (
    <button
      className={`btn-flat ${variantClass} ${sizeClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
};
