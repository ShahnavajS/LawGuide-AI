import Link from 'next/link';
import type { ComponentProps } from 'react';
import styles from './Button.module.css';

type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
};

export function LinkButton({ variant = 'primary', size = 'md', className, children, ...props }: LinkButtonProps) {
  return <Link className={[styles.button, styles[variant], styles[size], className].filter(Boolean).join(' ')} {...props}>{children}</Link>;
}
