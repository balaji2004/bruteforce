// src/app/register/page.js
'use client';

import { useState } from 'react';
import { database, ref, set, get } from '@/lib/firebase';
import { isValidLatitude, isValidLongitude, generateId } from '@/lib/utils';
import { MapPin, Navigation } from 'lucide-react';

export default function RegisterNode() {
  const [formData, setFormData] = useState({
    nodeId: '',
    type: 'node',
    name: '',
    latitude: '',
    longitude: '',
    altitude: '',
    installedBy: '',
    description: '',
    nearbyNodes: '',
  });

  const [captureMethod, setCaptureMethod] = useState('manual'); // manual, gps, map
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [existingNodes, setExistingNodes] = useState([]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGPSCapture = () => {
    if (!navigator.geolocation) {
      setMessage({ type: 'error', text: 'Geolocation is not supported by your browser' });
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setMessage({ type: 'success', text: 'GPS coordinates captured successfully!' });
        setLoading(false);
      },
      (error) => {
        setMessage({ type: 'error', text: 'GPS capture failed: ' + error.message });
        setCaptureMethod('manual');
        setLoading(false);
      }
    );
  };

  const checkExistingNodes = async () => {
    try {
      setLoading(true);
      const nodesRef = ref(database, 'nodes');
      const snapshot = await get(nodesRef);
      
      if (snapshot.exists()) {
        const nodes = snapshot.val();
        const nodeList = Object.keys(nodes).map(nodeId => ({
          id: nodeId,
          name: nodes[nodeId].metadata?.name || 'Unknown',
          hasCoordinates: !!(nodes[nodeId].metadata?.latitude && nodes[nodeId].metadata?.longitude)
        }));
        setExistingNodes(nodeList);
        setMessage({ 
          type: 'info', 
          text: `Found ${nodeList.length} existing node(s). Make sure to use a unique ID.` 
        });
      } else {
        setExistingNodes([]);
        setMessage({ type: 'success', text: 'No existing nodes found. You can use any ID!' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to check existing nodes: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = async () => {
    // Check if node ID already exists
    const nodeRef = ref(database, `nodes/${formData.nodeId}`);
    const snapshot = await get(nodeRef);
    if (snapshot.exists()) {
      throw new Error(
        `Node ID "${formData.nodeId}" already exists. Please choose a different ID or delete the existing node from the Analytical Panel.`
      );
    }

    // Validate required fields
    if (!formData.nodeId || !formData.name) {
      throw new Error('Node ID and Name are required');
    }

    // Validate coordinates are provided
    if (!formData.latitude || formData.latitude === '') {
      throw new Error('Latitude is required. Please enter a valid latitude value.');
    }

    if (!formData.longitude || formData.longitude === '') {
      throw new Error('Longitude is required. Please enter a valid longitude value.');
    }

    // Validate coordinates are valid numbers
    const lat = parseFloat(formData.latitude);
    const lon = parseFloat(formData.longitude);

    if (isNaN(lat)) {
      throw new Error(`Invalid latitude value: "${formData.latitude}". Must be a number.`);
    }

    if (isNaN(lon)) {
      throw new Error(`Invalid longitude value: "${formData.longitude}". Must be a number.`);
    }

    // Validate coordinate ranges
    if (!isValidLatitude(lat)) {
      throw new Error(`Latitude ${lat} is out of range. Must be between -90 and 90.`);
    }

    if (!isValidLongitude(lon)) {
      throw new Error(`Longitude ${lon} is out of range. Must be between -180 and 180.`);
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      await validateForm();

      // Parse nearby nodes
      const nearbyNodesArray = formData.nearbyNodes
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);

      // Parse and verify coordinates
      const latitude = parseFloat(formData.latitude);
      const longitude = parseFloat(formData.longitude);
      const altitude = formData.altitude ? parseFloat(formData.altitude) : null;

      // Double-check parsing was successful
      if (isNaN(latitude) || isNaN(longitude)) {
        throw new Error('Failed to parse coordinates. Please ensure they are valid numbers.');
      }

      console.log('🔧 Registering node with coordinates:', {
        nodeId: formData.nodeId,
        latitude,
        longitude,
        altitude,
        latitudeType: typeof latitude,
        longitudeType: typeof longitude
      });

      // Prepare metadata
      const metadata = {
        nodeId: formData.nodeId,
        type: formData.type,
        name: formData.name,
        latitude: latitude,  // Guaranteed to be a number
        longitude: longitude,  // Guaranteed to be a number
        altitude: altitude,
        installedDate: new Date().toISOString(),
        installedBy: formData.installedBy || 'Unknown',
        description: formData.description || '',
        nearbyNodes: nearbyNodesArray,
        status: 'active',
        createdAt: Date.now(),
      };

      // Initialize realtime data structure (new Firebase structure)
      const realtime = {
        temperature: 0,
        pressure: 0,
        altitude: altitude || 0,
        humidity: formData.type === 'gateway' ? 0 : null,
        rssi: formData.type === 'gateway' ? null : 0,
        status: 'offline',
        lastUpdate: Math.floor(Date.now() / 1000).toString()  // Unix timestamp in seconds as string
      };

      const nodeData = {
        metadata,
        realtime,
        history: {}
      };

      console.log('💾 Saving to Firebase:', nodeData);

      // Save to Firebase
      await set(ref(database, `nodes/${formData.nodeId}`), nodeData);

      // Verify the data was saved correctly
      const verifySnapshot = await get(ref(database, `nodes/${formData.nodeId}`));
      if (verifySnapshot.exists()) {
        const savedData = verifySnapshot.val();
        console.log('✅ Verification - Data saved successfully:', savedData);
        
        if (!savedData.metadata.latitude || !savedData.metadata.longitude) {
          console.error('❌ WARNING: Coordinates missing in saved data!', savedData.metadata);
          throw new Error('Data saved but coordinates are missing. Please try again.');
        }

        if (typeof savedData.metadata.latitude !== 'number' || typeof savedData.metadata.longitude !== 'number') {
          console.error('❌ WARNING: Coordinates are not numbers!', {
            latitude: savedData.metadata.latitude,
            longitude: savedData.metadata.longitude,
            latType: typeof savedData.metadata.latitude,
            lonType: typeof savedData.metadata.longitude
          });
          throw new Error('Data saved but coordinates are not in correct format. Please try again.');
        }

        console.log('✅ Coordinates verified:', {
          latitude: savedData.metadata.latitude,
          longitude: savedData.metadata.longitude,
          latType: typeof savedData.metadata.latitude,
          lonType: typeof savedData.metadata.longitude
        });
      } else {
        throw new Error('Failed to verify saved data. Please check Firebase connection.');
      }

      setMessage({ 
        type: 'success', 
        text: `Node "${formData.name}" registered successfully with coordinates (${latitude.toFixed(4)}, ${longitude.toFixed(4)})!` 
      });

      // Reset form
      setFormData({
        nodeId: '',
        type: 'node',
        name: '',
        latitude: '',
        longitude: '',
        altitude: '',
        installedBy: '',
        description: '',
        nearbyNodes: '',
      });

    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Register New Node</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Add a new sensor node or gateway to the system
          </p>

          {message.text && (
            <div className={`p-4 rounded-lg mb-6 ${
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800'
                : message.type === 'info'
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {message.text}
                  {message.type === 'error' && message.text.includes('already exists') && (
                    <div className="mt-3 flex gap-2">
                      <a
                        href="/admin"
                        className="text-sm underline hover:no-underline dark:text-red-400"
                      >
                        Open Analytical Panel →
                      </a>
                      <span className="text-gray-400 dark:text-gray-500">|</span>
                      <a
                        href="/dashboard"
                        className="text-sm underline hover:no-underline dark:text-red-400"
                      >
                        View Dashboard →
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Existing Nodes Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-blue-900 dark:text-blue-300">Check Existing Nodes</h3>
              <button
                type="button"
                onClick={checkExistingNodes}
                disabled={loading}
                className="text-sm px-3 py-1 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? 'Checking...' : 'Check Now'}
              </button>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-400 mb-2">
              Click &quot;Check Now&quot; to see what node IDs are already taken
            </p>
            
            {existingNodes.length > 0 && (
              <div className="mt-3 bg-white dark:bg-gray-700 rounded p-3 max-h-32 overflow-y-auto">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">Existing Node IDs:</p>
                <div className="grid grid-cols-2 gap-2">
                  {existingNodes.map((node) => (
                    <div key={node.id} className="text-sm flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${node.hasCoordinates ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      <span className="font-mono text-gray-900 dark:text-white">{node.id}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">({node.name})</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  🟢 = Valid (will show on map) | 🔴 = Missing coordinates (won&apos;t show on map)
                </p>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Node ID and Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Node ID *
                </label>
                <input
                  type="text"
                  name="nodeId"
                  value={formData.nodeId}
                  onChange={handleChange}
                  required
                  placeholder="e.g., node1, node2, gateway"
                  className="input-field"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Unique identifier for this node
                  {existingNodes.length > 0 && (
                    <span className="text-orange-600 dark:text-orange-400 font-semibold">
                      {' '}(Avoid: {existingNodes.slice(0, 3).map(n => n.id).join(', ')}
                      {existingNodes.length > 3 && '...'})
                    </span>
                  )}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Type *
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  required
                  className="input-field"
                >
                  <option value="node">Node</option>
                  <option value="gateway">Gateway</option>
                </select>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Node Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="e.g., Valley Sensor Station"
                className="input-field"
              />
            </div>

            {/* Location Capture Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Location Capture Method
              </label>
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setCaptureMethod('manual')}
                  className={`px-4 py-2 rounded-lg border ${
                    captureMethod === 'manual'
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500 dark:border-blue-600 text-blue-700 dark:text-blue-300'
                      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <MapPin className="inline h-4 w-4 mr-2" />
                  Manual Entry
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCaptureMethod('gps');
                    handleGPSCapture();
                  }}
                  disabled={loading}
                  className={`px-4 py-2 rounded-lg border ${
                    captureMethod === 'gps'
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500 dark:border-blue-600 text-blue-700 dark:text-blue-300'
                      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                  } disabled:opacity-50`}
                >
                  <Navigation className="inline h-4 w-4 mr-2" />
                  Use GPS
                </button>
              </div>
            </div>

            {/* Coordinates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Latitude *
                </label>
                <input
                  type="number"
                  name="latitude"
                  value={formData.latitude}
                  onChange={handleChange}
                  required
                  step="any"
                  placeholder="e.g., 28.6139"
                  className="input-field"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Range: -90 to 90</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Longitude *
                </label>
                <input
                  type="number"
                  name="longitude"
                  value={formData.longitude}
                  onChange={handleChange}
                  required
                  step="any"
                  placeholder="e.g., 77.2090"
                  className="input-field"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Range: -180 to 180</p>
              </div>
            </div>

            {/* Altitude */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Altitude (meters)
              </label>
              <input
                type="number"
                name="altitude"
                value={formData.altitude}
                onChange={handleChange}
                step="any"
                placeholder="e.g., 878.9"
                className="input-field"
              />
            </div>

            {/* Installed By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Installed By
              </label>
              <input
                type="text"
                name="installedBy"
                value={formData.installedBy}
                onChange={handleChange}
                placeholder="e.g., Team Alpha"
                className="input-field"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                placeholder="e.g., Near river crossing, valley location"
                className="input-field"
              />
            </div>

            {/* Nearby Nodes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Nearby Nodes (comma-separated)
              </label>
              <input
                type="text"
                name="nearbyNodes"
                value={formData.nearbyNodes}
                onChange={handleChange}
                placeholder="e.g., node2, gateway, node3"
                className="input-field"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                List IDs of nearby nodes for mesh network visualization
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 dark:bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Registering...' : 'Register Node'}
              </button>
              <button
                type="button"
                onClick={() => window.history.back()}
                className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}