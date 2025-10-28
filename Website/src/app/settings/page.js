// src/app/settings/page.js
'use client';

import { useState, useEffect } from 'react';
import { database, ref, onValue, set } from '@/lib/firebase';
import { formatTimeAgo } from '@/lib/utils';
import { 
  Settings, 
  Bell, 
  MessageSquare, 
  Activity, 
  Database, 
  Save, 
  AlertCircle,
  CheckCircle,
  X,
  ChevronDown,
  Map
} from 'lucide-react';

// Custom Toggle Switch Component
const ToggleSwitch = ({ enabled, onChange, disabled = false, label, ariaLabel }) => {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
      aria-label={ariaLabel || label}
      role="switch"
      aria-checked={enabled}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
};

// Number Input Component with Increment/Decrement
const NumberInput = ({ value, onChange, min = 0, max = 999999, step = 1, disabled = false }) => {
  const handleIncrement = () => {
    const newValue = parseFloat(value) + step;
    if (newValue <= max) onChange(newValue);
  };

  const handleDecrement = () => {
    const newValue = parseFloat(value) - step;
    if (newValue >= min) onChange(newValue);
  };

  const handleChange = (e) => {
    const val = e.target.value;
    if (val === '') {
      onChange('');
      return;
    }
    const num = parseFloat(val);
    if (!isNaN(num)) {
      onChange(Math.min(Math.max(num, min), max));
    }
  };

  return (
    <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled || value <= min}
        className="px-3 py-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:text-white"
      >
        -
      </button>
      <input
        type="number"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        className="flex-1 px-3 py-2 text-center border-0 focus:outline-none focus:ring-0 disabled:bg-gray-50 dark:disabled:bg-gray-700 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-white"
      />
      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled || value >= max}
        className="px-3 py-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:text-white"
      >
        +
      </button>
    </div>
  );
};

// Toast Notification Component
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border animate-slide-in ${
      type === 'success'
        ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800'
        : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
    }`}>
      {type === 'success' ? (
        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
      ) : (
        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
      )}
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-70">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default function SettingsPage() {
  // State for all settings
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState({});
  const [lastSaved, setLastSaved] = useState(null);
  const [toast, setToast] = useState(null);

  // Alert Thresholds State
  const [thresholds, setThresholds] = useState({
    pressureDrop: {
      enabled: true,
      value: 5,
      timeWindow: 30,
      severity: 'critical'
    },
    humidity: {
      enabled: true,
      threshold: 90,
      severity: 'warning'
    },
    temperatureDrop: {
      enabled: false,
      value: 5,
      timeWindow: 30,
      severity: 'warning'
    },
    rainfall: {
      enabled: true,
      amount: 50,
      timeWindow: 60,
      severity: 'critical'
    }
  });

  // System Settings State
  const [systemSettings, setSystemSettings] = useState({
    updateInterval: 10,
    dataRetention: 7,
    mapProvider: 'leaflet',
    mapApiKey: ''
  });

  // Load settings from Firebase on mount
  useEffect(() => {
    const settingsRef = ref(database, 'settings');
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();
      
      if (data) {
        if (data.thresholds) {
          setThresholds(prev => ({ ...prev, ...data.thresholds }));
        }
        if (data.system) {
          setSystemSettings(prev => ({ ...prev, ...data.system }));
        }
        if (data.lastSaved) {
          setLastSaved(data.lastSaved);
        }
      }
      
      setLoading(false);
    }, (error) => {
      console.error('Error loading settings:', error);
      setToast({ type: 'error', message: 'Failed to load settings' });
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Track unsaved changes
  useEffect(() => {
    // Only track changes after initial load
    if (!loading) {
      setHasUnsavedChanges(prev => ({ ...prev, thresholds: true }));
    }
  }, [thresholds, loading]);

  useEffect(() => {
    if (!loading) {
      setHasUnsavedChanges(prev => ({ ...prev, system: true }));
    }
  }, [systemSettings, loading]);

  // Validation functions
  const validateThresholds = () => {
    const errors = [];

    // Pressure Drop validation
    if (thresholds.pressureDrop.enabled) {
      if (thresholds.pressureDrop.value <= 0 || thresholds.pressureDrop.value > 50) {
        errors.push('Pressure drop must be between 0 and 50 hPa');
      }
      if (thresholds.pressureDrop.timeWindow < 1 || thresholds.pressureDrop.timeWindow > 120) {
        errors.push('Pressure drop time window must be between 1 and 120 minutes');
      }
    }

    // Humidity validation
    if (thresholds.humidity.enabled) {
      if (thresholds.humidity.threshold <= 0 || thresholds.humidity.threshold > 100) {
        errors.push('Humidity threshold must be between 0 and 100%');
      }
    }

    // Temperature Drop validation
    if (thresholds.temperatureDrop.enabled) {
      if (thresholds.temperatureDrop.value <= 0 || thresholds.temperatureDrop.value > 50) {
        errors.push('Temperature drop must be between 0 and 50°C');
      }
      if (thresholds.temperatureDrop.timeWindow < 1 || thresholds.temperatureDrop.timeWindow > 120) {
        errors.push('Temperature drop time window must be between 1 and 120 minutes');
      }
    }

    // Rainfall validation
    if (thresholds.rainfall.enabled) {
      if (thresholds.rainfall.amount <= 0 || thresholds.rainfall.amount > 500) {
        errors.push('Rainfall amount must be between 0 and 500 mm');
      }
      if (thresholds.rainfall.timeWindow < 1 || thresholds.rainfall.timeWindow > 120) {
        errors.push('Rainfall time window must be between 1 and 120 minutes');
      }
    }

    return errors;
  };

  const validateSystemSettings = () => {
    const errors = [];

    if (systemSettings.updateInterval < 5 || systemSettings.updateInterval > 60) {
      errors.push('Update interval must be between 5 and 60 seconds');
    }

    if (systemSettings.dataRetention < 1 || systemSettings.dataRetention > 90) {
      errors.push('Data retention must be between 1 and 90 days');
    }

    if ((systemSettings.mapProvider === 'google' || systemSettings.mapProvider === 'mapbox') 
        && !systemSettings.mapApiKey.trim()) {
      errors.push(`API Key is required for ${systemSettings.mapProvider}`);
    }

    return errors;
  };

  // Save functions
  const saveThresholds = async () => {
    const errors = validateThresholds();
    if (errors.length > 0) {
      setToast({ type: 'error', message: errors[0] });
      return;
    }

    setSaving(prev => ({ ...prev, thresholds: true }));

    try {
      await set(ref(database, 'settings/thresholds'), thresholds);
      const timestamp = Date.now();
      await set(ref(database, 'settings/lastSaved'), timestamp);
      setLastSaved(timestamp);
      setHasUnsavedChanges(prev => ({ ...prev, thresholds: false }));
      setToast({ type: 'success', message: 'Alert thresholds saved successfully' });
    } catch (error) {
      console.error('Error saving thresholds:', error);
      setToast({ type: 'error', message: 'Failed to save alert thresholds' });
    } finally {
      setSaving(prev => ({ ...prev, thresholds: false }));
    }
  };

  const saveSystemSettings = async () => {
    const errors = validateSystemSettings();
    if (errors.length > 0) {
      setToast({ type: 'error', message: errors[0] });
      return;
    }

    // Confirm if reducing data retention
    const currentRetention = systemSettings.dataRetention;
    if (currentRetention < 7) {
      const confirmed = window.confirm(
        `You are reducing data retention to ${currentRetention} day(s). This may result in loss of historical data. Continue?`
      );
      if (!confirmed) return;
    }

    setSaving(prev => ({ ...prev, system: true }));

    try {
      await set(ref(database, 'settings/system'), systemSettings);
      const timestamp = Date.now();
      await set(ref(database, 'settings/lastSaved'), timestamp);
      setLastSaved(timestamp);
      setHasUnsavedChanges(prev => ({ ...prev, system: false }));
      setToast({ type: 'success', message: 'System settings saved successfully. Some changes may require page refresh.' });
    } catch (error) {
      console.error('Error saving system settings:', error);
      setToast({ type: 'error', message: 'Failed to save system settings' });
    } finally {
      setSaving(prev => ({ ...prev, system: false }));
    }
  };

  const resetThresholds = () => {
    const confirmed = window.confirm('Reset alert thresholds to default values?');
    if (!confirmed) return;

    setThresholds({
      pressureDrop: {
        enabled: true,
        value: 5,
        timeWindow: 30,
        severity: 'critical'
      },
      humidity: {
        enabled: true,
        threshold: 90,
        severity: 'warning'
      },
      temperatureDrop: {
        enabled: false,
        value: 5,
        timeWindow: 30,
        severity: 'warning'
      },
      rainfall: {
        enabled: true,
        amount: 50,
        timeWindow: 60,
        severity: 'critical'
      }
    });
    setHasUnsavedChanges(prev => ({ ...prev, thresholds: true }));
  };

  const resetSystemSettings = () => {
    const confirmed = window.confirm('Reset system settings to default values?');
    if (!confirmed) return;

    setSystemSettings({
      updateInterval: 10,
      dataRetention: 7,
      mapProvider: 'leaflet',
      mapApiKey: ''
    });
    setHasUnsavedChanges(prev => ({ ...prev, system: true }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">System Settings</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Configure alert thresholds, system preferences, and notification settings
          </p>
          {lastSaved && (
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Last saved: {formatTimeAgo(lastSaved)}
            </p>
          )}
        </div>

        <div className="space-y-6">
          {/* Alert Thresholds Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Activity className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Alert Thresholds</h2>
                {hasUnsavedChanges.thresholds && (
                  <span className="px-2 py-1 text-xs font-medium text-yellow-800 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                    Unsaved changes
                  </span>
                )}
              </div>
              <button
                onClick={resetThresholds}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white underline"
              >
                Reset to defaults
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pressure Drop Alert */}
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Pressure Drop Alert</h3>
                  <ToggleSwitch
                    enabled={thresholds.pressureDrop.enabled}
                    onChange={(val) => setThresholds(prev => ({
                      ...prev,
                      pressureDrop: { ...prev.pressureDrop, enabled: val }
                    }))}
                    ariaLabel="Enable pressure drop alert"
                  />
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Drop Amount (hPa)
                    </label>
                    <NumberInput
                      value={thresholds.pressureDrop.value}
                      onChange={(val) => setThresholds(prev => ({
                        ...prev,
                        pressureDrop: { ...prev.pressureDrop, value: val }
                      }))}
                      min={0.1}
                      max={50}
                      step={0.1}
                      disabled={!thresholds.pressureDrop.enabled}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Time Window (minutes)
                    </label>
                    <NumberInput
                      value={thresholds.pressureDrop.timeWindow}
                      onChange={(val) => setThresholds(prev => ({
                        ...prev,
                        pressureDrop: { ...prev.pressureDrop, timeWindow: val }
                      }))}
                      min={1}
                      max={120}
                      step={1}
                      disabled={!thresholds.pressureDrop.enabled}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Severity
                    </label>
                    <div className="relative">
                      <select
                        value={thresholds.pressureDrop.severity}
                        onChange={(e) => setThresholds(prev => ({
                          ...prev,
                          pressureDrop: { ...prev.pressureDrop, severity: e.target.value }
                        }))}
                        disabled={!thresholds.pressureDrop.enabled}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 dark:disabled:bg-gray-700 disabled:cursor-not-allowed appearance-none dark:bg-gray-700 dark:text-white"
                      >
                        <option value="warning">Warning</option>
                        <option value="critical">Critical</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Humidity Alert */}
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Humidity Alert</h3>
                  <ToggleSwitch
                    enabled={thresholds.humidity.enabled}
                    onChange={(val) => setThresholds(prev => ({
                      ...prev,
                      humidity: { ...prev.humidity, enabled: val }
                    }))}
                    ariaLabel="Enable humidity alert"
                  />
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Threshold (%)
                    </label>
                    <NumberInput
                      value={thresholds.humidity.threshold}
                      onChange={(val) => setThresholds(prev => ({
                        ...prev,
                        humidity: { ...prev.humidity, threshold: val }
                      }))}
                      min={0}
                      max={100}
                      step={1}
                      disabled={!thresholds.humidity.enabled}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Severity
                    </label>
                    <div className="relative">
                      <select
                        value={thresholds.humidity.severity}
                        onChange={(e) => setThresholds(prev => ({
                          ...prev,
                          humidity: { ...prev.humidity, severity: e.target.value }
                        }))}
                        disabled={!thresholds.humidity.enabled}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 dark:disabled:bg-gray-700 disabled:cursor-not-allowed appearance-none dark:bg-gray-700 dark:text-white"
                      >
                        <option value="warning">Warning</option>
                        <option value="critical">Critical</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Temperature Drop Alert */}
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Temperature Drop Alert</h3>
                  <ToggleSwitch
                    enabled={thresholds.temperatureDrop.enabled}
                    onChange={(val) => setThresholds(prev => ({
                      ...prev,
                      temperatureDrop: { ...prev.temperatureDrop, enabled: val }
                    }))}
                    ariaLabel="Enable temperature drop alert"
                  />
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Drop Amount (°C)
                    </label>
                    <NumberInput
                      value={thresholds.temperatureDrop.value}
                      onChange={(val) => setThresholds(prev => ({
                        ...prev,
                        temperatureDrop: { ...prev.temperatureDrop, value: val }
                      }))}
                      min={0.1}
                      max={50}
                      step={0.1}
                      disabled={!thresholds.temperatureDrop.enabled}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Time Window (minutes)
                    </label>
                    <NumberInput
                      value={thresholds.temperatureDrop.timeWindow}
                      onChange={(val) => setThresholds(prev => ({
                        ...prev,
                        temperatureDrop: { ...prev.temperatureDrop, timeWindow: val }
                      }))}
                      min={1}
                      max={120}
                      step={1}
                      disabled={!thresholds.temperatureDrop.enabled}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Severity
                    </label>
                    <div className="relative">
                      <select
                        value={thresholds.temperatureDrop.severity}
                        onChange={(e) => setThresholds(prev => ({
                          ...prev,
                          temperatureDrop: { ...prev.temperatureDrop, severity: e.target.value }
                        }))}
                        disabled={!thresholds.temperatureDrop.enabled}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 dark:disabled:bg-gray-700 disabled:cursor-not-allowed appearance-none dark:bg-gray-700 dark:text-white"
                      >
                        <option value="warning">Warning</option>
                        <option value="critical">Critical</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Rainfall Alert */}
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Rainfall Alert</h3>
                  <ToggleSwitch
                    enabled={thresholds.rainfall.enabled}
                    onChange={(val) => setThresholds(prev => ({
                      ...prev,
                      rainfall: { ...prev.rainfall, enabled: val }
                    }))}
                    ariaLabel="Enable rainfall alert"
                  />
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Amount (mm)
                    </label>
                    <NumberInput
                      value={thresholds.rainfall.amount}
                      onChange={(val) => setThresholds(prev => ({
                        ...prev,
                        rainfall: { ...prev.rainfall, amount: val }
                      }))}
                      min={0.1}
                      max={500}
                      step={0.1}
                      disabled={!thresholds.rainfall.enabled}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Time Window (minutes)
                    </label>
                    <NumberInput
                      value={thresholds.rainfall.timeWindow}
                      onChange={(val) => setThresholds(prev => ({
                        ...prev,
                        rainfall: { ...prev.rainfall, timeWindow: val }
                      }))}
                      min={1}
                      max={120}
                      step={1}
                      disabled={!thresholds.rainfall.enabled}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Severity
                    </label>
                    <div className="relative">
                      <select
                        value={thresholds.rainfall.severity}
                        onChange={(e) => setThresholds(prev => ({
                          ...prev,
                          rainfall: { ...prev.rainfall, severity: e.target.value }
                        }))}
                        disabled={!thresholds.rainfall.enabled}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 dark:disabled:bg-gray-700 disabled:cursor-not-allowed appearance-none dark:bg-gray-700 dark:text-white"
                      >
                        <option value="warning">Warning</option>
                        <option value="critical">Critical</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={saveThresholds}
                disabled={saving.thresholds || !hasUnsavedChanges.thresholds}
                className="bg-blue-600 dark:bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {saving.thresholds ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Thresholds
                  </>
                )}
              </button>
            </div>
          </div>

          {/* System Settings Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Database className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">System Settings</h2>
                {hasUnsavedChanges.system && (
                  <span className="px-2 py-1 text-xs font-medium text-yellow-800 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                    Unsaved changes
                  </span>
                )}
              </div>
              <button
                onClick={resetSystemSettings}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white underline"
              >
                Reset to defaults
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Update Interval */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Update Interval
                  <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400">(Requires refresh)</span>
                </label>
                <div className="relative">
                  <select
                    value={systemSettings.updateInterval}
                    onChange={(e) => setSystemSettings(prev => ({
                      ...prev,
                      updateInterval: parseInt(e.target.value)
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none dark:bg-gray-700 dark:text-white"
                  >
                    <option value={5}>5 seconds</option>
                    <option value={10}>10 seconds</option>
                    <option value={30}>30 seconds</option>
                    <option value={60}>60 seconds</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                </div>
              </div>

              {/* Data Retention */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Data Retention
                  <span className="ml-2 text-xs text-red-600 dark:text-red-400">(Affects historical data)</span>
                </label>
                <div className="relative">
                  <select
                    value={systemSettings.dataRetention}
                    onChange={(e) => setSystemSettings(prev => ({
                      ...prev,
                      dataRetention: parseInt(e.target.value)
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none dark:bg-gray-700 dark:text-white"
                  >
                    <option value={1}>1 day</option>
                    <option value={7}>7 days</option>
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                </div>
              </div>

              {/* Map Provider */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Map Provider
                </label>
                <div className="relative">
                  <select
                    value={systemSettings.mapProvider}
                    onChange={(e) => setSystemSettings(prev => ({
                      ...prev,
                      mapProvider: e.target.value,
                      mapApiKey: e.target.value === 'leaflet' ? '' : prev.mapApiKey
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none dark:bg-gray-700 dark:text-white"
                  >
                    <option value="leaflet">Leaflet (Default)</option>
                    <option value="google">Google Maps</option>
                    <option value="mapbox">Mapbox</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                </div>
              </div>

              {/* Map API Key (Conditional) */}
              {(systemSettings.mapProvider === 'google' || systemSettings.mapProvider === 'mapbox') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    {systemSettings.mapProvider === 'google' ? 'Google Maps' : 'Mapbox'} API Key
                    <span className="ml-2 text-xs text-red-600 dark:text-red-400">*Required</span>
                  </label>
                  <input
                    type="password"
                    value={systemSettings.mapApiKey}
                    onChange={(e) => setSystemSettings(prev => ({
                      ...prev,
                      mapApiKey: e.target.value
                    }))}
                    placeholder="Enter API key..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={saveSystemSettings}
                disabled={saving.system || !hasUnsavedChanges.system}
                className="bg-blue-600 dark:bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {saving.system ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save System Settings
                  </>
                )}
              </button>
            </div>
          </div>

          {/* SMS Configuration Section (Coming Soon) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 opacity-60 relative">
            <div className="absolute top-4 right-4">
              <span className="px-3 py-1 text-xs font-semibold text-blue-800 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                Coming Soon
              </span>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <MessageSquare className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">SMS Configuration</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  SMS Provider
                </label>
                <div className="relative">
                  <select
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 cursor-not-allowed appearance-none dark:text-gray-400"
                  >
                    <option>Fast2SMS</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  disabled
                  placeholder="Enter Fast2SMS API key..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 cursor-not-allowed dark:text-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Sender ID
                </label>
                <input
                  type="text"
                  disabled
                  placeholder="CLDBRST"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 cursor-not-allowed dark:text-gray-400"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Enable SMS Alerts
                </label>
                <ToggleSwitch
                  enabled={false}
                  onChange={() => {}}
                  disabled
                  ariaLabel="Enable SMS alerts"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                disabled
                className="bg-gray-400 dark:bg-gray-600 text-white px-6 py-2 rounded-lg cursor-not-allowed flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4" />
                Test SMS
              </button>
              <button
                disabled
                className="bg-gray-400 dark:bg-gray-600 text-white px-6 py-2 rounded-lg cursor-not-allowed flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                Save SMS Settings
              </button>
            </div>
          </div>

          {/* Notification Settings Section (Coming Soon) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 opacity-60 relative">
            <div className="absolute top-4 right-4">
              <span className="px-3 py-1 text-xs font-semibold text-blue-800 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                Coming Soon
              </span>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <Bell className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Notification Settings</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white">
                    Email Notifications
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Receive alerts via email</p>
                </div>
                <input
                  type="checkbox"
                  disabled
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 cursor-not-allowed"
                />
              </div>

              <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white">
                    Browser Push Notifications
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Receive alerts in browser</p>
                </div>
                <input
                  type="checkbox"
                  disabled
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 cursor-not-allowed"
                />
              </div>

              <div className="py-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Webhook URL
                </label>
                <input
                  type="url"
                  disabled
                  placeholder="https://example.com/webhook"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 cursor-not-allowed dark:text-gray-400"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Send POST requests to this URL when alerts are triggered
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                disabled
                className="bg-gray-400 dark:bg-gray-600 text-white px-6 py-2 rounded-lg cursor-not-allowed flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                Save Notification Settings
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add custom animation styles */}
      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

