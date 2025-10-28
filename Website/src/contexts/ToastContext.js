'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * Toast Context
 * 
 * Provides global toast notification system
 * 
 * @example
 * // In your app layout or root component:
 * <ToastProvider>
 *   <App />
 * </ToastProvider>
 * 
 * // In any component:
 * const { showToast } = useToast();
 * showToast({
 *   type: 'success',
 *   title: 'Node Registered',
 *   message: 'Node3 has been successfully added',
 *   duration: 3000
 * });
 */

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  /**
   * Show a new toast notification
   * @param {Object} options - Toast options
   * @param {string} options.type - Toast type: 'info', 'success', 'warning', 'error'
   * @param {string} [options.title] - Toast title
   * @param {string} options.message - Toast message
   * @param {number} [options.duration=5000] - Auto-dismiss duration in ms (0 to disable)
   */
  const showToast = useCallback((options) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const toast = {
      id,
      type: options.type || 'info',
      title: options.title,
      message: options.message,
      duration: options.duration !== undefined ? options.duration : 5000
    };

    setToasts((prev) => [...prev, toast]);

    // Auto-dismiss if duration is set
    if (toast.duration > 0) {
      setTimeout(() => {
        dismissToast(id);
      }, toast.duration);
    }

    return id;
  }, [dismissToast]);

  /**
   * Dismiss a toast by ID
   * @param {string} id - Toast ID
   */
  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  /**
   * Dismiss all toasts
   */
  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const value = {
    toasts,
    showToast,
    dismissToast,
    dismissAll
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
};

/**
 * Hook to access toast context
 * @returns {Object} Toast context value
 * @throws {Error} If used outside ToastProvider
 */
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export default ToastContext;

