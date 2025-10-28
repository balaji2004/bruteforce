'use client';

import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '@/lib/firebase';
import dynamic from 'next/dynamic';
import NodeStatusBadge from '@/components/NodeStatusBadge';
import {
  X,
  Thermometer,
  Gauge,
  Droplets,
  Radio,
  MapPin,
  LineChart,
  AlertCircle,
  MapPinned,
  Mountain,
  User,
  Clock,
  Signal
} from 'lucide-react';

// Dynamically import map component (disable SSR for Leaflet)
const DashboardMap = dynamic(() => import('@/components/DashboardMap'), {
  ssr: false,
  loading: () => (
    <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400 font-medium">Loading map...</p>
      </div>
    </div>
  )
});

/**
 * Dashboard Page Component
 * Main dashboard with real-time Firebase data and interactive Leaflet map
 */
export default function DashboardPage() {
  // State management
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Firebase Real-time Listener
   * Listens to /nodes path and updates state when data changes
   */
  useEffect(() => {
    console.log('🔥 Initializing Firebase listener...');
    
    const nodesRef = ref(database, 'nodes');

    const unsubscribe = onValue(
      nodesRef, 
      (snapshot) => {
        try {
          const data = snapshot.val();
          console.log('📦 Firebase data received:', data);

          if (data) {
            // Convert object to array and validate structure with detailed logging
            const allNodes = Object.entries(data);
            console.log(`🔍 Total nodes in database: ${allNodes.length}`);
            
            const nodeArray = [];
            const invalidNodes = [];

            allNodes.forEach(([nodeId, node]) => {
              // Check if node has required structure
              if (!node.metadata) {
                console.warn(`⚠️ Node "${nodeId}" missing metadata object`);
                invalidNodes.push({ nodeId, reason: 'Missing metadata' });
                return;
              }

              // Check latitude
              if (!node.metadata.latitude && node.metadata.latitude !== 0) {
                console.warn(`⚠️ Node "${nodeId}" missing latitude`, node.metadata);
                invalidNodes.push({ nodeId, reason: 'Missing latitude', metadata: node.metadata });
                return;
              }

              // Check longitude
              if (!node.metadata.longitude && node.metadata.longitude !== 0) {
                console.warn(`⚠️ Node "${nodeId}" missing longitude`, node.metadata);
                invalidNodes.push({ nodeId, reason: 'Missing longitude', metadata: node.metadata });
                return;
              }

              // Validate coordinate types
              if (typeof node.metadata.latitude !== 'number') {
                console.warn(`⚠️ Node "${nodeId}" latitude is not a number:`, {
                  value: node.metadata.latitude,
                  type: typeof node.metadata.latitude
                });
                invalidNodes.push({ 
                  nodeId, 
                  reason: `Latitude is ${typeof node.metadata.latitude}, not number`,
                  value: node.metadata.latitude 
                });
                return;
              }

              if (typeof node.metadata.longitude !== 'number') {
                console.warn(`⚠️ Node "${nodeId}" longitude is not a number:`, {
                  value: node.metadata.longitude,
                  type: typeof node.metadata.longitude
                });
                invalidNodes.push({ 
                  nodeId, 
                  reason: `Longitude is ${typeof node.metadata.longitude}, not number`,
                  value: node.metadata.longitude 
                });
                return;
              }

              // Validate coordinate ranges
              if (node.metadata.latitude < -90 || node.metadata.latitude > 90) {
                console.warn(`⚠️ Node "${nodeId}" latitude out of range: ${node.metadata.latitude}`);
                invalidNodes.push({ nodeId, reason: 'Latitude out of range', value: node.metadata.latitude });
                return;
              }

              if (node.metadata.longitude < -180 || node.metadata.longitude > 180) {
                console.warn(`⚠️ Node "${nodeId}" longitude out of range: ${node.metadata.longitude}`);
                invalidNodes.push({ nodeId, reason: 'Longitude out of range', value: node.metadata.longitude });
                return;
              }

              // Node is valid!
              console.log(`✅ Node "${nodeId}" is valid:`, {
                lat: node.metadata.latitude,
                lon: node.metadata.longitude,
                name: node.metadata.name
              });
              nodeArray.push(node);
            });

            console.log(`✅ Processed ${nodeArray.length} valid nodes`);
            
            if (invalidNodes.length > 0) {
              console.warn(`⚠️ Found ${invalidNodes.length} invalid node(s) - these will not appear on map:`, invalidNodes);
              console.info('💡 TIP: Delete invalid nodes from Analytical Panel and re-register with proper coordinates');
              console.info('📖 See CHECK_INVALID_NODES.md for detailed troubleshooting');
            }
            
            setNodes(nodeArray);
          } else {
            console.log('⚠️ No nodes found in database');
            setNodes([]);
          }
          setLoading(false);
          setError(null);
        } catch (err) {
          console.error('❌ Error processing nodes:', err);
          setError('Failed to process node data');
          setLoading(false);
        }
      },
      (err) => {
        console.error('❌ Firebase error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => {
      console.log('🧹 Cleaning up Firebase listener');
      unsubscribe();
    };
  }, []);

  /**
   * Determines node status based on last update timestamp
   * @param {Object} node - Node object with realtime data
   * @returns {string} 'online', 'offline', or 'warning'
   */
  const getNodeStatus = (node) => {
    if (!node.realtime || !node.realtime.lastUpdate) return 'offline';

    // Check if node status is explicitly set (from new structure)
    if (node.realtime.status === 'offline') return 'offline';
    if (node.realtime.status === 'online') {
      // Verify it's actually online (last update within 5 minutes)
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const lastUpdateMs = typeof node.realtime.lastUpdate === 'string' 
        ? parseInt(node.realtime.lastUpdate) * 1000  // Convert Unix timestamp to milliseconds
        : node.realtime.lastUpdate;
      return lastUpdateMs > fiveMinutesAgo ? 'online' : 'offline';
    }

    return 'offline';
  };

  /**
   * Formats timestamp to human-readable "time ago" format
   * @param {number} timestamp - Unix timestamp in milliseconds
   * @returns {string} Formatted time string
   */
  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'Never';

    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return `${seconds} sec ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };

  /**
   * Formats timestamp to full date and time string
   * @param {number} timestamp - Unix timestamp in milliseconds
   * @returns {string} Formatted date/time string
   */
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  // ==================== LOADING STATE ====================
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-blue-600 mx-auto mb-6"></div>
          <p className="text-gray-700 dark:text-white font-semibold text-lg mb-2">Loading Dashboard</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Connecting to Firebase...</p>
        </div>
      </div>
    );
  }

  // ==================== ERROR STATE ====================
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md px-6">
          <AlertCircle className="w-20 h-20 text-red-500 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Error Loading Dashboard</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">{error}</p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry Connection
            </button>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Make sure Firebase is properly configured in <code className="bg-gray-200 dark:bg-gray-700 dark:text-gray-300 px-1 rounded">firebase.js</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ==================== EMPTY STATE ====================
  if (nodes.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center max-w-md px-6">
          <MapPin className="w-24 h-24 text-gray-400 dark:text-gray-600 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">No Nodes Registered</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
            Register your first sensor node to start monitoring weather conditions and detecting cloudbursts.
          </p>
          <button
            onClick={() => (window.location.href = '/register')}
            className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
          >
            Register First Node
          </button>
        </div>
      </div>
    );
  }

  // ==================== MAIN DASHBOARD ====================
  return (
    <div className="relative h-screen overflow-hidden">
      {/* Map Component */}
      <DashboardMap
        nodes={nodes}
        selectedNode={selectedNode}
        setSelectedNode={setSelectedNode}
        getNodeStatus={getNodeStatus}
        formatTimeAgo={formatTimeAgo}
      />

      {/* Node Counter Badge */}
      <div className="absolute top-4 left-4 z-[1000] bg-white dark:bg-gray-800 rounded-lg shadow-lg px-4 py-3">
        <div className="flex items-center gap-3">
          <MapPinned className="w-5 h-5 text-blue-600" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Active Nodes</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{nodes.length}</p>
          </div>
        </div>
      </div>

      {/* Sidebar Panel - Slide in from right when node is selected */}
      {selectedNode && (
        <>
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black bg-opacity-30 z-[1000] md:hidden"
            onClick={() => setSelectedNode(null)}
          />

          {/* Sidebar */}
          <div className="fixed top-0 right-0 w-full md:w-[420px] h-full bg-white dark:bg-gray-800 shadow-2xl z-[1001] overflow-y-auto transform transition-transform duration-300 ease-out">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-5 flex justify-between items-center shadow-md z-10">
              <div>
                <h2 className="text-xl font-bold">{selectedNode.metadata.name}</h2>
                <p className="text-blue-100 text-sm mt-0.5">{selectedNode.metadata.nodeId}</p>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-2 hover:bg-blue-700 dark:hover:bg-blue-800 rounded-lg transition-colors"
                aria-label="Close sidebar"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Status Badge */}
            <div className="p-5 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
              <NodeStatusBadge status={getNodeStatus(selectedNode)} showDot showText size="lg" />
            </div>

            {/* Current Sensor Readings */}
            <div className="p-5 border-b dark:border-gray-600">
              <h3 className="font-semibold text-lg mb-4 text-gray-900 dark:text-white">Current Readings</h3>
              <div className="space-y-3">
                {/* Temperature */}
                <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 dark:bg-red-800/50 rounded-lg">
                      <Thermometer className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Temperature</span>
                  </div>
                  <span className="font-bold text-lg text-gray-900 dark:text-white">
                    {selectedNode.realtime?.temperature?.toFixed(1) || 'N/A'}°C
                  </span>
                </div>

                {/* Pressure */}
                <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-800/50 rounded-lg">
                      <Gauge className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Pressure</span>
                  </div>
                  <span className="font-bold text-lg text-gray-900 dark:text-white">
                    {selectedNode.realtime?.pressure?.toFixed(1) || 'N/A'} hPa
                  </span>
                </div>

                {/* Humidity (if available) */}
                {selectedNode.realtime?.humidity !== null && selectedNode.realtime?.humidity !== undefined && (
                  <div className="flex justify-between items-center p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-100 dark:border-cyan-800">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-cyan-100 dark:bg-cyan-800/50 rounded-lg">
                        <Droplets className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Humidity</span>
                    </div>
                    <span className="font-bold text-lg text-gray-900 dark:text-white">
                      {selectedNode.realtime.humidity.toFixed(1)}%
                    </span>
                  </div>
                )}

                {/* Signal Strength */}
                <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-800/50 rounded-lg">
                      <Signal className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Signal Strength</span>
                  </div>
                  <span className="font-bold text-lg text-gray-900 dark:text-white">
                    {selectedNode.realtime?.rssi || 'N/A'} dBm
                  </span>
                </div>
              </div>
            </div>

            {/* Node Information */}
            <div className="p-5 border-b dark:border-gray-600">
              <h3 className="font-semibold text-lg mb-4 text-gray-900 dark:text-white">Node Information</h3>
              <div className="space-y-3">
                {/* Node Type */}
                <div className="flex items-start gap-3">
                  <Radio className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">Type</p>
                    <p className="text-sm text-gray-900 dark:text-white font-medium capitalize">
                      {selectedNode.metadata.type}
                      {selectedNode.metadata.type === 'gateway' && ' 🛰️'}
                    </p>
                  </div>
                </div>

                {/* Location Coordinates */}
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">Coordinates</p>
                    <p className="text-sm text-gray-900 dark:text-white font-mono">
                      {selectedNode.metadata.latitude.toFixed(4)}°N,{' '}
                      {selectedNode.metadata.longitude.toFixed(4)}°E
                    </p>
                  </div>
                </div>

                {/* Altitude */}
                {selectedNode.metadata.altitude && (
                  <div className="flex items-start gap-3">
                    <Mountain className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">Altitude</p>
                      <p className="text-sm text-gray-900 dark:text-white font-medium">
                        {selectedNode.metadata.altitude.toFixed(1)} meters
                      </p>
                    </div>
        </div>
      )}
      
                {/* Installed By */}
                {selectedNode.metadata.installedBy && (
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">Installed By</p>
                      <p className="text-sm text-gray-900 dark:text-white font-medium">
                        {selectedNode.metadata.installedBy}
                      </p>
                    </div>
                  </div>
                )}

                {/* Description */}
                {selectedNode.metadata.description && (
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase mb-1">Description</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {selectedNode.metadata.description}
                    </p>
        </div>
                )}
              </div>
            </div>

            {/* Last Updated */}
            <div className="p-5 border-b dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Clock className="w-4 h-4" />
                <span className="font-medium">Last Updated:</span>
                <span>{formatTimestamp(
                  selectedNode.realtime?.lastUpdate
                    ? (typeof selectedNode.realtime.lastUpdate === 'string'
                        ? parseInt(selectedNode.realtime.lastUpdate) * 1000
                        : selectedNode.realtime.lastUpdate)
                    : null
                )}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-5 space-y-3">
              <button
                onClick={() =>
                  (window.location.href = `/graphs?node=${selectedNode.metadata.nodeId}`)
                }
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-semibold shadow-md hover:shadow-lg"
              >
                <LineChart className="w-5 h-5" />
                View Detailed History
              </button>

              <button
                onClick={() => setSelectedNode(null)}
                className="w-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-3 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
