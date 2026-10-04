// Initialize the map, centered on Nashik as a default location
const map = L.map('map').setView([19.9975, 73.7898], 12);

// Load map tiles (the actual visual map background) from OpenStreetMap — free, no API key needed
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

// Dummy data for now — this is exactly what will later come from your database instead
const incidents = [
    { lat: 19.9975, lng: 73.7898, name: "Flooding reported", type: "incident" },
    { lat: 20.0059, lng: 73.7910, name: "Road blocked - fallen tree", type: "incident" }
];

const shelters = [
    { lat: 19.9930, lng: 73.7850, name: "Community Shelter - Nashik Central", type: "shelter" },
    { lat: 20.0100, lng: 73.7800, name: "Emergency Relief Camp", type: "shelter" }
];

const resources = [
    { lat: 20.0020, lng: 73.7950, name: "Medical Resource Center", type: "resource" }
];

// Custom colored icons for each type
function createIcon(color) {
    return L.divIcon({
        className: "custom-marker",
        html: `<div style="background:${color}; width:16px; height:16px; border-radius:50%; border:2px solid white; box-shadow:0 0 4px rgba(0,0,0,0.4);"></div>`,
        iconSize: [16, 16]
    });
}

const redIcon = createIcon("#ef4444");
const blueIcon = createIcon("#3b82f6");
const greenIcon = createIcon("#22c55e");

// Add all markers to the map
incidents.forEach(item => {
    L.marker([item.lat, item.lng], { icon: redIcon })
        .addTo(map)
        .bindPopup(`<strong>${item.name}</strong><br>Type: Incident`);
});

shelters.forEach(item => {
    L.marker([item.lat, item.lng], { icon: blueIcon })
        .addTo(map)
        .bindPopup(`<strong>${item.name}</strong><br>Type: Shelter`);
});

resources.forEach(item => {
    L.marker([item.lat, item.lng], { icon: greenIcon })
        .addTo(map)
        .bindPopup(`<strong>${item.name}</strong><br>Type: Resource Center`);
});