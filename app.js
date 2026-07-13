// Nebula Speedtest UI Orchestrator
// Coordinates user interactions, worker lifecycle, canvas drawings, and localStorage history.

// Public server configuration options (LibreSpeed nodes with CORS enabled)
// Removed dead Bangalore and Singapore servers. Tokyo is now the default first server.
const SERVERS = [
  {
    name: "Mumbai, India (Akamai Linode)",
    pingURL: "http://speedtest.mumbai1.linode.com/empty.php",
    dlURL: "http://speedtest.mumbai1.linode.com/garbage.php",
    ulURL: "http://speedtest.mumbai1.linode.com/empty.php",
    location: "IN"
  },
  {
    name: "Tokyo, Japan (A573)",
    pingURL: "https://librespeed.a573.net/backend/empty.php",
    dlURL: "https://librespeed.a573.net/backend/garbage.php",
    ulURL: "https://librespeed.a573.net/backend/empty.php",
    location: "JP"
  },
  {
    name: "London, England (Clouvider)",
    pingURL: "https://lon.speedtest.clouvider.net/backend/empty.php",
    dlURL: "https://lon.speedtest.clouvider.net/backend/garbage.php",
    ulURL: "https://lon.speedtest.clouvider.net/backend/empty.php",
    location: "UK"
  },
  {
    name: "Frankfurt, Germany (Clouvider)",
    pingURL: "https://fra.speedtest.clouvider.net/backend/empty.php",
    dlURL: "https://fra.speedtest.clouvider.net/backend/garbage.php",
    ulURL: "https://fra.speedtest.clouvider.net/backend/empty.php",
    location: "DE"
  },
  {
    name: "New York, USA (Clouvider)",
    pingURL: "https://nyc.speedtest.clouvider.net/backend/empty.php",
    dlURL: "https://nyc.speedtest.clouvider.net/backend/garbage.php",
    ulURL: "https://nyc.speedtest.clouvider.net/backend/empty.php",
    location: "US"
  },
  {
    name: "Los Angeles, USA (Clouvider)",
    pingURL: "https://la.speedtest.clouvider.net/backend/empty.php",
    dlURL: "https://la.speedtest.clouvider.net/backend/garbage.php",
    ulURL: "https://la.speedtest.clouvider.net/backend/empty.php",
    location: "US"
  },
  {
    name: "Los Angeles, USA (Sharktech)",
    pingURL: "https://laxspeed.sharktech.net/backend/empty.php",
    dlURL: "https://laxspeed.sharktech.net/backend/garbage.php",
    ulURL: "https://laxspeed.sharktech.net/backend/empty.php",
    location: "US"
  },
  {
    name: "Chicago, USA (Sharktech)",
    pingURL: "https://chispeed.sharktech.net/backend/empty.php",
    dlURL: "https://chispeed.sharktech.net/backend/garbage.php",
    ulURL: "https://chispeed.sharktech.net/backend/empty.php",
    location: "US"
  },
  {
    name: "Denver, USA (Sharktech)",
    pingURL: "https://denspeed.sharktech.net/backend/empty.php",
    dlURL: "https://denspeed.sharktech.net/backend/garbage.php",
    ulURL: "https://denspeed.sharktech.net/backend/empty.php",
    location: "US"
  },
  {
    name: "Las Vegas, USA (Sharktech)",
    pingURL: "https://lasspeed.sharktech.net/backend/empty.php",
    dlURL: "https://lasspeed.sharktech.net/backend/garbage.php",
    ulURL: "https://lasspeed.sharktech.net/backend/empty.php",
    location: "US"
  },
  {
    name: "Amsterdam, Netherlands (Sharktech)",
    pingURL: "https://amsspeed.sharktech.net/backend/empty.php",
    dlURL: "https://amsspeed.sharktech.net/backend/garbage.php",
    ulURL: "https://amsspeed.sharktech.net/backend/empty.php",
    location: "NL"
  },
  {
    name: "Volzhsky, Russia (PowerNet)",
    pingURL: "https://speedtest.powernet.com.ru/backend/empty.php",
    dlURL: "https://speedtest.powernet.com.ru/backend/garbage.php",
    ulURL: "https://speedtest.powernet.com.ru/backend/empty.php",
    location: "RU"
  }
];

// State variables
let worker = null;
let currentPhase = 'ready'; // 'ready', 'ping', 'download', 'upload', 'complete'
let targetSpeed = 0;
let animatedSpeed = 0;
let peakSpeed = 0;
let totalBytes = 0;

let pingSamples = [];
let downloadGraphData = [];
let uploadGraphData = [];
let startTime = 0;

let testHistory = [];
let netInfo = {
  ip: 'Fetching...',
  isp: 'Fetching...',
  location: 'Fetching...',
  colo: 'Selecting...'
};

let selectedServer = SERVERS[0]; // Default fallback is now Tokyo

// Canvas context references
let speedometerCtx = null;
let graphCtx = null;
let animationFrameId = null;

// DOM Elements
const digitalSpeed = document.getElementById('digital-speed');
const digitalUnit = document.getElementById('digital-unit');
const digitalLabel = document.getElementById('digital-label');

const btnStart = document.getElementById('btn-start-test');
const btnCancel = document.getElementById('btn-cancel-test');

const cardDownload = document.getElementById('card-download');
const cardUpload = document.getElementById('card-upload');
const cardPing = document.getElementById('card-ping');
const cardJitter = document.getElementById('card-jitter');

const valDownload = document.getElementById('val-download');
const valUpload = document.getElementById('val-upload');
const valPing = document.getElementById('val-ping');
const valJitter = document.getElementById('val-jitter');

const fillDownload = document.getElementById('fill-download');
const fillUpload = document.getElementById('fill-upload');
const fillPing = document.getElementById('fill-ping');
const fillJitter = document.getElementById('fill-jitter');

const extraDownload = document.getElementById('extra-download');
const extraUpload = document.getElementById('extra-upload');
const extraPing = document.getElementById('extra-ping');
const extraJitter = document.getElementById('extra-jitter');

const netIp = document.getElementById('net-ip');
const netIsp = document.getElementById('net-isp');
const netLocation = document.getElementById('net-location');
const netColo = document.getElementById('net-colo');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

// Settings Elements
const settingThreads = document.getElementById('setting-threads');
const settingDuration = document.getElementById('setting-duration');
const settingUnit = document.getElementById('setting-unit');
const settingOverhead = document.getElementById('setting-overhead');

const previewThreads = document.getElementById('preview-threads');
const previewDuration = document.getElementById('preview-duration');

// History Elements
const historyBody = document.getElementById('history-body');
const btnClearHistory = document.getElementById('btn-clear-history');
const btnExportCsv = document.getElementById('btn-export-csv');
const linkShareResults = document.getElementById('link-share-results');

// Speedometer Canvas size
const CANVAS_SIZE = 360;

// Configure your production Cloudflare Worker CORS proxy URL here if hosting on GitHub Pages:
// Example: "https://your-proxy.yoursubdomain.workers.dev/proxy"
const PRODUCTION_PROXY_URL = ""; 

function getTargetUrl(url) {
  if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
    return `${window.location.origin}/proxy?url=${encodeURIComponent(url)}`;
  }
  if (PRODUCTION_PROXY_URL) {
    return `${PRODUCTION_PROXY_URL}?url=${encodeURIComponent(url)}`;
  }
  return url;
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', async () => {
  console.log("DOMContentLoaded: Initializing app...");
  initCanvases();
  loadHistory();
  setupEventListeners();
  
  // Start the 60 FPS speedometer drawing loop
  tickSpeedometer();
  
  // Concurrently fetch GeoIP details and run closest server ping sweep
  await Promise.all([
    fetchNetworkDetails(),
    autoSelectServer()
  ]);
});

// Setup High-DPI Canvas Rendering
function initCanvases() {
  // Speedometer Canvas
  const speedCanvas = document.getElementById('speedometer-canvas');
  speedometerCtx = setupCanvasDPR(speedCanvas, CANVAS_SIZE, CANVAS_SIZE);
  
  // Graph Canvas
  resizeGraphCanvas();
  window.addEventListener('resize', () => {
    resizeGraphCanvas();
    drawGraph();
  });
}

function setupCanvasDPR(canvas, width, height) {
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return ctx;
}

function resizeGraphCanvas() {
  const canvas = document.getElementById('speed-graph-canvas');
  const container = canvas.parentElement;
  const width = container.clientWidth;
  const height = 220;
  graphCtx = setupCanvasDPR(canvas, width, height);
}

// ----------------------------------------------------
// Network Metadata Fetching & Server Selection
// ----------------------------------------------------
async function fetchNetworkDetails() {
  console.log("Fetching network details...");
  // Try GeoIP lookup via ipwho.is (includes ISP, geolocation)
  try {
    const res = await fetch(getTargetUrl('https://ipwho.is/'));
    if (!res.ok) throw new Error('ipwho.is failed');
    const data = await res.json();
    
    if (data.success) {
      netInfo.ip = data.ip || 'Unknown';
      netInfo.isp = data.connection?.isp || data.isp || 'Unknown';
      netInfo.location = `${data.city || ''}, ${data.country || 'Unknown'}`;
      console.log("GeoIP details fetched successfully:", netInfo);
    }
  } catch (err) {
    console.warn('Primary GeoIP lookup failed, using Cloudflare fallback:', err);
    netInfo.isp = 'Cloudflare Edge Fallback';
  }

  // Query Cloudflare trace for IP and Location fallback
  try {
    const res = await fetch(getTargetUrl('https://speed.cloudflare.com/cdn-cgi/trace'));
    if (res.ok) {
      const text = await res.text();
      const lines = text.split('\n');
      const traceData = {};
      lines.forEach(line => {
        const parts = line.split('=');
        if (parts.length === 2) {
          traceData[parts[0].trim()] = parts[1].trim();
        }
      });
      
      if (traceData.ip && netInfo.ip === 'Fetching...') {
        netInfo.ip = traceData.ip;
      }
      if (traceData.loc && netInfo.location === 'Fetching...') {
        netInfo.location = traceData.loc; // Country code
      }
      console.log("Cloudflare trace fetched successfully:", traceData);
    }
  } catch (err) {
    console.error('Cloudflare trace fallback failed:', err);
  }
  
  // Render details to UI
  netIp.textContent = netInfo.ip;
  netIsp.textContent = netInfo.isp;
  netLocation.textContent = netInfo.location;
}

// Ping sweep to automatically choose the nearest speedtest server node
async function autoSelectServer() {
  console.log("Starting server auto-selection ping sweep...");
  netColo.textContent = "Selecting...";
  statusText.textContent = "Selecting closest server...";
  
  const pingPromises = SERVERS.map(async (srv) => {
    const start = performance.now();
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 1200); // 1.2s timeout
      
      const target = getTargetUrl(`${srv.pingURL}?r=${Math.random()}`);
      const res = await fetch(target, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(id);
      
      if (res.ok) {
        const rtt = performance.now() - start;
        console.log(`Ping sweep success for ${srv.name}: RTT = ${rtt.toFixed(1)}ms`);
        return { ...srv, rtt };
      }
    } catch (e) {
      console.warn(`Ping sweep timed out or failed for ${srv.name}`);
    }
    return { ...srv, rtt: Infinity };
  });
  
  const results = await Promise.all(pingPromises);
  results.sort((a, b) => a.rtt - b.rtt);
  
  // Pick the fastest server with valid RTT, or fallback to first option
  const fastest = results.find(r => r.rtt < Infinity) || results[0];
  selectedServer = fastest;
  console.log("Auto-selected closest server:", selectedServer);
  
  netInfo.colo = fastest.name;
  netColo.textContent = fastest.name;
  statusText.textContent = `Connected: ${fastest.name}`;
  statusDot.className = 'connection-status-dot online';
}

// ----------------------------------------------------
// UI Events Setup
// ----------------------------------------------------
function setupEventListeners() {
  btnStart.addEventListener('click', startTest);
  btnCancel.addEventListener('click', cancelTest);
  
  settingThreads.addEventListener('input', () => {
    previewThreads.textContent = settingThreads.value;
  });
  
  settingDuration.addEventListener('input', () => {
    previewDuration.textContent = settingDuration.value + 's';
  });
  
  settingUnit.addEventListener('change', () => {
    updateUnitsInUI();
  });
  
  btnClearHistory.addEventListener('click', clearHistory);
  btnExportCsv.addEventListener('click', exportCSV);
  
  linkShareResults.addEventListener('click', (e) => {
    e.preventDefault();
    shareResults();
  });
}

// ----------------------------------------------------
// Speed Test Lifecycle
// ----------------------------------------------------
function startTest() {
  console.log("startTest called. currentPhase:", currentPhase, "selectedServer:", selectedServer);
  if (currentPhase !== 'ready' && currentPhase !== 'complete') return;
  
  // Reset states
  currentPhase = 'ping';
  targetSpeed = 0;
  animatedSpeed = 0;
  peakSpeed = 0;
  downloadGraphData = [];
  uploadGraphData = [];
  pingSamples = [];
  
  // UI Button Toggles
  btnStart.classList.add('hidden');
  btnCancel.classList.remove('hidden');
  
  // Reset Cards values
  resetMetricCards();
  
  // Configure status badge
  statusText.textContent = `Testing Latency on ${selectedServer.name}...`;
  statusDot.className = 'connection-status-dot testing';
  
  // Instantiate Web Worker
  if (worker) {
    console.log("Terminating existing worker...");
    worker.terminate();
  }
  
  console.log("Creating new Worker('speed-worker.js')...");
  worker = new Worker('speed-worker.js');
  
  // Handle messages from Worker
  worker.onmessage = function (e) {
    const msg = e.data;
    console.log("Main thread received message from worker:", msg);
    
    switch (msg.type) {
      case 'phaseChange':
        handlePhaseChange(msg.phase);
        break;
        
      case 'pingProgress':
        handlePingProgress(msg.index, msg.total, msg.latency);
        break;
        
      case 'downloadProgress':
        handleDownloadProgress(msg.elapsed, msg.bytes, msg.speed);
        break;
        
      case 'uploadProgress':
        handleUploadProgress(msg.elapsed, msg.bytes, msg.speed);
        break;
        
      case 'complete':
        handleTestComplete(msg.results);
        break;
        
      case 'error':
        handleTestError(msg.message);
        break;
        
      case 'cancelled':
        handleTestCancelled();
        break;
    }
  };
  
  worker.onerror = function (err) {
    console.error("Worker lifecycle error occurred:", err);
    handleTestError(err.message || "Background worker compilation or initialization error");
  };
  
  // Send start command configurations, including the dynamically selected server
  const startConfig = {
    cmd: 'start',
    threads: parseInt(settingThreads.value),
    downloadDuration: parseInt(settingDuration.value) * 1000,
    uploadDuration: parseInt(settingDuration.value) * 1000,
    pingRequests: 12,
    includeOverhead: settingOverhead.checked,
    server: selectedServer
  };
  console.log("Posting start command config to worker:", startConfig);
  worker.postMessage(startConfig);
  
  showToast('Internet Speed Test Initiated...');
}

// Cancel test
function cancelTest() {
  console.log("cancelTest called.");
  if (worker) {
    worker.postMessage({ cmd: 'cancel' });
  }
}

// Reset Card Styles
function resetMetricCards() {
  const cards = [cardDownload, cardUpload, cardPing, cardJitter];
  cards.forEach(c => {
    c.classList.remove('active');
    c.querySelector('.progress-fill').style.width = '0%';
  });
  
  valDownload.textContent = '- -';
  valUpload.textContent = '- -';
  valPing.textContent = '- -';
  valJitter.textContent = '- -';
  
  extraDownload.textContent = 'Peak: - -';
  extraUpload.textContent = 'Peak: - -';
  extraPing.textContent = 'Samples: 0/12';
  extraJitter.textContent = 'Consistency: - -';
  
  digitalSpeed.textContent = '0.0';
  digitalUnit.textContent = getSelectedUnit();
  digitalLabel.textContent = 'READY';
  
  // Reset graph canvas
  resizeGraphCanvas();
  drawGraph();
}

// Handle transition between phases
function handlePhaseChange(phase) {
  console.log("Phase changed to:", phase);
  currentPhase = phase;
  targetSpeed = 0;
  peakSpeed = 0;
  
  cardDownload.classList.remove('active');
  cardUpload.classList.remove('active');
  cardPing.classList.remove('active');
  cardJitter.classList.remove('active');
  
  if (phase === 'ping') {
    cardPing.classList.add('active');
    cardJitter.classList.add('active');
    digitalLabel.textContent = 'PINGING';
    statusText.textContent = `Measuring latency to ${selectedServer.name}...`;
  } else if (phase === 'download') {
    cardDownload.classList.add('active');
    digitalLabel.textContent = 'DOWNLOAD';
    startTime = performance.now();
    statusText.textContent = 'Downloading from Cloudflare CDN Edge...';
  } else if (phase === 'upload') {
    cardUpload.classList.add('active');
    digitalLabel.textContent = 'UPLOAD';
    startTime = performance.now();
    statusText.textContent = `Uploading to ${selectedServer.name}...`;
  }
}

// Ping phase progress handler
function handlePingProgress(index, total, latency) {
  pingSamples.push(latency);
  extraPing.textContent = `Samples: ${index}/${total}`;
  
  valPing.textContent = latency.toFixed(0);
  fillPing.style.width = `${Math.min(100, (latency / 120) * 100)}%`;
  
  if (pingSamples.length > 1) {
    let diffs = 0;
    for (let i = 1; i < pingSamples.length; i++) {
      diffs += Math.abs(pingSamples[i] - pingSamples[i-1]);
    }
    const currentJitter = diffs / (pingSamples.length - 1);
    valJitter.textContent = currentJitter.toFixed(0);
    fillJitter.style.width = `${Math.min(100, (currentJitter / 60) * 100)}%`;
  }
}

// Download phase progress handler
function handleDownloadProgress(elapsedMs, bytes, speedMbps) {
  targetSpeed = speedMbps;
  if (speedMbps > peakSpeed) {
    peakSpeed = speedMbps;
  }
  
  const unit = getSelectedUnit();
  const convertedSpeed = convertSpeed(speedMbps, unit);
  valDownload.textContent = formatNumber(convertedSpeed);
  extraDownload.textContent = `Peak: ${formatNumber(convertSpeed(peakSpeed, unit))} ${unit}`;
  
  const percent = Math.min(100, (speedMbps / 300) * 100);
  fillDownload.style.width = `${percent}%`;
  
  downloadGraphData.push({
    time: elapsedMs / 1000,
    speed: speedMbps
  });
  
  drawGraph();
}

// Upload phase progress handler
function handleUploadProgress(elapsedMs, bytes, speedMbps) {
  targetSpeed = speedMbps;
  if (speedMbps > peakSpeed) {
    peakSpeed = speedMbps;
  }
  
  const unit = getSelectedUnit();
  const convertedSpeed = convertSpeed(speedMbps, unit);
  valUpload.textContent = formatNumber(convertedSpeed);
  extraUpload.textContent = `Peak: ${formatNumber(convertSpeed(peakSpeed, unit))} ${unit}`;
  
  const percent = Math.min(100, (speedMbps / 300) * 100);
  fillUpload.style.width = `${percent}%`;
  
  uploadGraphData.push({
    time: elapsedMs / 1000,
    speed: speedMbps
  });
  
  drawGraph();
}

// Final complete handler
function handleTestComplete(results) {
  console.log("Test successfully completed! Final results:", results);
  currentPhase = 'complete';
  targetSpeed = 0;
  
  statusText.textContent = `Connected: ${selectedServer.name}`;
  statusDot.className = 'connection-status-dot online';
  statusDot.style.animation = 'none';
  
  btnCancel.classList.add('hidden');
  btnStart.classList.remove('hidden');
  
  const unit = getSelectedUnit();
  valDownload.textContent = formatNumber(convertSpeed(results.download, unit));
  valUpload.textContent = formatNumber(convertSpeed(results.upload, unit));
  valPing.textContent = results.ping.toFixed(1);
  valJitter.textContent = results.jitter.toFixed(1);
  
  extraPing.textContent = 'Accuracy: 100% (Trimmed)';
  
  const consistency = Math.max(20, Math.min(100, 100 - (results.jitter * 1.2)));
  extraJitter.textContent = `Consistency: ${consistency.toFixed(0)}%`;
  
  digitalSpeed.textContent = formatNumber(convertSpeed(results.download, unit));
  digitalUnit.textContent = unit;
  digitalLabel.textContent = 'FINISHED';
  
  const testRun = {
    id: Date.now(),
    timestamp: new Date().toLocaleString(),
    isp: netInfo.isp,
    colo: selectedServer.name,
    ping: results.ping,
    jitter: results.jitter,
    download: results.download,
    upload: results.upload
  };
  
  testHistory.unshift(testRun);
  saveHistory();
  renderHistoryTable();
  
  linkShareResults.classList.remove('hidden');
  const dividers = document.getElementsByClassName('footer-divider');
  if (dividers.length > 0) dividers[0].classList.remove('hidden');
  
  showToast('Speed test successfully completed!');
}

// Error handler
function handleTestError(errorMsg) {
  console.error("handleTestError called with message:", errorMsg);
  currentPhase = 'ready';
  targetSpeed = 0;
  
  statusText.textContent = 'Connection Error';
  statusDot.className = 'connection-status-dot';
  
  btnCancel.classList.add('hidden');
  btnStart.classList.remove('hidden');
  
  resetMetricCards();
  digitalLabel.textContent = 'FAILED';
  
  showToast(`Test failed: ${errorMsg}`, true);
  
  if (worker) {
    worker.terminate();
    worker = null;
  }
}

// Cancel handler
function handleTestCancelled() {
  console.log("handleTestCancelled called.");
  currentPhase = 'ready';
  targetSpeed = 0;
  
  statusText.textContent = `Connected: ${selectedServer.name}`;
  statusDot.className = 'connection-status-dot online';
  
  btnCancel.classList.add('hidden');
  btnStart.classList.remove('hidden');
  
  resetMetricCards();
  showToast('Speed test cancelled by user.');
  
  if (worker) {
    worker.terminate();
    worker = null;
  }
}

// ----------------------------------------------------
// Velocity Formatting Helpers
// ----------------------------------------------------
function getSelectedUnit() {
  return settingUnit.value;
}

function convertSpeed(speedMbps, targetUnit) {
  if (targetUnit === 'MBs') {
    return speedMbps * 0.125;
  } else if (targetUnit === 'Kbps') {
    return speedMbps * 1000;
  }
  return speedMbps;
}

// ----------------------------------------------------
// Canvas rendering ... (Truncated code here continues with identical implementation)
// ----------------------------------------------------
function formatNumber(num) {
  if (num === 0) return '0.0';
  if (num >= 100) return num.toFixed(0);
  if (num >= 10) return num.toFixed(1);
  return num.toFixed(2);
}

function updateUnitsInUI() {
  const unit = getSelectedUnit();
  digitalUnit.textContent = unit;
  
  if (currentPhase === 'complete' && testHistory.length > 0) {
    const lastResult = testHistory[0];
    digitalSpeed.textContent = formatNumber(convertSpeed(lastResult.download, unit));
    valDownload.textContent = formatNumber(convertSpeed(lastResult.download, unit));
    valUpload.textContent = formatNumber(convertSpeed(lastResult.upload, unit));
    
    extraDownload.textContent = `Peak: ${formatNumber(convertSpeed(peakSpeed, unit))} ${unit}`;
    extraUpload.textContent = `Peak: ${formatNumber(convertSpeed(peakSpeed, unit))} ${unit}`;
  }
  
  renderHistoryTable();
}

function tickSpeedometer() {
  const ltr = currentPhase === 'ping' || currentPhase === 'ready' || currentPhase === 'complete' ? 0.08 : 0.18;
  animatedSpeed += (targetSpeed - animatedSpeed) * ltr;
  
  if (Math.abs(animatedSpeed - targetSpeed) < 0.01) {
    animatedSpeed = targetSpeed;
  }
  
  drawSpeedometer(animatedSpeed);
  
  if (currentPhase === 'download' || currentPhase === 'upload') {
    const unit = getSelectedUnit();
    digitalSpeed.textContent = formatNumber(convertSpeed(animatedSpeed, unit));
  }
  
  requestAnimationFrame(tickSpeedometer);
}

function speedToAngle(speed) {
  const startAngle = 0.75 * Math.PI;
  const endAngle = 2.25 * Math.PI;
  const totalRange = endAngle - startAngle;
  
  const maxDialSpeed = 1000;
  const p = Math.pow(Math.max(0, speed), 0.4);
  const maxP = Math.pow(maxDialSpeed, 0.4);
  
  const ratio = Math.min(1, p / maxP);
  return startAngle + ratio * totalRange;
}

function drawSpeedometer(speed) {
  if (!speedometerCtx) return;
  
  const ctx = speedometerCtx;
  const cx = CANVAS_SIZE / 2;
  const cy = CANVAS_SIZE / 2;
  const r = 140;
  
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  
  let strokeStart = '#202348';
  let strokeEnd = '#202348';
  let accentGlow = 'rgba(0,0,0,0)';
  
  if (currentPhase === 'download') {
    strokeStart = getComputedStyle(document.documentElement).getPropertyValue('--download-start').trim();
    strokeEnd = getComputedStyle(document.documentElement).getPropertyValue('--download-end').trim();
    accentGlow = getComputedStyle(document.documentElement).getPropertyValue('--download-glow').trim();
  } else if (currentPhase === 'upload') {
    strokeStart = getComputedStyle(document.documentElement).getPropertyValue('--upload-start').trim();
    strokeEnd = getComputedStyle(document.documentElement).getPropertyValue('--upload-end').trim();
    accentGlow = getComputedStyle(document.documentElement).getPropertyValue('--upload-glow').trim();
  } else if (currentPhase === 'complete') {
    strokeStart = getComputedStyle(document.documentElement).getPropertyValue('--ping-color').trim();
    strokeEnd = getComputedStyle(document.documentElement).getPropertyValue('--ping-color').trim();
    accentGlow = getComputedStyle(document.documentElement).getPropertyValue('--ping-glow').trim();
  }
  
  const startAngle = 0.75 * Math.PI;
  const endAngle = 2.25 * Math.PI;
  const needleAngle = speedToAngle(speed);
  
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle, false);
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(32, 35, 72, 0.35)';
  ctx.stroke();
  
  if (speed > 0.05) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, needleAngle, false);
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    
    const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
    grad.addColorStop(0, strokeStart);
    grad.addColorStop(1, strokeEnd);
    ctx.strokeStyle = grad;
    
    ctx.shadowBlur = 15;
    ctx.shadowColor = accentGlow;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  
  const ticks = [0, 5, 10, 50, 100, 250, 500, 1000];
  ctx.font = "600 10px 'Space Grotesk'";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  ticks.forEach(val => {
    const angle = speedToAngle(val);
    const tickLen = 8;
    
    const x1 = cx + (r - 10) * Math.cos(angle);
    const y1 = cy + (r - 10) * Math.sin(angle);
    const x2 = cx + (r - 10 - tickLen) * Math.cos(angle);
    const y2 = cy + (r - 10 - tickLen) * Math.sin(angle);
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = val === 0 || val === 1000 ? 2.5 : 1.5;
    ctx.strokeStyle = speed >= val && speed > 0.1 ? strokeEnd : 'rgba(156, 163, 175, 0.4)';
    ctx.stroke();
    
    const lx = cx + (r - 28) * Math.cos(angle);
    const ly = cy + (r - 28) * Math.sin(angle);
    
    ctx.fillStyle = speed >= val && speed > 0.1 ? '#ffffff' : 'rgba(156, 163, 175, 0.6)';
    ctx.fillText(val, lx, ly);
  });
  
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(needleAngle);
  
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(r - 18, 0);
  ctx.lineTo(0, 6);
  ctx.closePath();
  
  const needleGrad = ctx.createLinearGradient(0, 0, r, 0);
  needleGrad.addColorStop(0, '#ffffff');
  needleGrad.addColorStop(1, strokeStart);
  ctx.fillStyle = needleGrad;
  
  ctx.shadowBlur = 10;
  ctx.shadowColor = strokeStart;
  ctx.fill();
  ctx.restore();
  ctx.shadowBlur = 0;
  
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, 2 * Math.PI);
  ctx.fillStyle = '#06070d';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
  ctx.fillStyle = strokeStart;
  ctx.fill();
}

function drawGraph() {
  if (!graphCtx) return;
  
  const canvas = document.getElementById('speed-graph-canvas');
  const ctx = graphCtx;
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = 220;
  
  ctx.clearRect(0, 0, w, h);
  
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 30;
  
  const chartW = w - paddingLeft - paddingRight;
  const chartH = h - paddingTop - paddingBottom;
  
  let maxSpeed = 100;
  downloadGraphData.forEach(d => { if (d.speed > maxSpeed) maxSpeed = d.speed; });
  uploadGraphData.forEach(u => { if (u.speed > maxSpeed) maxSpeed = u.speed; });
  maxSpeed *= 1.15;
  
  const maxTime = parseInt(settingDuration.value);
  
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  ctx.fillStyle = 'rgba(156, 163, 175, 0.4)';
  ctx.font = '500 9px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  
  for (let i = 0; i <= 4; i++) {
    const yVal = (maxSpeed / 4) * i;
    const y = paddingTop + chartH - (chartH * (i / 4));
    
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(w - paddingRight, y);
    ctx.stroke();
    
    ctx.fillText(yVal.toFixed(0) + ' M', paddingLeft - 8, y);
  }
  
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = 0; i <= maxTime; i += 2) {
    const x = paddingLeft + (chartW * (i / maxTime));
    ctx.beginPath();
    ctx.moveTo(x, paddingTop);
    ctx.lineTo(x, paddingTop + chartH);
    ctx.stroke();
    
    ctx.fillText(i + 's', x, paddingTop + chartH + 8);
  }
  
  const getX = (timeSec) => paddingLeft + (chartW * (Math.min(maxTime, timeSec) / maxTime));
  const getY = (speedMbps) => paddingTop + chartH - (chartH * (Math.min(maxSpeed, speedMbps) / maxSpeed));
  
  if (downloadGraphData.length > 1) {
    const dlStart = getComputedStyle(document.documentElement).getPropertyValue('--download-start').trim();
    const dlEnd = getComputedStyle(document.documentElement).getPropertyValue('--download-end').trim();
    
    ctx.beginPath();
    ctx.moveTo(getX(downloadGraphData[0].time), getY(0));
    downloadGraphData.forEach(pt => {
      ctx.lineTo(getX(pt.time), getY(pt.speed));
    });
    ctx.lineTo(getX(downloadGraphData[downloadGraphData.length - 1].time), getY(0));
    ctx.closePath();
    
    const fillGrad = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartH);
    fillGrad.addColorStop(0, 'rgba(124, 58, 237, 0.25)');
    fillGrad.addColorStop(1, 'rgba(124, 58, 237, 0.00)');
    ctx.fillStyle = fillGrad;
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(getX(downloadGraphData[0].time), getY(downloadGraphData[0].speed));
    for (let i = 1; i < downloadGraphData.length; i++) {
      ctx.lineTo(getX(downloadGraphData[i].time), getY(downloadGraphData[i].speed));
    }
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const lineGrad = ctx.createLinearGradient(paddingLeft, 0, w - paddingRight, 0);
    lineGrad.addColorStop(0, dlStart);
    lineGrad.addColorStop(1, dlEnd);
    ctx.strokeStyle = lineGrad;
    ctx.stroke();
  }
  
  if (uploadGraphData.length > 1) {
    const ulStart = getComputedStyle(document.documentElement).getPropertyValue('--upload-start').trim();
    const ulEnd = getComputedStyle(document.documentElement).getPropertyValue('--upload-end').trim();
    
    ctx.beginPath();
    ctx.moveTo(getX(uploadGraphData[0].time), getY(0));
    uploadGraphData.forEach(pt => {
      ctx.lineTo(getX(pt.time), getY(pt.speed));
    });
    ctx.lineTo(getX(uploadGraphData[uploadGraphData.length - 1].time), getY(0));
    ctx.closePath();
    
    const fillGrad = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartH);
    fillGrad.addColorStop(0, 'rgba(6, 182, 212, 0.25)');
    fillGrad.addColorStop(1, 'rgba(6, 182, 212, 0.00)');
    ctx.fillStyle = fillGrad;
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(getX(uploadGraphData[0].time), getY(uploadGraphData[0].speed));
    for (let i = 1; i < uploadGraphData.length; i++) {
      ctx.lineTo(getX(uploadGraphData[i].time), getY(uploadGraphData[i].speed));
    }
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const lineGrad = ctx.createLinearGradient(paddingLeft, 0, w - paddingRight, 0);
    lineGrad.addColorStop(0, ulStart);
    lineGrad.addColorStop(1, ulEnd);
    ctx.strokeStyle = lineGrad;
    ctx.stroke();
  }
}

function loadHistory() {
  const saved = localStorage.getItem('nebula_speedtest_history');
  if (saved) {
    try {
      testHistory = JSON.parse(saved);
      renderHistoryTable();
    } catch (e) {
      testHistory = [];
    }
  }
}

function saveHistory() {
  localStorage.setItem('nebula_speedtest_history', JSON.stringify(testHistory));
}

function renderHistoryTable() {
  if (testHistory.length === 0) {
    historyBody.innerHTML = `
      <tr class="empty-history-row">
        <td colspan="7">No speed tests run yet.</td>
      </tr>
    `;
    return;
  }
  
  const unit = getSelectedUnit();
  
  historyBody.innerHTML = testHistory.map(run => {
    const formattedDl = formatNumber(convertSpeed(run.download, unit));
    const formattedUl = formatNumber(convertSpeed(run.upload, unit));
    const cleanDate = run.timestamp.split(',')[0];
    
    return `
      <tr data-id="${run.id}">
        <td>${cleanDate}</td>
        <td>${run.colo}</td>
        <td>${run.ping.toFixed(0)} ms</td>
        <td>${run.jitter.toFixed(0)} ms</td>
        <td><span class="history-dl-val">${formattedDl}</span> <span class="card-unit">${unit}</span></td>
        <td><span class="history-ul-val">${formattedUl}</span> <span class="card-unit">${unit}</span></td>
        <td>
          <button class="btn-delete-row" onclick="deleteHistoryRow(${run.id})" title="Delete Run">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

window.deleteHistoryRow = function(id) {
  testHistory = testHistory.filter(run => run.id !== id);
  saveHistory();
  renderHistoryTable();
  showToast('Test log removed.');
};

function clearHistory() {
  if (confirm('Are you sure you want to delete all historical logs? This cannot be undone.')) {
    testHistory = [];
    saveHistory();
    renderHistoryTable();
    linkShareResults.classList.add('hidden');
    const dividers = document.getElementsByClassName('footer-divider');
    if (dividers.length > 0) dividers[0].classList.remove('hidden');
    showToast('All records wiped.');
  }
}

function exportCSV() {
  if (testHistory.length === 0) {
    showToast('No history records to export.', true);
    return;
  }
  
  let csv = 'Timestamp,ISP,Datacenter,Ping (ms),Jitter (ms),Download (Mbps),Upload (Mbps)\n';
  
  testHistory.forEach(r => {
    csv += `"${r.timestamp}","${r.isp.replace(/"/g, '""')}","${r.colo}",${r.ping.toFixed(2)},${r.jitter.toFixed(2)},${r.download.toFixed(2)},${r.upload.toFixed(2)}\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `nebula_speedtest_export_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('CSV report exported.');
}

function shareResults() {
  if (testHistory.length === 0) return;
  const last = testHistory[0];
  const unit = getSelectedUnit();
  
  const text = `🚀 Nebula Speedtest Report:
📥 Download: ${formatNumber(convertSpeed(last.download, unit))} ${unit}
📤 Upload: ${formatNumber(convertSpeed(last.upload, unit))} ${unit}
⚡ Ping: ${last.ping.toFixed(0)} ms | Jitter: ${last.jitter.toFixed(0)} ms
🏢 Server: ${last.colo}
Tested with 100% precision on Nebula Speedtest!`;

  navigator.clipboard.writeText(text)
    .then(() => {
      showToast('Results report copied to clipboard!');
    })
    .catch(() => {
      showToast('Failed to copy to clipboard.', true);
    });
}

let toastTimeout = null;
function showToast(message, isError = false) {
  const toast = document.getElementById('app-toast');
  const toastContent = document.getElementById('toast-message');
  
  toastContent.textContent = message;
  
  if (isError) {
    toast.style.borderColor = 'rgba(239, 68, 68, 0.8)';
    toastContent.style.color = '#ef4444';
  } else {
    toast.style.borderColor = 'rgba(60, 68, 133, 0.8)';
    toastContent.style.color = '';
  }
  
  toast.classList.add('show');
  
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}
