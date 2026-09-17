'use client';

import React, { useState, useId } from 'react';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  content: string;
  children: React.ReactElement<{ 'aria-describedby'?: string }>;
  position?: 'top' | 'bottom';
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = useId();

  return (
    <div
      className={styles.container}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {React.cloneElement(children, {
        'aria-describedby': isVisible ? tooltipId : undefined,
      })}
      <div
        id={tooltipId}
        role="tooltip"
        className={[
          styles.tooltip,
          styles[position],
          isVisible ? styles.visible : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {content}
      </div>
    </div>
  );
};
