'use client';

import React from 'react';
import { classNames } from '@/utils/classNames';

/**
 * EmptyState Component
 * 
 * Consistent empty state design with icon, text, and optional action
 * 
 * @component
 * @example
 * <EmptyState
 *   icon={Inbox}
 *   title="No alerts yet"
 *   description="When alerts are triggered, they will appear here."
 *   action={{
 *     label: "Create Manual Alert",
 *     onClick: () => navigate('/admin'), // Still uses /admin URL
 *     icon: Plus
 *   }}
 * />
 */
const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  className = ''
}) => {
  const ActionIcon = action?.icon;

  return (
    <div className={classNames('flex flex-col items-center justify-center py-12 px-4', className)}>
      {/* Icon */}
      {Icon && (
        <div className="mb-4">
          <Icon className="w-16 h-16 text-gray-400" strokeWidth={1.5} />
        </div>
      )}

      {/* Title */}
      <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-gray-600 text-center max-w-md mb-6">
          {description}
        </p>
      )}

      {/* Action Button */}
      {action && (
        <button
          onClick={action.onClick}
          className={classNames(
            'inline-flex items-center gap-2 px-6 py-3 rounded-lg',
            'bg-blue-600 text-white font-semibold',
            'hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
            'transition-colors duration-200',
            'shadow-md hover:shadow-lg'
          )}
        >
          {ActionIcon && <ActionIcon className="w-5 h-5" />}
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;

