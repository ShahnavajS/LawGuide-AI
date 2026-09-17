import React from 'react';
import styles from './Spinner.module.css';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  label,
  className,
}) => {
  return (
    <div
      className={[styles.container, className].filter(Boolean).join(' ')}
      role="status"
      aria-label={label || 'Loading...'}
    >
      <div className={[styles.spinner, styles[size]].join(' ')} />
      {label && <span className={styles.label}>{label}</span>}
    </div>
  );
};
