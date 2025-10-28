// src/app/graphs/page.js
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { database, ref, onValue } from '@/lib/firebase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatDateTime } from '@/lib/utils';
import { TrendingUp, Calendar, Download } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';

// Force dynamic rendering because we use useSearchParams and client-side libraries
export const dynamic = 'force-dynamic';

function GraphsContent() {
  const searchParams = useSearchParams();
  const nodeParam = searchParams.get('node');

  const [nodes, setNodes] = useState({});
  const [selectedNode, setSelectedNode] = useState(nodeParam || 'gateway');
  const [timeRange, setTimeRange] = useState('24h'); // 1h, 6h, 24h, 7d
  const [historicalData, setHistoricalData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load nodes
    const nodesRef = ref(database, 'nodes');
    const unsubscribe = onValue(nodesRef, (snapshot) => {
      const data = snapshot.val() || {};
      setNodes(data);
      
      // If nodeParam exists and is valid, use it
      if (nodeParam && data[nodeParam]) {
        setSelectedNode(nodeParam);
      } else if (!data[selectedNode]) {
        // If selected node doesn't exist, select first available
        const firstNode = Object.keys(data)[0];
        if (firstNode) setSelectedNode(firstNode);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [nodeParam, selectedNode]);

  useEffect(() => {
    if (!selectedNode || !nodes[selectedNode]) return;

    // Load historical data
    const historyRef = ref(database, `nodes/${selectedNode}/history`);
    const unsubscribeHistory = onValue(historyRef, (snapshot) => {
      const data = snapshot.val() || {};
      
      // Convert to array and sort by timestamp
      // New structure: history/{auto-key}/{temperature, pressure, altitude, humidity, rssi, timestamp}
      const dataArray = Object.entries(data).map(([key, values]) => {
        // Handle timestamp: convert to milliseconds if it's in seconds (Unix timestamp)
        const timestamp = typeof values.timestamp === 'string'
          ? parseInt(values.timestamp) * 1000  // Convert Unix timestamp (seconds) to milliseconds
          : values.timestamp;
        
        return {
          timestamp,
          temperature: values.temperature,
          pressure: values.pressure,
          altitude: values.altitude,
          humidity: values.humidity,
          rainfall: values.rainfall,
          rssi: values.rssi
        };
      }).sort((a, b) => a.timestamp - b.timestamp);

      // Filter by time range
      const now = Date.now();
      let cutoff;
      switch (timeRange) {
        case '1h': cutoff = now - (1 * 60 * 60 * 1000); break;
        case '6h': cutoff = now - (6 * 60 * 60 * 1000); break;
        case '24h': cutoff = now - (24 * 60 * 60 * 1000); break;
        case '7d': cutoff = now - (7 * 24 * 60 * 60 * 1000); break;
        default: cutoff = now - (24 * 60 * 60 * 1000);
      }

      const filtered = dataArray.filter(d => d.timestamp >= cutoff);
      setHistoricalData(filtered);
    });

    return () => unsubscribeHistory();
  }, [selectedNode, nodes, timeRange]);

  const handleExportCSV = () => {
    if (historicalData.length === 0) return;

    const headers = ['Timestamp', 'Temperature', 'Pressure', 'Altitude', 'Humidity', 'RSSI'];
    const csvContent = [
      headers.join(','),
      ...historicalData.map(d => [
        formatDateTime(d.timestamp),
        d.temperature || '',
        d.pressure || '',
        d.altitude || '',
        d.humidity || '',
        d.rssi || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedNode}_${timeRange}_data.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading data...</p>
        </div>
      </div>
    );
  }

  const currentData = nodes[selectedNode]?.realtime || {};

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Historical Data & Graphs</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Analyze sensor trends over time
            </p>
          </div>
          <button
            onClick={handleExportCSV}
            disabled={historicalData.length === 0}
            className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="h-5 w-5" />
            Export CSV
          </button>
        </div>

        {/* Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Select Node
              </label>
              <select
                value={selectedNode}
                onChange={(e) => setSelectedNode(e.target.value)}
                className="input-field"
              >
                {Object.keys(nodes).map(nodeId => (
                  <option key={nodeId} value={nodeId}>
                    {nodes[nodeId]?.metadata?.name || nodeId}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Time Range
              </label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="input-field"
              >
                <option value="1h">Last 1 Hour</option>
                <option value="6h">Last 6 Hours</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
              </select>
            </div>
          </div>
        </div>

        {/* Current Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {currentData.temperature !== undefined && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Temperature</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {currentData.temperature?.toFixed(1)}°C
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          )}

          {currentData.pressure !== undefined && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Pressure</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {currentData.pressure?.toFixed(1)} hPa
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
          )}

          {currentData.humidity !== undefined && currentData.humidity !== null && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Humidity</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {currentData.humidity?.toFixed(1)}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Data Points</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {historicalData.length}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>

        {/* Charts */}
        {historicalData.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center text-gray-500 dark:text-gray-400">
            No historical data available for selected time range
          </div>
        ) : (
          <div className="space-y-6">
            {/* Temperature Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Temperature Over Time</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(ts) => new Date(ts).toLocaleTimeString()}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(ts) => formatDateTime(ts)}
                    formatter={(value) => [`${value?.toFixed(1)}°C`, 'Temperature']}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="temperature" stroke="#3b82f6" name="Temperature (°C)" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Pressure Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Pressure Over Time</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(ts) => new Date(ts).toLocaleTimeString()}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(ts) => formatDateTime(ts)}
                    formatter={(value) => [`${value?.toFixed(1)} hPa`, 'Pressure']}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="pressure" stroke="#10b981" name="Pressure (hPa)" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Humidity Chart (if available) */}
            {historicalData.some(d => d.humidity !== undefined && d.humidity !== null) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Humidity Over Time</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={historicalData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(ts) => new Date(ts).toLocaleTimeString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(ts) => formatDateTime(ts)}
                      formatter={(value) => [`${value?.toFixed(1)}%`, 'Humidity']}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="humidity" stroke="#8b5cf6" name="Humidity (%)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* RSSI Chart (for nodes) */}
            {historicalData.some(d => d.rssi !== undefined && d.rssi !== null) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Signal Strength (RSSI) Over Time</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={historicalData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(ts) => new Date(ts).toLocaleTimeString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(ts) => formatDateTime(ts)}
                      formatter={(value) => [`${value} dBm`, 'RSSI']}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="rssi" stroke="#ef4444" name="RSSI (dBm)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Graphs() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><LoadingSpinner size="large" /></div>}>
      <GraphsContent />
    </Suspense>
  );
}