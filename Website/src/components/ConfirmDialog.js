'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, XCircle, Info } from 'lucide-react';
import Modal from './Modal';
import { classNames } from '@/utils/classNames';

/**
 * ConfirmDialog Component
 * 
 * Confirmation dialog for destructive or important actions
 * 
 * @component
 * @example
 * <ConfirmDialog
 *   isOpen={showDelete}
 *   onClose={() => setShowDelete(false)}
 *   onConfirm={handleDelete}
 *   title="Delete Node"
 *   message="Are you sure you want to delete node1? This will remove all historical data."
 *   confirmText="Delete"
 *   variant="danger"
 * />
 */
const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  requireTyping = null
}) => {
  const [typedText, setTypedText] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  // Reset typed text when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setTypedText('');
    }
  }, [isOpen]);

  // Variant configurations
  const variantConfig = {
    danger: {
      icon: XCircle,
      iconColor: 'text-red-600',
      bgColor: 'bg-red-100',
      buttonColor: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
      buttonText: 'text-white'
    },
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      buttonColor: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
      buttonText: 'text-white'
    },
    info: {
      icon: Info,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-100',
      buttonColor: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
      buttonText: 'text-white'
    }
  };

  const config = variantConfig[variant] || variantConfig.danger;
  const IconComponent = config.icon;

  // Check if confirm button should be disabled
  const isConfirmDisabled = requireTyping 
    ? typedText !== requireTyping 
    : false;

  const handleConfirm = async () => {
    if (isConfirmDisabled || isConfirming) return;
    
    setIsConfirming(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Confirmation action failed:', error);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      closeOnOutsideClick={!isConfirming}
      closeOnEscape={!isConfirming}
      showCloseButton={!isConfirming}
    >
      <div className="text-center">
        {/* Icon */}
        <div className={classNames('mx-auto flex items-center justify-center w-16 h-16 rounded-full mb-4', config.bgColor)}>
          <IconComponent className={classNames('w-8 h-8', config.iconColor)} />
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-gray-900 mb-3">
          {title}
        </h3>

        {/* Message */}
        <p className="text-gray-600 mb-6 text-sm leading-relaxed">
          {message}
        </p>

        {/* Require typing field */}
        {requireTyping && (
          <div className="mb-6 text-left">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type <span className="font-mono font-bold">{requireTyping}</span> to confirm:
            </label>
            <input
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              className={classNames(
                'w-full px-4 py-2 border rounded-lg',
                'focus:outline-none focus:ring-2 focus:ring-offset-2',
                config.iconColor.includes('red') ? 'focus:ring-red-500 border-red-300' : 
                config.iconColor.includes('yellow') ? 'focus:ring-yellow-500 border-yellow-300' :
                'focus:ring-blue-500 border-blue-300'
              )}
              placeholder={requireTyping}
              disabled={isConfirming}
              autoComplete="off"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            disabled={isConfirming}
            className={classNames(
              'px-6 py-2.5 rounded-lg font-semibold',
              'bg-gray-200 text-gray-700 hover:bg-gray-300',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500',
              'transition-colors duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {cancelText}
          </button>
          
          <button
            onClick={handleConfirm}
            disabled={isConfirmDisabled || isConfirming}
            className={classNames(
              'px-6 py-2.5 rounded-lg font-semibold',
              config.buttonColor,
              config.buttonText,
              'focus:outline-none focus:ring-2 focus:ring-offset-2',
              'transition-colors duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'min-w-[100px]'
            )}
          >
            {isConfirming ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;

