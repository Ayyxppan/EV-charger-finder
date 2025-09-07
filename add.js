// app.js
const OCM_API_KEY = '8992aee4-ea5e-4c80-a79d-1f7d9fcbb8ce'; // put your key here (or leave empty for demo)
let map;
let userMarker;
const stationsLayer = L.layerGroup();

function init() {
  // Default center (Bengaluru) — will be overridden if user shares location
  map = L.map('map').setView([12.9716, 77.5946], 13);

  // OpenStreetMap tiles (Leaflet quickstart uses this). Attribution required. :contentReference[oaicite:4]{index=4}
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  stationsLayer.addTo(map);

  // UI hooks
  document.getElementById('btnLocate').addEventListener('click', locateUser);
  document.getElementById('btnSearch').addEventListener('click', onSearch);

  // Optional: add geocoder control (uses Nominatim behind the scenes) if plugin loaded
  if (L.Control && L.Control.Geocoder) {
    L.Control.geocoder({ position: 'topleft' }).addTo(map);
  }

  // Try to auto-locate on load
  locateUser();
}

function onSearch() {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) return;
  // Use Nominatim for geocoding (simple single-result search). See usage policy (rate limit, user-agent). :contentReference[oaicite:5]{index=5}
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
  fetch(url)
    .then(r => r.json())
    .then(results => {
      if (!results || results.length === 0) return alert('Location not found');
      const r0 = results[0];
      const lat = parseFloat(r0.lat), lon = parseFloat(r0.lon);
      map.setView([lat, lon], 13);
      fetchStations(lat, lon, 5);
    })
    .catch(err => {
      console.error('Geocode error', err);
      alert('Geocoding failed — try again.');
    });
}

function locateUser() {
  if (!navigator.geolocation) {
    alert('Geolocation not supported by your browser');
    return;
  }
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude, lon = pos.coords.longitude;
    if (userMarker) userMarker.remove();
    userMarker = L.marker([lat, lon], { title: 'You are here' }).addTo(map);
    map.setView([lat, lon], 14);
    fetchStations(lat, lon, 5);
  }, err => {
    console.warn('Geolocation failed:', err);
    // fallback: load stations in default map center
    const c = map.getCenter();
    fetchStations(c.lat, c.lng, 5);
  }, { enableHighAccuracy: true, timeout: 10000 });
}

function fetchStations(lat, lon, radiusKm=5, maxResults=50) {
  stationsLayer.clearLayers();

  // OpenChargeMap 'poi' endpoint — get POIs near lat/lon. See docs. :contentReference[oaicite:6]{index=6}
  let url = `https://api.openchargemap.io/v3/poi/?output=json&latitude=${lat}&longitude=${lon}&distance=${radiusKm}&distanceunit=KM&maxresults=${maxResults}&compact=true`;
  if (OCM_API_KEY && OCM_API_KEY.length) {
    // you can pass key as query param (or as X-API-Key header)
    url += `&key=${encodeURIComponent(OCM_API_KEY)}`;
  }

  fetch(url, { headers: { 'Accept': 'application/json' } })
    .then(resp => {
      if (!resp.ok) throw new Error('Network response was not ok');
      return resp.json();
    })
    .then(data => {
      if (!Array.isArray(data) || data.length === 0) {
        return alert('No charging stations found nearby (try increasing radius).');
      }
      data.forEach(poi => {
        const ai = poi.AddressInfo || {};
        const lat = ai.Latitude, lon = ai.Longitude;
        if (!lat || !lon) return;
        const title = ai.Title || 'Charging station';
        const addr = [ai.AddressLine1, ai.Town, ai.Postcode].filter(Boolean).join(', ');
        // build connections summary
        const conns = (poi.Connections || []).map(c => c.ConnectionType?.Title || c.ConnectionTypeID || 'Unknown');
        const popupHtml = `
          <div style="min-width:200px">
            <strong>${escapeHtml(title)}</strong><br/>
            <small>${escapeHtml(addr)}</small><br/>
            <small>Connections: ${conns.length ? escapeHtml(conns.join(', ')) : 'N/A'}</small><br/>
            <a target="_blank" href="https://www.openstreetmap.org/directions?to=${lat},${lon}">Directions</a>
          </div>
        `;
        L.marker([lat, lon])
          .addTo(stationsLayer)
          .bindPopup(popupHtml);
      });
    })
    .catch(err => {
      console.error('Failed to load stations', err);
      alert('Failed to fetch stations (check console).');
    });
}

// small helper to avoid HTML injection in popups
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]); }

// start
window.addEventListener('load', init);
