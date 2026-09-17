import React from 'react';
import styles from './Badge.module.css';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'fact' | 'interpretation' | 'general' | 'review' | 'risk';
  showDot?: boolean;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  showDot = false,
  icon,
  className,
  ...props
}) => {
  const classNames = [styles.badge, styles[variant], className]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classNames} {...props}>
      {showDot && <span className={styles.dot} aria-hidden="true" />}
      {icon}
      <span>{children}</span>
    </span>
  );
};
