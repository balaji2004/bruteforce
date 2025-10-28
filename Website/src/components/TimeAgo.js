'use client';

import React, { useState, useEffect } from 'react';
import { formatRelativeTime, formatAbsoluteTime, formatBothTime, formatExactTime } from '@/utils/formatTime';

/**
 * TimeAgo Component
 * 
 * Display relative time (e.g., "2 minutes ago") with auto-updates
 * 
 * @component
 * @example
 * <TimeAgo timestamp={1736934615000} format="relative" />
 * <TimeAgo timestamp={new Date()} format="both" updateInterval={30000} />
 */
const TimeAgo = ({
  timestamp,
  format = 'relative',
  updateInterval = 60000, // Default: update every minute
  className = ''
}) => {
  const [, setTick] = useState(0);

  // Auto-update component at specified interval
  useEffect(() => {
    if (updateInterval <= 0) return;

    const timer = setInterval(() => {
      setTick((prev) => prev + 1);
    }, updateInterval);

    return () => clearInterval(timer);
  }, [updateInterval]);

  // Format the timestamp based on the format prop
  const getFormattedTime = () => {
    switch (format) {
      case 'relative':
        return formatRelativeTime(timestamp);
      case 'absolute':
        return formatAbsoluteTime(timestamp);
      case 'both':
        return formatBothTime(timestamp);
      default:
        return formatRelativeTime(timestamp);
    }
  };

  // Get exact timestamp for tooltip
  const exactTime = formatExactTime(timestamp);

  return (
    <time
      dateTime={exactTime}
      title={exactTime}
      className={className}
    >
      {getFormattedTime()}
    </time>
  );
};

export default TimeAgo;

