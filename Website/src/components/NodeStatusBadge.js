'use client';

import React from 'react';
import { classNames } from '@/utils/classNames';

/**
 * NodeStatusBadge Component
 * 
 * Display node online/offline status with optional dot and text
 * 
 * @component
 * @example
 * <NodeStatusBadge status="online" showDot showText />
 * <NodeStatusBadge status="warning" showText size="lg" />
 */
const NodeStatusBadge = ({
  status = 'offline',
  showDot = false,
  showText = true,
  size = 'md'
}) => {
  // Status configurations
  const statusConfig = {
    online: {
      bgColor: 'bg-green-100',
      textColor: 'text-green-800',
      dotColor: 'bg-green-500',
      label: 'Online'
    },
    offline: {
      bgColor: 'bg-red-100',
      textColor: 'text-red-800',
      dotColor: 'bg-red-500',
      label: 'Offline'
    },
    warning: {
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-800',
      dotColor: 'bg-yellow-500',
      label: 'Warning'
    }
  };

  // Size configurations
  const sizeClasses = {
    sm: {
      badge: 'px-2 py-0.5 text-xs',
      dot: 'w-1.5 h-1.5'
    },
    md: {
      badge: 'px-2.5 py-1 text-sm',
      dot: 'w-2 h-2'
    },
    lg: {
      badge: 'px-3 py-1.5 text-base',
      dot: 'w-2.5 h-2.5'
    }
  };

  const config = statusConfig[status] || statusConfig.offline;
  const sizeConfig = sizeClasses[size] || sizeClasses.md;

  return (
    <span
      className={classNames(
        'inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wide',
        config.bgColor,
        config.textColor,
        sizeConfig.badge
      )}
    >
      {/* Pulsing Dot (for online status) */}
      {showDot && (
        <span className="relative flex">
          <span
            className={classNames(
              'rounded-full',
              config.dotColor,
              sizeConfig.dot
            )}
          />
          {status === 'online' && (
            <span
              className={classNames(
                'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
                config.dotColor
              )}
            />
          )}
        </span>
      )}
      
      {/* Status Text */}
      {showText && config.label}
    </span>
  );
};

export default NodeStatusBadge;

