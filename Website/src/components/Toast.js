'use client';

import React, { useState, useEffect } from 'react';
import { Info, CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';
import { classNames } from '@/utils/classNames';
import { useToast } from '@/contexts/ToastContext';

/**
 * Single Toast Component
 * 
 * Individual toast notification (used internally by ToastContainer)
 */
const Toast = ({ id, type, title, message, duration, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(100);

  // Animate in
  useEffect(() => {
    setTimeout(() => setIsVisible(true), 10);
  }, []);

  // Progress bar animation
  useEffect(() => {
    if (duration <= 0) return;

    const interval = 50; // Update every 50ms
    const decrement = (interval / duration) * 100;
    
    const timer = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev - decrement;
        return newProgress > 0 ? newProgress : 0;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [duration]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => onDismiss(id), 300);
  };

  // Type configurations
  const typeConfig = {
    info: {
      icon: Info,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-500',
      progressColor: 'bg-blue-500'
    },
    success: {
      icon: CheckCircle,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-500',
      progressColor: 'bg-green-500'
    },
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-500',
      progressColor: 'bg-yellow-500'
    },
    error: {
      icon: XCircle,
      iconColor: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-500',
      progressColor: 'bg-red-500'
    }
  };

  const config = typeConfig[type] || typeConfig.info;
  const IconComponent = config.icon;

  return (
    <div
      className={classNames(
        'relative mb-3 w-full sm:w-96 rounded-lg shadow-lg border-l-4 overflow-hidden',
        config.bgColor,
        config.borderColor,
        'transition-all duration-300 ease-in-out',
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
      )}
      role="alert"
    >
      <div className="flex items-start gap-3 p-4">
        {/* Icon */}
        <IconComponent className={classNames('w-5 h-5 flex-shrink-0 mt-0.5', config.iconColor)} />
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className="font-bold text-gray-900 mb-1 text-sm">
              {title}
            </h4>
          )}
          <p className="text-sm text-gray-700">
            {message}
          </p>
        </div>
        
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 rounded hover:bg-black/5 text-gray-500 hover:text-gray-700 transition-colors duration-200"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar */}
      {duration > 0 && (
        <div className="h-1 bg-gray-200">
          <div
            className={classNames('h-full transition-all ease-linear', config.progressColor)}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

/**
 * ToastContainer Component
 * 
 * Container that displays all active toasts
 * Should be rendered once in your app (e.g., in layout.js)
 * 
 * @example
 * // In layout.js:
 * import { ToastProvider } from '@/contexts/ToastContext';
 * import ToastContainer from '@/components/Toast';
 * 
 * export default function Layout({ children }) {
 *   return (
 *     <ToastProvider>
 *       <html>
 *         <body>
 *           {children}
 *           <ToastContainer />
 *         </body>
 *       </html>
 *     </ToastProvider>
 *   );
 * }
 */
export const ToastContainer = () => {
  const { toasts, dismissToast } = useToast();

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col items-end pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast
            {...toast}
            onDismiss={dismissToast}
          />
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;

