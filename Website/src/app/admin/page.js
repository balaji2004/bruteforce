// src/app/admin/page.js
'use client';

import { useState, useEffect, useRef } from 'react';
import { database, ref, onValue, update, remove, set, query, limitToLast, get } from '@/lib/firebase';
import { formatTimeAgo, formatDateTime, getNodeStatus, generateId } from '@/lib/utils';
import { sendSMSNotification, sendInAppNotification, getSMSStatus } from '@/lib/notifications';
import { 
  Shield, Users, AlertTriangle, FileText, BarChart, Database,
  Edit, Trash2, Eye, Download, Upload, Activity, CheckCircle, 
  Bell, MessageSquare, Search, X, ChevronLeft, ChevronRight,
  Plus, Filter, Calendar, XCircle, Navigation, MapPin, Locate
} from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import MapContainer for coordinate picker
const MapPicker = dynamic(() => import('react-leaflet').then(mod => {
  const { MapContainer, TileLayer, Marker, useMapEvents } = mod;
  
  function LocationMarker({ position, setPosition }) {
    useMapEvents({
      click(e) {
        setPosition(e.latlng);
      },
    });
    
    return position ? <Marker position={position} /> : null;
  }
  
  return function MapPickerComponent({ position, setPosition }) {
    return (
      <MapContainer
        center={position || [20.5937, 78.9629]}
        zoom={position ? 13 : 5}
        style={{ height: '400px', width: '100%' }}
        className="rounded-lg"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <LocationMarker position={position} setPosition={setPosition} />
      </MapContainer>
    );
  };
}), { ssr: false });

export default function AnalyticalPanel() {
  // State management
  const [nodes, setNodes] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [contacts, setContacts] = useState({});
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    uptime: 99.8,
    packetSuccessRate: 97.2,
    alertStats: { total: 0, critical: 0, warning: 0, today: 0 },
    smsDeliveryRate: 94.5
  });
  const [loading, setLoading] = useState(true);
  const [smsStatus, setSmsStatus] = useState(null);
  
  // Node management state
  const [selectedNode, setSelectedNode] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState(null);
  const [nodeSearchTerm, setNodeSearchTerm] = useState('');
  const [nodeSortBy, setNodeSortBy] = useState('name');
  const [currentPage, setCurrentPage] = useState(1);
  const nodesPerPage = 10;
  
  // Edit modal coordinate capture state
  const [coordinateCaptureMethod, setCoordinateCaptureMethod] = useState('manual'); // 'manual', 'gps', 'map'
  const [gpsLoading, setGpsLoading] = useState(false);
  const [mapPickerPosition, setMapPickerPosition] = useState(null);

  // Alert form state
  const [alertForm, setAlertForm] = useState({
    message: '',
    severity: 'warning',
    affectedNodes: [],
    sendSMS: false
  });
  const [recipients, setRecipients] = useState([]);
  const [showNodeSelector, setShowNodeSelector] = useState(false);
  const [nodeSearchInAlert, setNodeSearchInAlert] = useState('');

  // System logs state
  const [logFilter, setLogFilter] = useState('all');
  const [logDateRange, setLogDateRange] = useState('24h');
  const [logSearchTerm, setLogSearchTerm] = useState('');

  // Data management state
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [cleanupDays, setCleanupDays] = useState(30);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importPreview, setImportPreview] = useState(null);

  // Toast state
  const [toast, setToast] = useState({ show: false, type: '', message: '' });

  // Check SMS configuration status
  useEffect(() => {
    const checkSMSStatus = async () => {
      const status = await getSMSStatus();
      setSmsStatus(status);
      console.log('📱 SMS Configuration Status:', status);
    };
    checkSMSStatus();
  }, []);

  // Load data from Firebase
  useEffect(() => {
    // Load nodes
    const nodesRef = ref(database, 'nodes');
    const unsubscribeNodes = onValue(nodesRef, (snapshot) => {
      const data = snapshot.val() || {};
      setNodes(data);
    });

    // Load alerts
    const alertsRef = ref(database, 'alerts');
    const unsubscribeAlerts = onValue(alertsRef, (snapshot) => {
      const data = snapshot.val() || {};
      const alertsArray = Object.entries(data).map(([id, alert]) => ({
        id,
        ...alert
      })).sort((a, b) => b.timestamp - a.timestamp);
      setAlerts(alertsArray);

      // Calculate alert stats
      const today = new Date().setHours(0, 0, 0, 0);
      const todayAlerts = alertsArray.filter(a => a.timestamp >= today);
      setStats(prev => ({
        ...prev,
        alertStats: {
          total: alertsArray.length,
          critical: alertsArray.filter(a => a.severity === 'critical').length,
          warning: alertsArray.filter(a => a.severity === 'warning').length,
          today: todayAlerts.length
        }
      }));
    });

    // Load contacts
    const contactsRef = ref(database, 'contacts');
    const unsubscribeContacts = onValue(contactsRef, (snapshot) => {
      setContacts(snapshot.val() || {});
    });

    // Load logs
    const logsRef = query(ref(database, 'logs'), limitToLast(100));
    const unsubscribeLogs = onValue(logsRef, (snapshot) => {
      const data = snapshot.val() || {};
      const logsArray = Object.entries(data).map(([id, log]) => ({
        id,
        ...log
      })).sort((a, b) => b.timestamp - a.timestamp);
      setLogs(logsArray);
    });

    setLoading(false);

    return () => {
      unsubscribeNodes();
      unsubscribeAlerts();
      unsubscribeContacts();
      unsubscribeLogs();
    };
  }, []);

  // Calculate recipients when affected nodes change
  useEffect(() => {
    if (alertForm.affectedNodes.length === 0) {
      setRecipients([]);
      return;
    }

    const affectedContacts = Object.values(contacts).filter(contact =>
      contact.associatedNodes?.some(nodeId => 
        alertForm.affectedNodes.includes(nodeId)
      )
    );

    setRecipients(affectedContacts);
  }, [alertForm.affectedNodes, contacts]);

  // Show toast notification
  const showToast = (type, message) => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast({ show: false, type: '', message: '' }), 5000);
  };

  // Node Management Functions
  const handleEditNode = (node) => {
    setSelectedNode(node);
    setCoordinateCaptureMethod('manual');
    setMapPickerPosition(
      node.metadata?.latitude && node.metadata?.longitude
        ? { lat: parseFloat(node.metadata.latitude), lng: parseFloat(node.metadata.longitude) }
        : null
    );
    setShowEditModal(true);
  };

  const handleGPSCapture = () => {
    if (!navigator.geolocation) {
      showToast('error', 'Geolocation is not supported by your browser');
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        
        setSelectedNode(prev => ({
          ...prev,
          metadata: { 
            ...prev.metadata, 
            latitude: lat,
            longitude: lon
          }
        }));
        
        setMapPickerPosition({ lat, lng: lon });
        showToast('success', `GPS coordinates captured: ${lat.toFixed(6)}, ${lon.toFixed(6)}`);
        setGpsLoading(false);
      },
      (error) => {
        showToast('error', 'GPS capture failed: ' + error.message);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleMapPositionChange = (latlng) => {
    setMapPickerPosition(latlng);
    setSelectedNode(prev => ({
      ...prev,
      metadata: { 
        ...prev.metadata, 
        latitude: latlng.lat,
        longitude: latlng.lng
      }
    }));
  };

  const handleSaveNode = async () => {
    try {
      await update(ref(database, `nodes/${selectedNode.id}/metadata`), {
        name: selectedNode.metadata.name,
        description: selectedNode.metadata.description || '',
        type: selectedNode.metadata.type || 'sensor',
        latitude: parseFloat(selectedNode.metadata.latitude) || 0,
        longitude: parseFloat(selectedNode.metadata.longitude) || 0,
        altitude: parseFloat(selectedNode.metadata.altitude) || 0,
        nearbyNodes: selectedNode.metadata.nearbyNodes || []
      });

      showToast('success', 'Node updated successfully');
      setShowEditModal(false);
      setSelectedNode(null);

      // Log the edit
      const logId = generateId('log');
      await set(ref(database, `logs/${logId}`), {
        id: logId,
        type: 'node_edit',
        message: `Node ${selectedNode.id} was edited`,
        timestamp: Date.now(),
        metadata: { nodeId: selectedNode.id }
      });
    } catch (error) {
      showToast('error', `Failed to update node: ${error.message}`);
    }
  };

  const handleDeleteNode = async () => {
    try {
      await remove(ref(database, `nodes/${nodeToDelete}`));
      
      showToast('success', 'Node deleted successfully');
      setShowDeleteDialog(false);
      setNodeToDelete(null);

      // Log the deletion
      const logId = generateId('log');
      await set(ref(database, `logs/${logId}`), {
        id: logId,
        type: 'node_deletion',
        message: `Node ${nodeToDelete} was deleted`,
        timestamp: Date.now(),
        metadata: { nodeId: nodeToDelete }
      });
    } catch (error) {
      showToast('error', `Could not delete node. Try again: ${error.message}`);
    }
  };

  const confirmDeleteNode = (nodeId) => {
    setNodeToDelete(nodeId);
    setShowDeleteDialog(true);
  };

  const scrollToLogs = (nodeId) => {
    setLogSearchTerm(nodeId);
    document.getElementById('system-logs')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Alert Creation Functions
  const handleCreateAlert = async (e) => {
    e.preventDefault();

    if (alertForm.message.length > 500) {
      showToast('error', 'Message must be 500 characters or less');
      return;
    }

    if (alertForm.affectedNodes.length === 0) {
      showToast('error', 'Please select at least one node');
      return;
    }

    try {
      console.log('🚨 Creating alert...');
      const alertId = generateId('alert');
      const recipientPhones = recipients.map(c => c.phone);
      const now = Date.now();

      const alertData = {
        id: alertId,
        type: 'manual',
        severity: alertForm.severity,
        message: alertForm.message,
        affectedNodes: alertForm.affectedNodes,
        timestamp: now,
        acknowledged: false,
        acknowledgedBy: null,
        acknowledgedAt: null,
        sentSMS: alertForm.sendSMS,
        smsSentAt: alertForm.sendSMS ? now : null,
        recipients: recipientPhones,
        createdBy: 'analytical',
        source: 'analytical_panel'
      };

      console.log('📤 Alert data:', alertData);

      // Save alert to Firebase
      await set(ref(database, `alerts/${alertId}`), alertData);
      console.log('✅ Alert saved to Firebase with ID:', alertId);

      // Verify alert was saved
      const verifySnapshot = await get(ref(database, `alerts/${alertId}`));
      if (!verifySnapshot.exists()) {
        throw new Error('Alert created but verification failed');
      }
      console.log('✅ Alert verified in database');

      // Update affected nodes with alert reference
      for (const nodeId of alertForm.affectedNodes) {
        const nodeAlertRef = ref(database, `nodes/${nodeId}/alerts/${alertId}`);
        await set(nodeAlertRef, {
          alertId,
          severity: alertForm.severity,
          timestamp: now,
          acknowledged: false
        });
        console.log(`✅ Alert linked to node: ${nodeId}`);
      }

      // Log the alert creation
      const logId = generateId('log');
      await set(ref(database, `logs/${logId}`), {
        id: logId,
        type: 'alert_triggered',
        message: `Manual alert created affecting ${alertForm.affectedNodes.length} node(s): "${alertForm.message.substring(0, 50)}${alertForm.message.length > 50 ? '...' : ''}"`,
        timestamp: now,
        metadata: { 
          alertId, 
          affectedNodes: alertForm.affectedNodes,
          severity: alertForm.severity,
          recipients: recipientPhones.length
        }
      });
      console.log('✅ Alert logged in system logs');

      // Send notifications
      let smsResult = null;
      if (alertForm.sendSMS && recipientPhones.length > 0) {
        console.log('📱 Sending SMS notifications...');
        smsResult = await sendSMSNotification({
          recipients: recipientPhones,
          message: `[${alertForm.severity.toUpperCase()}] ${alertForm.message}`,
          alertId,
          severity: alertForm.severity
        });
        
        if (smsResult.success) {
          console.log('✅ SMS notifications sent successfully');
          showToast('success', `SMS sent to ${smsResult.recipients} recipient(s)!`);
        } else if (!smsResult.configured) {
          console.log('⚠️ SMS service not configured - notification logged');
          showToast('warning', 'SMS service not configured. Notification logged for future delivery.');
        } else {
          console.log('❌ SMS send failed:', smsResult.error);
          showToast('error', 'Failed to send SMS: ' + smsResult.message);
        }
      }
      
      // Create in-app notification
      console.log('🔔 Creating in-app notification...');
      const inAppResult = await sendInAppNotification({
        alertId,
        message: alertForm.message,
        severity: alertForm.severity,
        affectedNodes: alertForm.affectedNodes
      });
      
      if (inAppResult.success) {
        console.log('✅ In-app notification created');
      }

      // Show success message
      const successMessage = smsResult?.success 
        ? `Alert created and SMS sent to ${recipientPhones.length} recipient(s)! ${alertForm.affectedNodes.length} node(s) affected.`
        : `Alert created successfully! ${alertForm.affectedNodes.length} node(s) affected, ${recipientPhones.length} contact(s) identified.`;
      
      showToast('success', successMessage);

      // Show option to view alerts
      setTimeout(() => {
        const viewAlerts = window.confirm(
          `Alert created successfully!\n\n` +
          `ID: ${alertId}\n` +
          `Severity: ${alertForm.severity.toUpperCase()}\n` +
          `Affected Nodes: ${alertForm.affectedNodes.length}\n` +
          `Recipients: ${recipientPhones.length}\n\n` +
          `Click OK to view all alerts or Cancel to stay here.`
        );
        
        if (viewAlerts) {
          window.location.href = '/alerts';
        }
      }, 500);
      
      // Clear form
      setAlertForm({
        message: '',
        severity: 'warning',
        affectedNodes: [],
        sendSMS: false
      });
      
      console.log('🎉 Alert creation complete!');
    } catch (error) {
      console.error('❌ Failed to create alert:', error);
      showToast('error', `Failed to create alert: ${error.message}`);
    }
  };

  const toggleNodeSelection = (nodeId) => {
    setAlertForm(prev => ({
      ...prev,
      affectedNodes: prev.affectedNodes.includes(nodeId)
        ? prev.affectedNodes.filter(id => id !== nodeId)
        : [...prev.affectedNodes, nodeId]
    }));
  };

  const selectAllNodes = () => {
    setAlertForm(prev => ({
      ...prev,
      affectedNodes: Object.keys(nodes)
    }));
  };

  const deselectAllNodes = () => {
    setAlertForm(prev => ({
      ...prev,
      affectedNodes: []
    }));
  };

  // System Logs Functions
  const getLogIcon = (type) => {
    switch (type) {
      case 'node_registration':
        return <div className="text-blue-600"><Users className="h-5 w-5" /></div>;
      case 'alert_triggered':
        return <div className="text-red-600"><AlertTriangle className="h-5 w-5" /></div>;
      case 'sms_sent':
        return <div className="text-green-600"><MessageSquare className="h-5 w-5" /></div>;
      case 'system_error':
        return <div className="text-orange-600"><XCircle className="h-5 w-5" /></div>;
      case 'data_received':
        return <div className="text-gray-600"><Database className="h-5 w-5" /></div>;
      case 'node_edit':
        return <div className="text-blue-600"><Edit className="h-5 w-5" /></div>;
      case 'node_deletion':
        return <div className="text-red-600"><Trash2 className="h-5 w-5" /></div>;
      default:
        return <div className="text-gray-600"><FileText className="h-5 w-5" /></div>;
    }
  };

  const getLogTypeLabel = (type) => {
    switch (type) {
      case 'node_registration': return 'Node Registration';
      case 'alert_triggered': return 'Alert Triggered';
      case 'sms_sent': return 'SMS Sent';
      case 'system_error': return 'System Error';
      case 'data_received': return 'Data Received';
      case 'node_edit': return 'Node Edited';
      case 'node_deletion': return 'Node Deleted';
      default: return 'System Event';
    }
  };

  const exportLogsToCSV = () => {
    const headers = ['Timestamp', 'Type', 'Message'];
    const csvContent = [
      headers.join(','),
      ...filteredLogs.map(log => [
        formatDateTime(log.timestamp),
        getLogTypeLabel(log.type),
        `"${log.message}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system_logs_${Date.now()}.csv`;
    a.click();
    showToast('success', 'Logs exported to CSV');
  };

  // Data Management Functions
  const handleCleanupOldData = async () => {
    try {
      const cutoffTime = Date.now() - (cleanupDays * 24 * 60 * 60 * 1000);
      let deletedCount = 0;

      for (const nodeId in nodes) {
        const history = nodes[nodeId].history || {};
        for (const timestamp in history) {
          if (parseInt(timestamp) < cutoffTime) {
            await remove(ref(database, `nodes/${nodeId}/history/${timestamp}`));
            deletedCount++;
          }
        }
      }

      showToast('success', `Cleaned up ${deletedCount} old data points`);
      setShowCleanupDialog(false);

      // Log cleanup
      const logId = generateId('log');
      await set(ref(database, `logs/${logId}`), {
        id: logId,
        type: 'data_cleanup',
        message: `Cleaned up ${deletedCount} data points older than ${cleanupDays} days`,
        timestamp: Date.now(),
        metadata: { deletedCount, cleanupDays }
      });
    } catch (error) {
      showToast('error', `Failed to clean up data: ${error.message}`);
    }
  };

  const handleExportAllData = async () => {
    try {
      const exportData = {
        nodes,
        alerts: alerts.reduce((acc, alert) => ({ ...acc, [alert.id]: alert }), {}),
        contacts,
        logs: logs.reduce((acc, log) => ({ ...acc, [log.id]: log }), {}),
        exportDate: Date.now()
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().split('T')[0];
      a.download = `cloudburst_data_${date}.json`;
      a.click();

      showToast('success', 'Data exported successfully');
    } catch (error) {
      showToast('error', `Failed to export data: ${error.message}`);
    }
  };

  const handleImportData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        setImportPreview(data);
        setShowImportDialog(true);
      } catch (error) {
        showToast('error', 'Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  const confirmImportData = async () => {
    try {
      if (importPreview.nodes) {
        await set(ref(database, 'nodes'), importPreview.nodes);
      }
      if (importPreview.alerts) {
        await set(ref(database, 'alerts'), importPreview.alerts);
      }
      if (importPreview.contacts) {
        await set(ref(database, 'contacts'), importPreview.contacts);
      }

      showToast('success', 'Data imported successfully');
      setShowImportDialog(false);
      setImportPreview(null);

      // Log import
      const logId = generateId('log');
      await set(ref(database, `logs/${logId}`), {
        id: logId,
        type: 'data_import',
        message: 'Historical data was imported',
        timestamp: Date.now()
      });
    } catch (error) {
      showToast('error', `Failed to import data: ${error.message}`);
    }
  };

  const handleResetSystem = async () => {
    if (resetConfirmText !== 'DELETE') {
      showToast('error', 'Please type DELETE to confirm');
      return;
    }

    try {
      await remove(ref(database, 'nodes'));
      await remove(ref(database, 'alerts'));
      await remove(ref(database, 'contacts'));
      await remove(ref(database, 'logs'));

      showToast('success', 'System reset complete');
      setShowResetDialog(false);
      setResetConfirmText('');
    } catch (error) {
      showToast('error', `Failed to reset system: ${error.message}`);
    }
  };

  // Filtering and pagination
  const filteredNodes = Object.entries(nodes)
    .filter(([nodeId, node]) => {
      const searchLower = nodeSearchTerm.toLowerCase();
      const nodeName = node.metadata?.name?.toLowerCase() || '';
      return nodeId.toLowerCase().includes(searchLower) || nodeName.includes(searchLower);
    })
    .sort(([aId, a], [bId, b]) => {
      switch (nodeSortBy) {
        case 'name':
          return (a.metadata?.name || aId).localeCompare(b.metadata?.name || bId);
        case 'status':
          return getNodeStatus(b.realtime?.lastUpdate).localeCompare(getNodeStatus(a.realtime?.lastUpdate));
        case 'lastSeen':
          const aTime = a.realtime?.lastUpdate ? (typeof a.realtime.lastUpdate === 'string' ? parseInt(a.realtime.lastUpdate) * 1000 : a.realtime.lastUpdate) : 0;
          const bTime = b.realtime?.lastUpdate ? (typeof b.realtime.lastUpdate === 'string' ? parseInt(b.realtime.lastUpdate) * 1000 : b.realtime.lastUpdate) : 0;
          return bTime - aTime;
        default:
          return 0;
      }
    });

  const paginatedNodes = filteredNodes.slice(
    (currentPage - 1) * nodesPerPage,
    currentPage * nodesPerPage
  );
  const totalPages = Math.ceil(filteredNodes.length / nodesPerPage);

  const filteredLogs = logs.filter(log => {
    // Filter by type
    if (logFilter !== 'all') {
      const typeMap = {
        registrations: 'node_registration',
        alerts: 'alert_triggered',
        sms: 'sms_sent',
        errors: 'system_error'
      };
      if (log.type !== typeMap[logFilter]) return false;
    }

    // Filter by date range
    const now = Date.now();
    let cutoff;
    switch (logDateRange) {
      case '24h': cutoff = now - (24 * 60 * 60 * 1000); break;
      case '7d': cutoff = now - (7 * 24 * 60 * 60 * 1000); break;
      case '30d': cutoff = now - (30 * 24 * 60 * 60 * 1000); break;
      default: cutoff = 0;
    }
    if (log.timestamp < cutoff) return false;

    // Filter by search term
    if (logSearchTerm && !log.message.toLowerCase().includes(logSearchTerm.toLowerCase())) {
      return false;
    }

    return true;
  });

  const filteredNodesForAlert = Object.entries(nodes).filter(([nodeId, node]) => {
    const searchLower = nodeSearchInAlert.toLowerCase();
    const nodeName = node.metadata?.name?.toLowerCase() || '';
    return nodeId.toLowerCase().includes(searchLower) || nodeName.includes(searchLower);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytical panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytical Panel</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">System management, alerts, and monitoring</p>
        </div>

        {/* Toast Notification */}
        {toast.show && (
          <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg alert-enter ${
            toast.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-700' :
            toast.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-700' :
            'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700'
          }`}>
            <div className="flex items-center gap-2">
              {toast.type === 'success' && <CheckCircle className="h-5 w-5" />}
              {toast.type === 'error' && <XCircle className="h-5 w-5" />}
              {toast.type === 'warning' && <AlertTriangle className="h-5 w-5" />}
              <span>{toast.message}</span>
              <button onClick={() => setToast({ show: false, type: '', message: '' })}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Statistics Dashboard */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart className="h-6 w-6 text-gray-700 dark:text-gray-300" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Statistics Dashboard</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* System Uptime */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-2">
                <Activity className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.uptime}%</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">System Uptime</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Last 30 days</p>
            </div>

            {/* Packet Success Rate */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.packetSuccessRate}%</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Packet Success Rate</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Average across all nodes</p>
            </div>

            {/* Alert Statistics */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-2">
                <Bell className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.alertStats.total}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Alerts</p>
              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                <span className="text-red-600 dark:text-red-400">Critical: {stats.alertStats.critical}</span>
                {' | '}
                <span className="text-yellow-600 dark:text-yellow-400">Warning: {stats.alertStats.warning}</span>
                <br />
                <span>Today: {stats.alertStats.today}</span>
              </div>
            </div>

            {/* SMS Delivery Rate */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 relative">
              <div className="absolute top-2 right-2">
                <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full">Coming soon</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <MessageSquare className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.smsDeliveryRate}%</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">SMS Delivery Rate</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Last 100 messages</p>
            </div>
          </div>

          {/* Node Health Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Node Health Overview</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Node ID</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Type</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Last Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {Object.entries(nodes).slice(0, 5).map(([nodeId, node]) => {
                    const status = getNodeStatus(node.realtime?.lastUpdate);
                    const lastUpdateTime = node.realtime?.lastUpdate 
                      ? (typeof node.realtime.lastUpdate === 'string' 
                          ? parseInt(node.realtime.lastUpdate) * 1000 
                          : node.realtime.lastUpdate)
                      : null;
                    return (
                      <tr key={nodeId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                          {node.metadata?.name || nodeId}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            status === 'online' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                          }`}>
                            <span className={`w-2 h-2 rounded-full mr-1 ${
                              status === 'online' ? 'bg-green-500' : 'bg-red-500'
                            }`}></span>
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            node.metadata?.type === 'gateway' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                          }`}>
                            {node.metadata?.type || 'Node'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {formatTimeAgo(lastUpdateTime)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Node Management */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-6 w-6 text-gray-700 dark:text-gray-300" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Node Management</h2>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            {/* Search and Filter */}
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search nodes..."
                    value={nodeSearchTerm}
                    onChange={(e) => setNodeSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <select
                value={nodeSortBy}
                onChange={(e) => setNodeSortBy(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="name">Sort by Name</option>
                <option value="status">Sort by Status</option>
                <option value="lastSeen">Sort by Last Seen</option>
              </select>
            </div>

            {/* Nodes Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Node ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Last Seen</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedNodes.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        No nodes found
                      </td>
                    </tr>
                  ) : (
                    paginatedNodes.map(([nodeId, node]) => {
                      const status = getNodeStatus(node.realtime?.lastUpdate);
                      const lastUpdateTime = node.realtime?.lastUpdate
                        ? (typeof node.realtime.lastUpdate === 'string'
                            ? parseInt(node.realtime.lastUpdate) * 1000
                            : node.realtime.lastUpdate)
                        : null;
                      return (
                        <tr key={nodeId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-3 text-sm font-mono text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">
                            {nodeId}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {node.metadata?.name || 'Unnamed'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              node.metadata?.type === 'gateway' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                            }`}>
                              {node.metadata?.type || 'Node'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              status === 'online' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                            }`}>
                              <span className={`w-2 h-2 rounded-full mr-1 ${
                                status === 'online' ? 'bg-green-500' : 'bg-red-500'
                              }`}></span>
                              {status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                            {formatTimeAgo(lastUpdateTime)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditNode({ id: nodeId, ...node })}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => confirmDeleteNode(nodeId)}
                                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => scrollToLogs(nodeId)}
                                className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300"
                                title="View Logs"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {((currentPage - 1) * nodesPerPage) + 1} to {Math.min(currentPage * nodesPerPage, filteredNodes.length)} of {filteredNodes.length} nodes
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-4 py-1 text-sm text-gray-600 dark:text-gray-400">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Manual Alert Creation */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-gray-700 dark:text-gray-300" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Manual Alert Creation</h2>
            </div>
            <a
              href="/alerts"
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors shadow-md hover:shadow-lg"
            >
              <Bell className="h-4 w-4" />
              View All Alerts ({alerts.length})
            </a>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">How Alerts Work</h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                    <li>✅ Alerts are saved to Firebase database instantly</li>
                    <li>✅ All affected nodes will be linked to this alert</li>
                    <li>✅ Emergency contacts for selected nodes will be identified</li>
                    <li>✅ In-app notifications created for dashboard</li>
                    <li>✅ View all alerts on the <a href="/alerts" className="underline font-semibold">Alerts Page</a></li>
                  </ul>

                  {/* SMS Status */}
                  <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4" />
                      <span className="font-semibold text-blue-900 dark:text-blue-200">SMS Notification Status:</span>
                    </div>
                    {smsStatus && (
                      <div className="text-sm">
                        {smsStatus.configured ? (
                          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                            <CheckCircle className="h-4 w-4" />
                            <span>✅ SMS service is configured and ready</span>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400 mb-2">
                              <AlertTriangle className="h-4 w-4" />
                              <span>⚠️ SMS service not configured</span>
                            </div>
                            <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 rounded p-2 text-orange-800 dark:text-orange-300">
                              <p className="font-semibold mb-1">SMS notifications will be logged only</p>
                              <p className="text-xs">To enable actual SMS sending, configure Twilio in your environment variables.</p>
                              <p className="text-xs mt-1">
                                See <code className="bg-orange-100 dark:bg-orange-900/50 px-1 rounded">SMS_SETUP_GUIDE.md</code> for instructions
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleCreateAlert} className="space-y-4">
              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Message *
                </label>
                <textarea
                  value={alertForm.message}
                  onChange={(e) => setAlertForm(prev => ({ ...prev, message: e.target.value }))}
                  required
                  maxLength={500}
                  rows={4}
                  placeholder="Enter alert message..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {alertForm.message.length}/500 characters
                </p>
              </div>

              {/* Severity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Severity *
                </label>
                <select
                  value={alertForm.severity}
                  onChange={(e) => setAlertForm(prev => ({ ...prev, severity: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="warning">⚠️ Warning</option>
                  <option value="critical">🔴 Critical</option>
                </select>
              </div>

              {/* Affected Nodes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Affected Nodes * ({alertForm.affectedNodes.length} selected)
                </label>
                <div className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex gap-2 mb-3">
                    <button
                      type="button"
                      onClick={selectAllNodes}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                    >
                      Select All
                    </button>
                    <span className="text-gray-400 dark:text-gray-500">|</span>
                    <button
                      type="button"
                      onClick={deselectAllNodes}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                    >
                      Deselect All
                    </button>
                  </div>

                  <div className="mb-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                      <input
                        type="text"
                        placeholder="Search nodes..."
                        value={nodeSearchInAlert}
                        onChange={(e) => setNodeSearchInAlert(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {filteredNodesForAlert.map(([nodeId, node]) => (
                      <label key={nodeId} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-600 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={alertForm.affectedNodes.includes(nodeId)}
                          onChange={() => toggleNodeSelection(nodeId)}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-200">
                          {node.metadata?.name || nodeId}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-500">({nodeId})</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recipients */}
              {recipients.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Recipients ({recipients.length})
                  </label>
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700 max-h-32 overflow-y-auto">
                    {recipients.map((contact, idx) => (
                      <div key={idx} className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        {contact.name} ({contact.phone})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Send SMS */}
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={alertForm.sendSMS}
                    onChange={(e) => setAlertForm(prev => ({ ...prev, sendSMS: e.target.checked }))}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Send SMS to recipients</span>
                </label>
                {alertForm.sendSMS && recipients.length > 0 && (
                  <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1 ml-6">
                    ⚠️ This will send SMS to {recipients.length} recipient(s)
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-md hover:shadow-lg"
                >
                  <Bell className="h-4 w-4" />
                  Create & Send Alert
                </button>
                <button
                  type="button"
                  onClick={() => setAlertForm({ message: '', severity: 'warning', affectedNodes: [], sendSMS: false })}
                  className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-6 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Reset Form
                </button>
                <a
                  href="/alerts"
                  className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-6 py-2 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors flex items-center gap-2 border border-orange-300 dark:border-orange-700"
                >
                  <Eye className="h-4 w-4" />
                  View Alerts Page
                </a>
              </div>
            </form>
          </div>
        </section>

        {/* System Logs */}
        <section className="mb-6" id="system-logs">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-6 w-6 text-gray-700 dark:text-gray-300" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">System Logs</h2>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Filter className="inline h-4 w-4 mr-1" />
                  Event Type
                </label>
                <select
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Events</option>
                  <option value="registrations">Registrations</option>
                  <option value="alerts">Alerts</option>
                  <option value="sms">SMS</option>
                  <option value="errors">Errors</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  Date Range
                </label>
                <select
                  value={logDateRange}
                  onChange={(e) => setLogDateRange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Search className="inline h-4 w-4 mr-1" />
                  Search
                </label>
                <input
                  type="text"
                  value={logSearchTerm}
                  onChange={(e) => setLogSearchTerm(e.target.value)}
                  placeholder="Search logs..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing {filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''}
              </p>
              <button
                onClick={exportLogsToCSV}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
              >
                <Download className="h-4 w-4" />
                Export to CSV
              </button>
            </div>

            {/* Logs List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No logs available yet
                </div>
              ) : (
                filteredLogs.map(log => (
                  <div key={log.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <div className="flex items-start gap-3">
                      {getLogIcon(log.type)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 dark:text-white">{getLogTypeLabel(log.type)}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-500">{formatDateTime(log.timestamp)}</span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{log.message}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Data Management */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Database className="h-6 w-6 text-gray-700 dark:text-gray-300" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Data Management</h2>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Clean Old Data */}
              <button
                onClick={() => setShowCleanupDialog(true)}
                className="p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all text-left"
              >
                <Database className="h-6 w-6 text-blue-600 dark:text-blue-400 mb-2" />
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Clean Old Data</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Remove historical data older than specified days</p>
              </button>

              {/* Export All Data */}
              <button
                onClick={handleExportAllData}
                className="p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 transition-all text-left"
              >
                <Download className="h-6 w-6 text-green-600 dark:text-green-400 mb-2" />
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Export All Data</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Download complete database as JSON file</p>
              </button>

              {/* Import Data */}
              <label className="p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-all text-left cursor-pointer">
                <Upload className="h-6 w-6 text-purple-600 dark:text-purple-400 mb-2" />
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Import Data</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Upload and import historical data</p>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportData}
                  className="hidden"
                />
              </label>

              {/* Load Sample Data */}
              <button
                onClick={async () => {
                  try {
                    const response = await fetch('/firebase-sample-data.json');
                    const sampleData = await response.json();
                    setImportPreview(sampleData);
                    setShowImportDialog(true);
                  } catch (error) {
                    showToast('error', 'Failed to load sample data: ' + error.message);
                  }
                }}
                className="p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 transition-all text-left"
              >
                <Database className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mb-2" />
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Load Sample Data</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Import demo nodes for testing</p>
              </button>

              {/* Manage Contacts */}
              <a
                href="/contacts"
                className="p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all text-left block"
              >
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400 mb-2" />
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Manage Contacts</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Add, edit, or remove emergency contacts</p>
              </a>

              {/* Reset System */}
              <button
                onClick={() => setShowResetDialog(true)}
                className="p-4 border-2 border-red-300 dark:border-red-700 rounded-lg hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all text-left"
              >
                <XCircle className="h-6 w-6 text-red-600 dark:text-red-400 mb-2" />
                <h3 className="font-semibold text-red-900 dark:text-red-400 mb-1">Reset System</h3>
                <p className="text-sm text-red-600 dark:text-red-400">⚠️ Delete all data (dangerous)</p>
              </button>
            </div>
          </div>
        </section>

        {/* Edit Node Modal */}
        {showEditModal && selectedNode && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Edit Node: {selectedNode.id}</h3>
                  <button onClick={() => setShowEditModal(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name</label>
                    <input
                      type="text"
                      value={selectedNode.metadata?.name || ''}
                      onChange={(e) => setSelectedNode(prev => ({
                        ...prev,
                        metadata: { ...prev.metadata, name: e.target.value }
                      }))}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                    <textarea
                      value={selectedNode.metadata?.description || ''}
                      onChange={(e) => setSelectedNode(prev => ({
                        ...prev,
                        metadata: { ...prev.metadata, description: e.target.value }
                      }))}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Node Type Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      🔌 Node Type
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedNode(prev => ({
                          ...prev,
                          metadata: { ...prev.metadata, type: 'gateway' }
                        }))}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                          selectedNode.metadata?.type === 'gateway'
                            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300 font-semibold shadow-sm'
                            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full ${
                          selectedNode.metadata?.type === 'gateway' ? 'bg-blue-500' : 'bg-gray-400'
                        } border-[3px] border-white dark:border-gray-800 shadow-sm`}></div>
                        <div className="text-left">
                          <div className="text-sm font-semibold">Gateway Node</div>
                          <div className="text-xs opacity-75">Network coordinator</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedNode(prev => ({
                          ...prev,
                          metadata: { ...prev.metadata, type: 'sensor' }
                        }))}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                          selectedNode.metadata?.type === 'sensor' || !selectedNode.metadata?.type
                            ? 'bg-green-50 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300 font-semibold shadow-sm'
                            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full ${
                          selectedNode.metadata?.type === 'sensor' || !selectedNode.metadata?.type ? 'bg-green-500' : 'bg-gray-400'
                        } border-2 border-white dark:border-gray-800 shadow-sm`}></div>
                        <div className="text-left">
                          <div className="text-sm font-semibold">Sensor Node</div>
                          <div className="text-xs opacity-75">Regular monitoring</div>
                        </div>
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                      {selectedNode.metadata?.type === 'gateway'
                        ? '🛰️ Gateway nodes coordinate the network and appear larger on the map'
                        : '📡 Sensor nodes collect environmental data and report to gateways'
                      }
                    </p>
                  </div>

                  {/* Coordinate Capture Method */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      📍 Location Capture Method
                    </label>
                    <div className="flex gap-2 mb-4">
                      <button
                        type="button"
                        onClick={() => setCoordinateCaptureMethod('manual')}
                        className={`flex-1 px-4 py-2.5 rounded-lg border transition-all ${
                          coordinateCaptureMethod === 'manual'
                            ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300 font-semibold'
                            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        <MapPin className="inline h-4 w-4 mr-2" />
                        Manual Entry
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCoordinateCaptureMethod('gps');
                          handleGPSCapture();
                        }}
                        disabled={gpsLoading}
                        className={`flex-1 px-4 py-2.5 rounded-lg border transition-all ${
                          coordinateCaptureMethod === 'gps'
                            ? 'bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300 font-semibold'
                            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <Navigation className="inline h-4 w-4 mr-2" />
                        {gpsLoading ? 'Getting GPS...' : 'Use GPS'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCoordinateCaptureMethod('map')}
                        className={`flex-1 px-4 py-2.5 rounded-lg border transition-all ${
                          coordinateCaptureMethod === 'map'
                            ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-500 text-purple-700 dark:text-purple-300 font-semibold'
                            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        <Locate className="inline h-4 w-4 mr-2" />
                        Pick on Map
                      </button>
                    </div>
                  </div>

                  {/* Map Picker (shown when map method is selected) */}
                  {coordinateCaptureMethod === 'map' && (
                    <div className="mb-4">
                      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3 mb-3">
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                          <Locate className="inline h-4 w-4 mr-1" />
                          <strong>Click anywhere on the map</strong> to set coordinates
                        </p>
                      </div>
                      <div className="border-2 border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                        <MapPicker
                          position={mapPickerPosition}
                          setPosition={handleMapPositionChange}
                        />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                        Click on the map to select the exact location for this node
                      </p>
                    </div>
                  )}

                  {/* Coordinate Inputs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Latitude
                        {mapPickerPosition && (
                          <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                            ✓ {coordinateCaptureMethod === 'gps' ? 'GPS' : coordinateCaptureMethod === 'map' ? 'Map' : ''}
                          </span>
                        )}
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        value={selectedNode.metadata?.latitude || 0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setSelectedNode(prev => ({
                            ...prev,
                            metadata: { ...prev.metadata, latitude: e.target.value }
                          }));
                          if (!isNaN(val) && selectedNode.metadata?.longitude) {
                            setMapPickerPosition({
                              lat: val,
                              lng: parseFloat(selectedNode.metadata.longitude)
                            });
                          }
                        }}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                        placeholder="e.g., 28.613900"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Range: -90 to 90</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Longitude
                        {mapPickerPosition && (
                          <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                            ✓ {coordinateCaptureMethod === 'gps' ? 'GPS' : coordinateCaptureMethod === 'map' ? 'Map' : ''}
                          </span>
                        )}
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        value={selectedNode.metadata?.longitude || 0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setSelectedNode(prev => ({
                            ...prev,
                            metadata: { ...prev.metadata, longitude: e.target.value }
                          }));
                          if (!isNaN(val) && selectedNode.metadata?.latitude) {
                            setMapPickerPosition({
                              lat: parseFloat(selectedNode.metadata.latitude),
                              lng: val
                            });
                          }
                        }}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                        placeholder="e.g., 77.209000"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Range: -180 to 180</p>
                    </div>
                  </div>

                  {/* Current Coordinates Display */}
                  {selectedNode.metadata?.latitude && selectedNode.metadata?.longitude && (
                    <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Current Coordinates:</p>
                      <p className="text-sm font-mono text-gray-900 dark:text-white">
                        {parseFloat(selectedNode.metadata.latitude).toFixed(6)}, {parseFloat(selectedNode.metadata.longitude).toFixed(6)}
                      </p>
                      <a
                        href={`https://www.google.com/maps?q=${selectedNode.metadata.latitude},${selectedNode.metadata.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
                      >
                        View on Google Maps →
                      </a>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Altitude (m)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={selectedNode.metadata?.altitude || 0}
                      onChange={(e) => setSelectedNode(prev => ({
                        ...prev,
                        metadata: { ...prev.metadata, altitude: e.target.value }
                      }))}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Nearby Nodes Configuration */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      🔗 Nearby Nodes Configuration
                    </label>
                    <div className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg p-4">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                        Select nodes that are in communication range or form part of this node&apos;s network mesh.
                        These connections will be visualized as lines on the map.
                      </p>

                      {/* Current nearby nodes */}
                      {selectedNode.metadata?.nearbyNodes && selectedNode.metadata.nearbyNodes.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Connected Nodes ({selectedNode.metadata.nearbyNodes.length}):
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {selectedNode.metadata.nearbyNodes.map((nearbyNodeId) => {
                              const nearbyNode = nodes[nearbyNodeId];
                              return (
                                <div
                                  key={nearbyNodeId}
                                  className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-3 py-1.5 rounded-lg text-sm"
                                >
                                  <span className="font-medium">
                                    {nearbyNode?.metadata?.name || nearbyNodeId}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedNode(prev => ({
                                        ...prev,
                                        metadata: {
                                          ...prev.metadata,
                                          nearbyNodes: prev.metadata.nearbyNodes.filter(id => id !== nearbyNodeId)
                                        }
                                      }));
                                    }}
                                    className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-200"
                                    title="Remove connection"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Add nearby node selector */}
                      <div>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Add Nearby Node:</p>
                        <select
                          onChange={(e) => {
                            const nodeIdToAdd = e.target.value;
                            if (nodeIdToAdd && nodeIdToAdd !== selectedNode.id) {
                              const currentNearby = selectedNode.metadata?.nearbyNodes || [];
                              if (!currentNearby.includes(nodeIdToAdd)) {
                                setSelectedNode(prev => ({
                                  ...prev,
                                  metadata: {
                                    ...prev.metadata,
                                    nearbyNodes: [...currentNearby, nodeIdToAdd]
                                  }
                                }));
                              }
                            }
                            e.target.value = ''; // Reset selector
                          }}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                          defaultValue=""
                        >
                          <option value="">Select a node to connect...</option>
                          {Object.entries(nodes)
                            .filter(([nodeId]) =>
                              nodeId !== selectedNode.id &&
                              !(selectedNode.metadata?.nearbyNodes || []).includes(nodeId)
                            )
                            .map(([nodeId, node]) => (
                              <option key={nodeId} value={nodeId}>
                                {node.metadata?.name || nodeId}
                                {node.metadata?.type === 'gateway' ? ' (Gateway)' : ' (Sensor)'}
                              </option>
                            ))
                          }
                        </select>
                      </div>

                      {/* Quick actions */}
                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedNode(prev => ({
                              ...prev,
                              metadata: { ...prev.metadata, nearbyNodes: [] }
                            }));
                          }}
                          className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
                        >
                          Clear All Connections
                        </button>
                      </div>

                      {selectedNode.metadata?.nearbyNodes && selectedNode.metadata.nearbyNodes.length === 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 italic">
                          No nearby nodes configured. This node will appear isolated on the map.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={handleSaveNode}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={() => setShowEditModal(false)}
                      className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-6 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Node Confirmation Dialog */}
        {showDeleteDialog && nodeToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Delete Node</h3>
              </div>

              <p className="text-gray-700 dark:text-gray-300 mb-6">
                Are you sure you want to delete <strong>{nodeToDelete}</strong>?
                This will remove all historical data. This action cannot be undone.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={handleDeleteNode}
                  className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Yes, Delete
                </button>
                <button
                  onClick={() => {
                    setShowDeleteDialog(false);
                    setNodeToDelete(null);
                  }}
                  className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-6 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cleanup Data Dialog */}
        {showCleanupDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Clean Old Data</h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Remove data older than:
                </label>
                <select
                  value={cleanupDays}
                  onChange={(e) => setCleanupDays(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                </select>
              </div>

              <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-6 bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded">
                ⚠️ This will delete all historical sensor data older than {cleanupDays} days.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={handleCleanupOldData}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Clean Data
                </button>
                <button
                  onClick={() => setShowCleanupDialog(false)}
                  className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-6 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import Data Dialog */}
        {showImportDialog && importPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Import Data Preview</h3>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <span className="font-medium text-gray-900 dark:text-white">Nodes:</span>
                  <span className="text-gray-900 dark:text-white">{Object.keys(importPreview.nodes || {}).length}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <span className="font-medium text-gray-900 dark:text-white">Alerts:</span>
                  <span className="text-gray-900 dark:text-white">{Object.keys(importPreview.alerts || {}).length}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <span className="font-medium text-gray-900 dark:text-white">Contacts:</span>
                  <span className="text-gray-900 dark:text-white">{Object.keys(importPreview.contacts || {}).length}</span>
                </div>
              </div>

              <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-6 bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded">
                ⚠️ This will overwrite existing data with the imported data.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={confirmImportData}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Confirm Import
                </button>
                <button
                  onClick={() => {
                    setShowImportDialog(false);
                    setImportPreview(null);
                  }}
                  className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-6 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reset System Dialog */}
        {showResetDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-full">
                  <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-red-900 dark:text-red-400">Reset Entire System</h3>
              </div>

              <p className="text-gray-700 dark:text-gray-300 mb-4">
                <strong className="text-red-600 dark:text-red-400">⚠️ WARNING:</strong> This will delete ALL nodes, alerts, contacts, and settings.
                This action cannot be undone.
              </p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Type <strong>DELETE</strong> to confirm:
                </label>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleResetSystem}
                  disabled={resetConfirmText !== 'DELETE'}
                  className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reset System
                </button>
                <button
                  onClick={() => {
                    setShowResetDialog(false);
                    setResetConfirmText('');
                  }}
                  className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-6 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


