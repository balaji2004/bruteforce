// src/app/alerts/page.js
'use client';

import { useState, useEffect } from 'react';
import { database, ref, onValue, update, set } from '@/lib/firebase';
import { formatDateTime, generateId } from '@/lib/utils';
import { AlertTriangle, CheckCircle, XCircle, Send } from 'lucide-react';

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [nodes, setNodes] = useState({});
  const [contacts, setContacts] = useState({});
  const [filter, setFilter] = useState('all'); // all, active, acknowledged
  const [showManualAlert, setShowManualAlert] = useState(false);
  const [manualAlertForm, setManualAlertForm] = useState({
    nodeId: '',
    severity: 'warning',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    // Load alerts
    const alertsRef = ref(database, 'alerts');
    const unsubscribeAlerts = onValue(alertsRef, (snapshot) => {
      const data = snapshot.val() || {};
      const alertsArray = Object.entries(data).map(([id, alert]) => ({
        id,
        ...alert
      })).sort((a, b) => b.timestamp - a.timestamp);
      setAlerts(alertsArray);
    });

    // Load nodes
    const nodesRef = ref(database, 'nodes');
    const unsubscribeNodes = onValue(nodesRef, (snapshot) => {
      setNodes(snapshot.val() || {});
    });

    // Load contacts
    const contactsRef = ref(database, 'contacts');
    const unsubscribeContacts = onValue(contactsRef, (snapshot) => {
      setContacts(snapshot.val() || {});
    });

    return () => {
      unsubscribeAlerts();
      unsubscribeNodes();
      unsubscribeContacts();
    };
  }, []);

  const handleAcknowledge = async (alertId) => {
    try {
      await update(ref(database, `alerts/${alertId}`), {
        acknowledged: true,
        acknowledgedBy: 'analytical',
        acknowledgedAt: Date.now()
      });
      setMessage({ type: 'success', text: 'Alert acknowledged' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to acknowledge alert' });
    }
  };

  const handleSendManualAlert = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const alertId = generateId('alert');
      const selectedNode = nodes[manualAlertForm.nodeId];
      
      // Get contacts for this node
      const nodeContacts = Object.values(contacts).filter(contact => 
        contact.associatedNodes?.includes(manualAlertForm.nodeId)
      );
      const recipients = nodeContacts.map(c => c.phone);

      const alertData = {
        id: alertId,
        nodeId: manualAlertForm.nodeId,
        type: 'manual',
        severity: manualAlertForm.severity,
        message: manualAlertForm.message,
        timestamp: Date.now(),
        acknowledged: false,
        acknowledgedBy: null,
        acknowledgedAt: null,
        sentSMS: false, // Would be true if SMS API is configured
        smsSentAt: null,
        recipients
      };

      await set(ref(database, `alerts/${alertId}`), alertData);

      setMessage({ 
        type: 'success', 
        text: `Alert created! Would send SMS to ${recipients.length} contact(s) if SMS is configured.` 
      });
      
      setManualAlertForm({
        nodeId: '',
        severity: 'warning',
        message: '',
      });
      setShowManualAlert(false);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'active') return !alert.acknowledged;
    if (filter === 'acknowledged') return alert.acknowledged;
    return true;
  });

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-700';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-700';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
      default: return <AlertTriangle className="h-5 w-5 text-gray-600 dark:text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Alerts & Notifications</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Monitor and manage system alerts
            </p>
          </div>
          <button
            onClick={() => setShowManualAlert(!showManualAlert)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors flex items-center gap-2"
          >
            <Send className="h-5 w-5" />
            Send Manual Alert
          </button>
        </div>

        {message.text && (
          <div className={`p-4 rounded-lg mb-6 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-700'
              : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Manual Alert Form */}
        {showManualAlert && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Send Manual Alert</h2>
            <form onSubmit={handleSendManualAlert} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Node *
                  </label>
                  <select
                    value={manualAlertForm.nodeId}
                    onChange={(e) => setManualAlertForm(prev => ({ ...prev, nodeId: e.target.value }))}
                    required
                    className="input-field"
                  >
                    <option value="">Select node</option>
                    {Object.keys(nodes).map(nodeId => (
                      <option key={nodeId} value={nodeId}>
                        {nodes[nodeId]?.metadata?.name || nodeId}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Severity *
                  </label>
                  <select
                    value={manualAlertForm.severity}
                    onChange={(e) => setManualAlertForm(prev => ({ ...prev, severity: e.target.value }))}
                    className="input-field"
                  >
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Alert Message *
                </label>
                <textarea
                  value={manualAlertForm.message}
                  onChange={(e) => setManualAlertForm(prev => ({ ...prev, message: e.target.value }))}
                  required
                  rows={3}
                  className="input-field"
                  placeholder="Enter alert message to send to contacts..."
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Alert'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowManualAlert(false)}
                  className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md mb-6">
          <div className="flex border-b dark:border-gray-700">
            <button
              onClick={() => setFilter('all')}
              className={`px-6 py-3 font-medium ${
                filter === 'all'
                  ? 'border-b-2 border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              All Alerts ({alerts.length})
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-6 py-3 font-medium ${
                filter === 'active'
                  ? 'border-b-2 border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              Active ({alerts.filter(a => !a.acknowledged).length})
            </button>
            <button
              onClick={() => setFilter('acknowledged')}
              className={`px-6 py-3 font-medium ${
                filter === 'acknowledged'
                  ? 'border-b-2 border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              Acknowledged ({alerts.filter(a => a.acknowledged).length})
            </button>
          </div>
        </div>

        {/* Alerts List */}
        <div className="space-y-4">
          {filteredAlerts.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center text-gray-500 dark:text-gray-400">
              No alerts found
            </div>
          ) : (
            filteredAlerts.map(alert => (
              <div
                key={alert.id}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-l-4 ${
                  alert.severity === 'critical' ? 'border-red-600 dark:border-red-500' : 'border-yellow-600 dark:border-yellow-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getSeverityIcon(alert.severity)}
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getSeverityColor(alert.severity)}`}>
                        {alert.severity.toUpperCase()}
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                        {alert.type === 'manual' ? 'Manual' : 'Automatic'}
                      </span>
                      {alert.acknowledged && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Acknowledged
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {nodes[alert.nodeId]?.metadata?.name || alert.nodeId}
                    </h3>

                    <p className="text-gray-700 dark:text-gray-300 mb-3">{alert.message}</p>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <div>
                        <span className="font-medium">Time:</span> {formatDateTime(alert.timestamp)}
                      </div>
                      {alert.recipients && alert.recipients.length > 0 && (
                        <div>
                          <span className="font-medium">Recipients:</span> {alert.recipients.length} contact(s)
                        </div>
                      )}
                      {alert.acknowledged && (
                        <div>
                          <span className="font-medium">Acknowledged by:</span> {alert.acknowledgedBy} at {formatDateTime(alert.acknowledgedAt)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="ml-4">
                    {!alert.acknowledged && (
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 transition-colors flex items-center gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}