// src/components/Map.js
'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatTimeAgo, getSensorDisplay } from '@/lib/utils';

// Fix Leaflet icon issue in Next.js
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons based on status
const createIcon = (status, type) => {
  const colors = {
    online: '#10b981',
    offline: '#ef4444',
    warning: '#f59e0b',
    critical: '#dc2626'
  };

  const color = colors[status] || colors.offline;
  const isGateway = type === 'gateway';

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="position: relative;">
        <div style="
          width: ${isGateway ? '32px' : '24px'};
          height: ${isGateway ? '32px' : '24px'};
          background-color: ${color};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          ${status === 'online' ? 'animation: pulse 2s infinite;' : ''}
        "></div>
        ${isGateway ? '<div style="position: absolute; top: -8px; right: -8px; background: blue; color: white; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-center; font-size: 10px; font-weight: bold;">G</div>' : ''}
      </div>
      <style>
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
      </style>
    `,
    iconSize: [isGateway ? 32 : 24, isGateway ? 32 : 24],
    iconAnchor: [isGateway ? 16 : 12, isGateway ? 16 : 12],
  });
};

// Component to fit map bounds to show all markers
function FitBounds({ nodes }) {
  const map = useMap();

  useEffect(() => {
    const positions = Object.values(nodes)
      .filter(node => node.metadata?.latitude && node.metadata?.longitude)
      .map(node => [node.metadata.latitude, node.metadata.longitude]);

    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  }, [nodes, map]);

  return null;
}

export default function Map({ nodes, onNodeClick, selectedNode }) {
  const [center, setCenter] = useState([20.5937, 78.9629]); // India center
  const [zoom, setZoom] = useState(5);

  // Get nearby nodes connections
  const getConnections = () => {
    const connections = [];
    Object.entries(nodes).forEach(([nodeId, nodeData]) => {
      if (nodeData.metadata?.nearbyNodes && Array.isArray(nodeData.metadata.nearbyNodes)) {
        nodeData.metadata.nearbyNodes.forEach(nearbyId => {
          if (nodes[nearbyId] && nodes[nearbyId].metadata) {
            const from = [nodeData.metadata.latitude, nodeData.metadata.longitude];
            const to = [nodes[nearbyId].metadata.latitude, nodes[nearbyId].metadata.longitude];
            connections.push({ from, to });
          }
        });
      }
    });
    return connections;
  };

  const connections = getConnections();

  return (
    <div className="h-full w-full">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds nodes={nodes} />

        {/* Draw connections between nearby nodes */}
        {connections.map((conn, index) => (
          <Polyline
            key={index}
            positions={[conn.from, conn.to]}
            color="#3b82f6"
            weight={2}
            opacity={0.5}
            dashArray="5, 10"
          />
        ))}

        {/* Render markers for all nodes */}
        {Object.entries(nodes).map(([nodeId, nodeData]) => {
          if (!nodeData.metadata?.latitude || !nodeData.metadata?.longitude) return null;

          const position = [nodeData.metadata.latitude, nodeData.metadata.longitude];
          const status = nodeData.realtime?.status || 'offline';
          const type = nodeData.metadata?.type || 'node';

          return (
            <Marker
              key={nodeId}
              position={position}
              icon={createIcon(status, type)}
              eventHandlers={{
                click: () => onNodeClick(nodeId),
              }}
            >
              <Popup>
                <div className="p-2 min-w-[200px]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-lg">
                      {nodeData.metadata?.name || nodeId}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      status === 'online' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {status}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm mb-3">
                    {nodeData.realtime?.temperature !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Temperature:</span>
                        <span className="font-medium">{getSensorDisplay(nodeData.realtime.temperature, '°C')}</span>
                      </div>
                    )}
                    {nodeData.realtime?.pressure !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Pressure:</span>
                        <span className="font-medium">{getSensorDisplay(nodeData.realtime.pressure, ' hPa')}</span>
                      </div>
                    )}
                    {nodeData.realtime?.humidity !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Humidity:</span>
                        <span className="font-medium">{getSensorDisplay(nodeData.realtime.humidity, '%')}</span>
                      </div>
                    )}
                    {nodeData.realtime?.rssi !== undefined && nodeData.realtime.rssi !== null && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Signal:</span>
                        <span className="font-medium">{nodeData.realtime.rssi} dBm</span>
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-gray-500 border-t pt-2">
                    Last update: {formatTimeAgo(nodeData.realtime?.lastSeen)}
                  </div>

                  <button
                    onClick={() => onNodeClick(nodeId)}
                    className="mt-2 w-full bg-blue-600 text-white py-1 px-3 rounded text-sm hover:bg-blue-700 transition-colors"
                  >
                    View Details →
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}