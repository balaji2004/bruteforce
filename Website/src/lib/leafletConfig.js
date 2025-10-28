// Only configure Leaflet on the client side to avoid SSR issues
if (typeof window !== 'undefined') {
  const L = require('leaflet');
  const icon = require('leaflet/dist/images/marker-icon.png');
  const iconShadow = require('leaflet/dist/images/marker-shadow.png');

  let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
  });

  L.Marker.prototype.options.icon = DefaultIcon;
}