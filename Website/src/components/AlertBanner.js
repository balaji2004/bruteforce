'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Info, CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';
import { classNames } from '@/utils/classNames';

/**
 * AlertBanner Component
 * 
 * Display dismissible alert/notification banners
 * 
 * @component
 * @example
 * <AlertBanner
 *   type="warning"
 *   title="High Pressure Drop Detected"
 *   message="Node 1 shows rapid pressure decrease. Alert sent to contacts."
 *   dismissible
 *   onDismiss={() => console.log('Dismissed')}
 *   action={{
 *     label: "View Details",
 *     onClick: () => navigate('/alerts')
 *   }}
 * />
 */
const AlertBanner = ({
  type = 'info',
  title,
  message,
  dismissible = false,
  onDismiss,
  action,
  className = '',
  autoDismiss = false,
  autoDismissDelay = 5000
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsAnimating(false);
    setTimeout(() => {
      setIsVisible(false);
      if (onDismiss) onDismiss();
    }, 300);
  }, [onDismiss]);

  // Auto-dismiss functionality
  useEffect(() => {
    if (autoDismiss && autoDismissDelay) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoDismissDelay);
      
      return () => clearTimeout(timer);
    }
  }, [autoDismiss, autoDismissDelay, handleDismiss]);

  // Start animation on mount
  useEffect(() => {
    setTimeout(() => setIsAnimating(true), 10);
  }, []);

  if (!isVisible) return null;

  // Type configurations
  const typeConfig = {
    info: {
      icon: Info,
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-500 dark:border-blue-400',
      iconColor: 'text-blue-600 dark:text-blue-400',
      textColor: 'text-blue-900 dark:text-blue-200'
    },
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-500 dark:border-green-400',
      iconColor: 'text-green-600 dark:text-green-400',
      textColor: 'text-green-900 dark:text-green-200'
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      borderColor: 'border-yellow-500 dark:border-yellow-400',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      textColor: 'text-yellow-900 dark:text-yellow-200'
    },
    error: {
      icon: XCircle,
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-500 dark:border-red-400',
      iconColor: 'text-red-600 dark:text-red-400',
      textColor: 'text-red-900 dark:text-red-200'
    }
  };

  const config = typeConfig[type] || typeConfig.info;
  const IconComponent = config.icon;

  return (
    <div
      className={classNames(
        'border-l-4 p-4 mb-4 rounded-r-lg',
        config.bgColor,
        config.borderColor,
        'transition-all duration-300 ease-in-out',
        isAnimating ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4',
        className
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <IconComponent className={classNames('w-5 h-5 flex-shrink-0 mt-0.5', config.iconColor)} />
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {title && (
            <h3 className={classNames('font-bold mb-1', config.textColor)}>
              {title}
            </h3>
          )}
          <p className={classNames('text-sm', config.textColor)}>
            {message}
          </p>
          
          {/* Action Button */}
          {action && (
            <button
              onClick={action.onClick}
              className={classNames(
                'mt-3 text-sm font-semibold underline hover:no-underline',
                config.iconColor,
                'focus:outline-none focus:ring-2 focus:ring-offset-2',
                'transition-all duration-200'
              )}
            >
              {action.label}
            </button>
          )}
        </div>
        
        {/* Close Button */}
        {dismissible && (
          <button
            onClick={handleDismiss}
            className={classNames(
              'flex-shrink-0 p-1 rounded hover:bg-black/5',
              config.textColor,
              'focus:outline-none focus:ring-2 focus:ring-offset-2',
              'transition-colors duration-200'
            )}
            aria-label="Dismiss alert"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default AlertBanner;

