'use client';

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useState, Fragment } from 'react';
import { Thermometer, Gauge, Droplets, Radio, MapPin } from 'lucide-react';

// Custom markers only - no default Leaflet marker icons needed
// We're using custom divIcons with colored circles instead

/**
 * MapBoundsUpdater Component
 * Automatically fits map bounds when nodes change
 */
function MapBoundsUpdater({ nodes }) {
  const map = useMap();

  useEffect(() => {
    if (nodes && nodes.length > 0) {
      try {
        const validBounds = nodes
          .filter(node => 
            node?.metadata?.latitude && 
            node?.metadata?.longitude &&
            !isNaN(node.metadata.latitude) &&
            !isNaN(node.metadata.longitude)
          )
          .map(node => [
            Number(node.metadata.latitude),
            Number(node.metadata.longitude)
          ]);
        
        if (validBounds.length > 0) {
          map.fitBounds(validBounds, { padding: [50, 50], maxZoom: 15 });
        }
      } catch (error) {
        console.error('Error updating map bounds:', error);
      }
    }
  }, [nodes, map]);

  return null;
}

/**
 * DashboardMap Component
 * Renders interactive map with node markers, connections, and popups
 */
export default function DashboardMap({
  nodes = [],
  selectedNode,
  setSelectedNode,
  getNodeStatus,
  formatTimeAgo
}) {
  const [isMapReady, setIsMapReady] = useState(false);

  useEffect(() => {
    console.log('🗺️ DashboardMap received nodes:', nodes.length);
    if (nodes.length > 0) {
      console.log('📍 First node:', nodes[0]);
    }
  }, [nodes]);

  /**
   * Creates custom colored marker icon based on node status
   * @param {Object} node - Node object with metadata and realtime data
   * @returns {L.DivIcon} Custom Leaflet icon
   */
  const getMarkerIcon = (node) => {
    const status = getNodeStatus(node);
    const isGateway = node?.metadata?.type === 'gateway';

    // Status colors
    const colors = {
      online: '#10b981',    // green-500
      offline: '#ef4444',   // red-500
      warning: '#f59e0b'    // yellow-500
    };

    const color = colors[status] || colors.offline;
    const size = isGateway ? 32 : 24;

    return L.divIcon({
      className: 'custom-map-marker',
      html: `
        <div style="
          width: ${size}px;
          height: ${size}px;
          background-color: ${color};
          border: ${isGateway ? '3px solid #3b82f6' : '2px solid white'};
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          ${status === 'online' ? 'animation: markerPulse 2s infinite;' : ''}
        "></div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2]
    });
  };

  // Default center (India - Delhi region)
  const defaultCenter = [28.6139, 77.2090];
  
  // Filter valid nodes
  const validNodes = nodes.filter(node => 
    node?.metadata?.latitude && 
    node?.metadata?.longitude &&
    !isNaN(node.metadata.latitude) &&
    !isNaN(node.metadata.longitude)
  );

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={defaultCenter}
        zoom={12}
        className="h-full w-full"
        style={{ zIndex: 0 }}
        whenCreated={() => setIsMapReady(true)}
      >
        {/* OpenStreetMap Tile Layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

      {/* Auto-fit bounds to show all nodes */}
      <MapBoundsUpdater nodes={validNodes} />

      {/* Render connection lines between nearby nodes */}
      {validNodes.map((node, nodeIndex) => {
        if (!node?.metadata?.nearbyNodes || node.metadata.nearbyNodes.length === 0) {
          return null;
        }

        const nodeKey = node?.metadata?.nodeId || `node-${nodeIndex}`;
        return (
          <Fragment key={`connections-${nodeKey}`}>
            {node.metadata.nearbyNodes.map((nearbyNodeId, nearbyIndex) => {
              const nearbyNode = validNodes.find(n => n?.metadata?.nodeId === nearbyNodeId);
              if (!nearbyNode) return null;

              return (
                <Polyline
                  key={`${nodeKey}-${nearbyNodeId || `nearby-${nearbyIndex}`}`}
                  positions={[
                    [Number(node.metadata.latitude), Number(node.metadata.longitude)],
                    [Number(nearbyNode.metadata.latitude), Number(nearbyNode.metadata.longitude)]
                  ]}
                  pathOptions={{
                    color: '#3b82f6',      // blue-500
                    weight: 2,
                    opacity: 0.6,
                    dashArray: '5, 10'
                  }}
                />
              );
            })}
          </Fragment>
        );
      })}

      {/* Render node markers with popups */}
      {validNodes.map((node, index) => (
        <Marker
          key={node?.metadata?.nodeId || `marker-${index}`}
          position={[Number(node.metadata.latitude), Number(node.metadata.longitude)]}
          icon={getMarkerIcon(node)}
          eventHandlers={{
            click: () => setSelectedNode(node)
          }}
        >
          <Popup className="custom-popup" minWidth={220}>
            <div className="min-w-[200px]">
              {/* Header with status */}
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    getNodeStatus(node) === 'online'
                      ? 'bg-green-500'
                      : getNodeStatus(node) === 'warning'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                />
                <h3 className="font-bold text-gray-900">{node.metadata.name}</h3>
              </div>

              {/* Node type badge */}
              <div className="mb-2">
                <span
                  className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                    node.metadata.type === 'gateway'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {node.metadata.type === 'gateway' ? '🛰️ Gateway' : '📡 Sensor Node'}
                </span>
              </div>

              {/* Sensor readings */}
              <div className="space-y-1.5 text-sm border-t pt-2">
                <div className="flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-red-500" />
                  <span className="text-gray-700">
                    {node.realtime?.temperature?.toFixed(1) || 'N/A'}°C
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-blue-500" />
                  <span className="text-gray-700">
                    {node.realtime?.pressure?.toFixed(1) || 'N/A'} hPa
                  </span>
                </div>

                {node.realtime?.humidity !== null && node.realtime?.humidity !== undefined && (
                  <div className="flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-cyan-500" />
                    <span className="text-gray-700">{node.realtime.humidity.toFixed(1)}%</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-green-500" />
                  <span className="text-gray-700">{node.realtime?.rssi || 'N/A'} dBm</span>
                </div>
              </div>

              {/* Last updated time */}
              <div className="text-xs text-gray-500 mt-2 border-t pt-1.5">
                Updated: {formatTimeAgo(
                  node.realtime?.lastUpdate 
                    ? (typeof node.realtime.lastUpdate === 'string' 
                        ? parseInt(node.realtime.lastUpdate) * 1000 
                        : node.realtime.lastUpdate)
                    : null
                )}
              </div>

              {/* View details button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNode(node);
                }}
                className="text-blue-600 text-sm mt-2 hover:underline w-full text-left font-medium"
              >
                View Details →
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
      </MapContainer>

      {/* Map Legend */}
      <div className="absolute bottom-6 left-6 bg-white rounded-lg shadow-lg p-4 z-[1000] max-w-xs">
        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-gray-700" />
          Map Legend
        </h3>
        
        {/* Node Status */}
        <div className="space-y-2 mb-3">
          <p className="text-xs font-semibold text-gray-700 mb-1">Node Status:</p>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-sm"></div>
            <span className="text-xs text-gray-700">Online (Active)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-yellow-500 border-2 border-white shadow-sm"></div>
            <span className="text-xs text-gray-700">Warning (Delayed)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-sm"></div>
            <span className="text-xs text-gray-700">Offline (Inactive)</span>
          </div>
        </div>

        {/* Node Type */}
        <div className="space-y-2 border-t border-gray-200 pt-3">
          <p className="text-xs font-semibold text-gray-700 mb-1">Node Type:</p>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-green-500 border-[3px] border-blue-500 shadow-sm"></div>
            <span className="text-xs text-gray-700">Gateway Node</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-sm"></div>
            <span className="text-xs text-gray-700">Sensor Node</span>
          </div>
        </div>

        {/* Connection Lines */}
        <div className="space-y-2 border-t border-gray-200 pt-3">
          <p className="text-xs font-semibold text-gray-700 mb-1">Network:</p>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 border-t-2 border-dashed border-blue-500"></div>
            <span className="text-xs text-gray-700">Node Connection</span>
          </div>
        </div>

        {/* Live Count */}
        <div className="border-t border-gray-200 pt-3 mt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Total Nodes:</span>
            <span className="font-bold text-gray-900">{validNodes.length}</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-gray-600">Online:</span>
            <span className="font-bold text-green-600">
              {validNodes.filter(n => getNodeStatus(n) === 'online').length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

