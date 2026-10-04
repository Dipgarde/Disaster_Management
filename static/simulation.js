const $ = id => document.getElementById(id);
const map = L.map('simMap').setView([19.9975, 73.7898], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution: '© OpenStreetMap contributors', maxZoom: 19}).addTo(map);

// ---------- Road graph (nodes + edges) ----------
const nodes = {
  central: [19.9975, 73.7898], panch: [20.0059, 73.7910], gangapur: [20.0100, 73.7500],
  college: [19.9930, 73.7650], shelterA: [19.9930, 73.7850], shelterB: [20.0100, 73.7800]
};
const edges = [['central','panch'],['central','shelterA'],['central','college'],['college','gangapur'],
               ['panch','shelterB'],['gangapur','shelterB'],['shelterA','college']];
let blocked = new Set();
let layers = [];
const keep = l => { layers.push(l); return l; };
Object.entries(nodes).forEach(([k, p]) => {
  if (k.startsWith('shelter')) L.marker(p).addTo(map).bindPopup('🏠 ' + k);
});

function dist(a, b) {
  const R = 6371, r = x => x * Math.PI / 180;
  const dLat = r(b[0]-a[0]), dLng = r(b[1]-a[1]);
  const h = Math.sin(dLat/2)**2 + Math.cos(r(a[0]))*Math.cos(r(b[0]))*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function dijkstra(start, targets) {
  const d = {}, prev = {}, todo = new Set(Object.keys(nodes));
  todo.forEach(n => d[n] = Infinity); d[start] = 0;
  while (todo.size) {
    let u = null; todo.forEach(n => { if (u === null || d[n] < d[u]) u = n; });
    todo.delete(u); if (d[u] === Infinity) break;
    edges.forEach(([a, b]) => {
      if (blocked.has(a + b)) return;
      const v = a === u ? b : b === u ? a : null;
      if (v && d[u] + dist(nodes[a], nodes[b]) < d[v]) { d[v] = d[u] + dist(nodes[a], nodes[b]); prev[v] = u; }
    });
  }
  const best = targets.filter(t => d[t] < Infinity).sort((x, y) => d[x] - d[y])[0];
  if (!best) return null;
  const path = [best]; while (prev[path[0]]) path.unshift(prev[path[0]]);
  return { path, km: d[best].toFixed(2) };
}

// ---------- Logging + i18n ----------
function log(msg, icon) {
  const e = document.querySelector('.sim-log-empty'); if (e) e.remove();
  const li = document.createElement('li');
  li.innerHTML = `<span class="sim-log-time">${new Date().toLocaleTimeString()}</span> ${icon} ${msg}`;
  $('simLog').prepend(li);
}
const alerts = {
  en: t => `⚠️ ${t} ALERT: move to the nearest shelter now.`,
  hi: t => `⚠️ ${t} चेतावनी: तुरंत नज़दीकी आश्रय में जाएँ।`,
  mr: t => `⚠️ ${t} इशारा: ताबडतोब जवळच्या निवाऱ्यात जा.`
};

// ---------- Rule engine ----------
function rules(type, s) {
  const t = {5:['CATASTROPHIC',8,12,6,'#7f1d1d'], 4:['CRITICAL',5,8,4,'#dc2626'], 3:['SERIOUS',3,5,2,'#d97706'],
             2:['MODERATE',1.5,2,1,'#eab308'], 1:['MINOR',0.7,1,0,'#16a34a']}[s];
  let [cls, km, amb, shel, color] = t;
  if (type === 'Earthquake' || type === 'Fire') amb += 2;
  if (type === 'Flood' || type === 'Cyclone') shel += 1;
  return { cls, km, amb, shel, color };
}

$('simSeverity').oninput = e => $('severityLabel').textContent = e.target.value;

$('injectBtn').onclick = () => {
  const type = $('simType').value, sev = +$('simSeverity').value, loc = $('simLocation').value;
  const r = rules(type, sev), p = nodes[loc];
  log(`Event: <b>${type}</b> at <b>${loc}</b>, severity ${sev}`, '📥');
  log(`Rule engine classified: <b>${r.cls}</b>`, '🧠');
  keep(L.marker(p).addTo(map)).bindPopup(`${type}: ${r.cls}`).openPopup();
  const c = keep(L.circle(p, {radius: r.km*1000, color: r.color, fillColor: r.color, fillOpacity: .25}).addTo(map));
  map.fitBounds(c.getBounds());
  if (type === 'Flood' || sev >= 4) { blocked.add('centralshelterA'); log('Road Central to Shelter A blocked', '🚧'); }
  $('sumClass').textContent = r.cls; $('sumRadius').textContent = r.km + ' km';
  $('sumAmb').textContent = r.amb; $('sumShel').textContent = r.shel;
  const b = $('alertBanner'); b.style.display = 'block'; b.style.background = r.color;
  b.textContent = alerts[$('simLang').value](type.toUpperCase());
  log(`Alert sent in <b>${$('simLang').selectedOptions[0].text}</b>; ${r.amb} ambulances, ${r.shel} shelters`, '🚨');
};

// ---------- 2. Routing ----------
$('routeBtn').onclick = () => {
  const res = dijkstra($('simLocation').value, ['shelterA', 'shelterB']);
  if (!res) { $('routeOut').textContent = 'No safe route!'; return; }
  keep(L.polyline(res.path.map(n => nodes[n]), {color: '#2563eb', weight: 5}).addTo(map));
  $('routeOut').innerHTML = `<b>${res.path.join(' → ')}</b><br>${res.km} km` + (blocked.size ? '<br>🚧 detoured around blocked road' : '');
  log(`Safe route found (${res.km} km)`, '🧭');
};

// ---------- 3. Trust-weighted crowd reports ----------
$('crowdBtn').onclick = () => {
  let total = 0;
  const n = 15;
  for (let i = 0; i < n; i++) {
    const age = Math.min(Math.random() * 60 / 30, 1) * 30, acc = Math.random() * 40, geo = Math.random() * 15;
    total += age + acc + geo;
  }
  const avg = Math.round(total / n), bonus = Math.min(n, 15);
  const conf = Math.min(100, avg + bonus);
  $('crowdOut').innerHTML = `${n} reports within 200 m / 5 min<br>Avg trust: <b>${avg}</b> + cluster bonus ${bonus}<br>Confidence: <b>${conf}%</b> ` +
    (conf >= 70 ? '<span class="ok">✔ Auto-verified</span>' : '<span class="risk">Needs authority review</span>');
  log(`Crowd reports scored, confidence ${conf}%`, '👥');
};

// ---------- 4. Dependency graph ----------
const chain = ['⛽ Fuel Depot', '⚡ Generator', '🏠 Shelter A', '🏥 Medical Camp'];
function drawDep(failed) {
  $('depOut').innerHTML = chain.map((c, i) => `<div class="${failed ? (i === 0 ? 'risk' : 'warn') : 'ok'}">${c}${failed ? (i === 0 ? ' ✖ FAILED' : ' ⚠ AT RISK') : ' ✔'}</div>`).join('↓');
}
drawDep(false);
$('failBtn').onclick = () => { drawDep(true); log('Fuel depot failed: 3 downstream resources at risk', '⛓️'); };

// ---------- 5. Volunteer matching (greedy by skill + distance) ----------
$('volBtn').onclick = () => {
  const vols = [{n:'Asha',s:'first-aid',d:1.2},{n:'Ravi',s:'swimming',d:0.8},{n:'Kiran',s:'driving',d:2.1},
                {n:'Meena',s:'first-aid',d:0.5},{n:'Omkar',s:'swimming',d:1.9}];
  const roles = ['swimming', 'first-aid', 'driving'], used = new Set(), out = [];
  roles.forEach(role => {
    const v = vols.filter(x => x.s === role && !used.has(x.n)).sort((a, b) => a.d - b.d)[0];
    if (v) { used.add(v.n); out.push(`${role}: <b>${v.n}</b> (${v.d} km)`); }
  });
  $('volOut').innerHTML = out.join('<br>'); log('Volunteers matched by skill and distance', '🙋');
};

// ---------- 6. Agency conflict resolution ----------
$('conflictBtn').onclick = () => {
  const a = {name: 'NDRF', type: 'life-threat', km: 2}, b = {name: 'Police', type: 'property', km: 1};
  const rank = {'life-threat': 2, 'property': 1};
  const w = rank[a.type] !== rank[b.type] ? (rank[a.type] > rank[b.type] ? a : b) : (a.km <= b.km ? a : b);
  $('conflictOut').innerHTML = `NDRF (life-threat) vs Police (property)<br>Rule: life-threat beats property<br>Winner: <b class="ok">${w.name}</b>`;
  log(`Conflict resolved: ${w.name} gets Shelter A`, '⚖️');
};

// ---------- 7. Offline mesh relay ----------
$('meshBtn').onclick = () => {
  const hops = ['📱 Phone A (no signal)', '📱 Phone B', '📱 Phone C', '🌐 Phone D (has internet)', '🛰️ Server'];
  $('meshOut').innerHTML = '';
  hops.forEach((h, i) => setTimeout(() => {
    $('meshOut').innerHTML += (i ? '→ ' : '') + h + '<br>';
    if (i === hops.length - 1) log('SOS delivered via mesh in ' + (hops.length - 1) + ' hops', '📡');
  }, i * 700));
};

// ---------- 8. Hash-chained donation ledger ----------
const chainLedger = [{i: 0, data: 'genesis', prev: '0', hash: '0'}];
const hash = s => { let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return h.toString(16); };
function drawLedger() {
  $('ledgerOut').innerHTML = chainLedger.slice(-4).map(b => `#${b.i} ${b.data}<br><small>prev ${b.prev} → hash ${b.hash}</small>`).join('<hr>');
}
drawLedger();
$('donateBtn').onclick = () => {
  const last = chainLedger[chainLedger.length - 1];
  const data = `Donor ${last.i + 1}: ₹${(Math.floor(Math.random() * 9) + 1) * 500} to Shelter A`;
  chainLedger.push({i: last.i + 1, data, prev: last.hash, hash: hash(last.hash + data)});
  drawLedger(); log('Donation block added to ledger', '⛓️');
};

// ---------- Reset ----------
$('resetBtn').onclick = () => {
  layers.forEach(l => map.removeLayer(l)); layers = []; blocked.clear();
  $('simLog').innerHTML = '<li class="sim-log-empty">No events yet.</li>';
  ['sumClass','sumRadius','sumAmb','sumShel'].forEach(id => $(id).textContent = '-');
  ['routeOut','crowdOut','volOut','conflictOut','meshOut'].forEach(id => $(id).innerHTML = '');
  $('alertBanner').style.display = 'none'; drawDep(false);
  map.setView([19.9975, 73.7898], 12);
};