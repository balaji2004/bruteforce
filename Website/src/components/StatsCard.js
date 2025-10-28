'use client';

import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { classNames } from '@/utils/classNames';

/**
 * StatsCard Component
 * 
 * Display a statistic with icon, title, value, and optional subtitle
 * 
 * @component
 * @example
 * <StatsCard
 *   icon={Activity}
 *   title="Active Nodes"
 *   value={8}
 *   subtitle="Out of 10 total"
 *   trend="up"
 *   trendValue="+2"
 *   color="green"
 * />
 */
const StatsCard = ({
  icon: Icon,
  title,
  value,
  subtitle,
  trend,
  trendValue,
  color = 'blue',
  className = ''
}) => {
  // Color mapping for Tailwind classes
  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
    pink: 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400',
    gray: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
  };

  const trendColorClasses = {
    up: 'text-green-600 dark:text-green-400',
    down: 'text-red-600 dark:text-red-400'
  };

  return (
    <div
      className={classNames(
        'bg-white dark:bg-gray-800 rounded-lg shadow-md p-6',
        'hover:shadow-lg hover:scale-105 transition-all duration-300',
        'border border-gray-100 dark:border-gray-700',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Title */}
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{title}</p>

          {/* Value */}
          <p className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {value}
          </p>

          {/* Subtitle */}
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
          )}

          {/* Trend Indicator */}
          {trend && trendValue && (
            <div className={classNames(
              'flex items-center gap-1 mt-2',
              trendColorClasses[trend]
            )}>
              {trend === 'up' ? (
                <ArrowUp className="w-4 h-4" />
              ) : (
                <ArrowDown className="w-4 h-4" />
              )}
              <span className="text-sm font-semibold">{trendValue}</span>
            </div>
          )}
        </div>

        {/* Icon */}
        {Icon && (
          <div className={classNames(
            'rounded-full p-3',
            colorClasses[color] || colorClasses.blue
          )}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsCard;

