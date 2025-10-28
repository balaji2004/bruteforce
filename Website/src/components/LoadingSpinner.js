'use client';

import React from 'react';
import { classNames } from '@/utils/classNames';

/**
 * LoadingSpinner Component
 * 
 * Consistent loading indicator with customizable size and color
 * 
 * @component
 * @example
 * <LoadingSpinner size="lg" text="Loading nodes..." />
 * <LoadingSpinner fullScreen text="Fetching data..." />
 */
const LoadingSpinner = ({
  size = 'md',
  color = 'blue',
  fullScreen = false,
  text = ''
}) => {
  // Size configurations
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4'
  };

  // Color configurations for spinner
  const colorClasses = {
    blue: 'border-blue-600 border-t-transparent',
    green: 'border-green-600 border-t-transparent',
    red: 'border-red-600 border-t-transparent',
    yellow: 'border-yellow-600 border-t-transparent',
    purple: 'border-purple-600 border-t-transparent',
    gray: 'border-gray-600 border-t-transparent',
    white: 'border-white border-t-transparent'
  };

  const textColorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    red: 'text-red-600',
    yellow: 'text-yellow-600',
    purple: 'text-purple-600',
    gray: 'text-gray-600',
    white: 'text-white'
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center gap-3">
      {/* Spinner */}
      <div
        className={classNames(
          'rounded-full border-solid animate-spin',
          sizeClasses[size] || sizeClasses.md,
          colorClasses[color] || colorClasses.blue
        )}
        role="status"
        aria-label="Loading"
      />
      
      {/* Optional Text */}
      {text && (
        <p className={classNames(
          'text-sm font-medium',
          textColorClasses[color] || textColorClasses.blue
        )}>
          {text}
        </p>
      )}
    </div>
  );

  // Full screen variant
  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
        <div className="bg-white rounded-lg shadow-2xl p-8">
          {spinner}
        </div>
      </div>
    );
  }

  // Regular inline variant
  return spinner;
};

export default LoadingSpinner;

