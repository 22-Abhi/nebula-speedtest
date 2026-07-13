// Nebula Speedtest Engine - Web Worker
// Performs all network measurements on a background thread for maximum timing accuracy.

console.log("Nebula Speedtest Worker loaded.");

let testActive = false;
let totalBytesDownloaded = 0;
let totalBytesUploaded = 0;
let downloadStartTime = 0;
let uploadStartTime = 0;

let downloadSamples = [];
let uploadSamples = [];

// Configuration variables
let pingRequests = 12;
let downloadDuration = 8000; // ms
let uploadDuration = 8000; // ms
let threadCount = 4;
let includeOverhead = false;
let serverConfig = null;

// Pre-allocated random buffer for incompressible upload testing (4MB)
let randomBuffer = null;

// List of CDNJS assets to download (hosted on Cloudflare's edge with CORS enabled)
const DOWNLOAD_FILES = [
  "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",         // ~600KB
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js", // ~1.0MB
  "https://cdnjs.cloudflare.com/ajax/libs/tensorflow/3.13.0/tf.min.js",         // ~1.0MB
  "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/sql-wasm.js",           // ~1.5MB
  "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js",         // ~800KB
  "https://cdnjs.cloudflare.com/ajax/libs/mathjs/10.1.1/math.js",               // ~750KB
  "https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.js"         // ~500KB
];

// Configure your production Cloudflare Worker CORS proxy URL here if hosting on GitHub Pages:
// Example: "https://your-proxy.yoursubdomain.workers.dev/proxy"
const PRODUCTION_PROXY_URL = "";

function getTargetUrl(url) {
  if (self.location.hostname === '127.0.0.1' || self.location.hostname === 'localhost') {
    return `${self.location.origin}/proxy?url=${encodeURIComponent(url)}`;
  }
  if (PRODUCTION_PROXY_URL) {
    return `${PRODUCTION_PROXY_URL}?url=${encodeURIComponent(url)}`;
  }
  return url;
}

// Listen for messages from the main thread
self.onmessage = function (e) {
  const data = e.data;
  console.log("Worker received command:", data.cmd, data);
  
  if (data.cmd === 'start') {
    pingRequests = data.pingRequests || 12;
    downloadDuration = data.downloadDuration || 8000;
    uploadDuration = data.uploadDuration || 8000;
    threadCount = data.threads || 4;
    includeOverhead = data.includeOverhead || false;
    serverConfig = data.server;
    
    runSpeedTest();
  } else if (data.cmd === 'cancel') {
    testActive = false;
    self.postMessage({ type: 'cancelled' });
  }
};

// Main speed test sequence
async function runSpeedTest() {
  console.log("Worker starting speed test. ServerConfig:", serverConfig);
  testActive = true;
  
  try {
    if (!serverConfig) {
      throw new Error("Server configuration is missing.");
    }

    // 1. Latency & Jitter Phase
    if (!testActive) return;
    self.postMessage({ type: 'phaseChange', phase: 'ping' });
    const pingResults = await runPingTest();
    if (!testActive) return;
    
    // 2. Download Phase
    self.postMessage({ type: 'phaseChange', phase: 'download' });
    const downloadSpeed = await runDownloadTest();
    if (!testActive) return;
    
    // 3. Upload Phase
    self.postMessage({ type: 'phaseChange', phase: 'upload' });
    const uploadSpeed = await runUploadTest();
    if (!testActive) return;
    
    // 4. Complete Phase
    self.postMessage({
      type: 'complete',
      results: {
        ping: pingResults.ping,
        jitter: pingResults.jitter,
        download: downloadSpeed,
        upload: uploadSpeed
      }
    });
  } catch (err) {
    console.error("Worker runSpeedTest caught error:", err);
    self.postMessage({ type: 'error', message: err.message });
  } finally {
    testActive = false;
  }
}

// ----------------------------------------------------
// Ping & Jitter Testing (Against closest server's pingURL)
// ----------------------------------------------------
async function runPingTest() {
  const pings = [];
  console.log("Worker running Ping test against:", serverConfig.pingURL);
  
  for (let i = 0; i < pingRequests; i++) {
    if (!testActive) throw new Error('Test cancelled');
    
    let errorCount = 0;
    while (true) {
      try {
        const start = performance.now();
        // Fetch empty file with cache-busting to measure connection overhead
        const target = getTargetUrl(`${serverConfig.pingURL}?r=${Math.random()}`);
        console.log(`Worker ping iteration ${i+1}: fetching ${target}`);
        
        const response = await fetch(target, {
          cache: 'no-store'
        });
        
        if (!response.ok) throw new Error(`HTTP error ${response.status} ${response.statusText}`);
        
        const duration = performance.now() - start;
        pings.push(duration);
        console.log(`Worker ping iteration ${i+1} success: ${duration.toFixed(2)}ms`);
        
        self.postMessage({
          type: 'pingProgress',
          index: i + 1,
          total: pingRequests,
          latency: duration
        });
        break; // Success, break retry loop
      } catch (e) {
        console.error(`Worker ping iteration ${i+1} failed:`, e);
        errorCount++;
        if (errorCount >= 3) {
          throw new Error(`Ping test failed. The target server "${serverConfig.name}" (${serverConfig.pingURL}) is unreachable or CORS blocked. Error: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 200)); // sleep before retry
      }
    }
    
    // Small delay between pings to avoid flooding
    await new Promise(r => setTimeout(r, 80));
  }
  
  // Statistical cleaning: Discard the first 2 pings (warmup / DNS / handshake)
  const validPings = pings.slice(2);
  if (validPings.length === 0) {
    throw new Error('Ping test failed to gather enough samples.');
  }
  
  // Calculate average ping
  const sum = validPings.reduce((a, b) => a + b, 0);
  const avgPing = sum / validPings.length;
  
  // Calculate Jitter (average absolute difference between consecutive measurements)
  let jitterSum = 0;
  for (let i = 1; i < validPings.length; i++) {
    jitterSum += Math.abs(validPings[i] - validPings[i - 1]);
  }
  const jitter = validPings.length > 1 ? jitterSum / (validPings.length - 1) : 0;
  
  console.log(`Worker Ping test finished. Ping: ${avgPing.toFixed(2)}ms, Jitter: ${jitter.toFixed(2)}ms`);
  return {
    ping: avgPing,
    jitter: jitter
  };
}

// ----------------------------------------------------
// Download Testing (Cloudflare CDNJS Files + Streams API)
// ----------------------------------------------------
async function runDownloadTest() {
  console.log("Worker starting download test...");
  totalBytesDownloaded = 0;
  downloadSamples = [];
  downloadStartTime = performance.now();
  
  const endTime = downloadStartTime + downloadDuration;
  const streams = [];
  
  // Spawn concurrent downloads
  for (let i = 0; i < threadCount; i++) {
    streams.push(downloadStream(endTime, i));
  }
  
  // Progress reporting timer
  const progressTimer = setInterval(() => {
    const now = performance.now();
    const elapsed = now - downloadStartTime;
    
    downloadSamples.push({
      time: now,
      bytes: totalBytesDownloaded
    });
    
    const currentSpeed = calculateCurrentSpeed(downloadSamples, now, totalBytesDownloaded);
    
    self.postMessage({
      type: 'downloadProgress',
      elapsed: elapsed,
      bytes: totalBytesDownloaded,
      speed: currentSpeed
    });
  }, 100);
  
  await Promise.all(streams);
  clearInterval(progressTimer);
  
  const finalTime = performance.now() - downloadStartTime;
  const finalSpeed = calculateFinalSpeed(downloadSamples);
  console.log(`Worker download test finished. Speed: ${finalSpeed.toFixed(2)} Mbps`);
  
  return finalSpeed;
}

async function downloadStream(endTime, threadIndex) {
  let useFallback = false;
  let fileIndex = threadIndex % DOWNLOAD_FILES.length;

  while (performance.now() < endTime && testActive) {
    try {
      let url;
      if (!useFallback && serverConfig && serverConfig.dlURL) {
        url = getTargetUrl(`${serverConfig.dlURL}?r=${Math.random()}&ckSize=100`);
      } else {
        url = getTargetUrl(`${DOWNLOAD_FILES[fileIndex]}?r=${Math.random()}`);
      }
      
      const response = await fetch(url, {
        cache: 'no-store'
      });
      
      if (!response.ok) throw new Error('HTTP error');
      
      const reader = response.body.getReader();
      
      while (performance.now() < endTime && testActive) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytesDownloaded += value.length;
      }
      
      if (useFallback) {
        fileIndex = (fileIndex + 1) % DOWNLOAD_FILES.length;
      }
    } catch (err) {
      if (!testActive) break;
      console.warn("Download stream error, switching to fallback:", err);
      useFallback = true;
      await new Promise(r => setTimeout(r, 100)); // Sleep before retry
    }
  }
}

// ----------------------------------------------------
// Upload Testing (LibreSpeed empty.php + Random Incompressible Buffer)
// ----------------------------------------------------
async function runUploadTest() {
  console.log("Worker starting upload test...");
  totalBytesUploaded = 0;
  uploadSamples = [];
  uploadStartTime = performance.now();
  
  // Allocate random buffer if not already done (4MB size)
  if (!randomBuffer) {
    randomBuffer = new Uint8Array(4 * 1024 * 1024);
    const cryptoChunkSize = 65536; // Web Crypto limit is 65536 bytes
    for (let i = 0; i < randomBuffer.length; i += cryptoChunkSize) {
      const subChunk = randomBuffer.subarray(i, Math.min(i + cryptoChunkSize, randomBuffer.length));
      self.crypto.getRandomValues(subChunk);
    }
  }
  
  const endTime = uploadStartTime + uploadDuration;
  const streams = [];
  
  // Spawn concurrent uploads
  for (let i = 0; i < threadCount; i++) {
    streams.push(uploadStream(endTime));
  }
  
  // Progress reporting timer
  const progressTimer = setInterval(() => {
    const now = performance.now();
    const elapsed = now - uploadStartTime;
    
    uploadSamples.push({
      time: now,
      bytes: totalBytesUploaded
    });
    
    const currentSpeed = calculateCurrentSpeed(uploadSamples, now, totalBytesUploaded);
    
    self.postMessage({
      type: 'uploadProgress',
      elapsed: elapsed,
      bytes: totalBytesUploaded,
      speed: currentSpeed
    });
  }, 100);
  
  await Promise.all(streams);
  clearInterval(progressTimer);
  
  const finalTime = performance.now() - uploadStartTime;
  const finalSpeed = calculateFinalSpeed(uploadSamples);
  console.log(`Worker upload test finished. Speed: ${finalSpeed.toFixed(2)} Mbps`);
  
  return finalSpeed;
}

function uploadStream(endTime) {
  let chunkSize = 256 * 1024; // Start with 256 KB
  
  return new Promise(async (resolve) => {
    while (performance.now() < endTime && testActive) {
      try {
        const chunk = randomBuffer.subarray(0, chunkSize);
        const requestStart = performance.now();
        
        await new Promise((res, rej) => {
          const xhr = new XMLHttpRequest();
          const target = getTargetUrl(`${serverConfig.ulURL}?r=${Math.random()}`);
          xhr.open('POST', target, true);
          
          let lastLoaded = 0;
          xhr.upload.onprogress = function (e) {
            if (!testActive || performance.now() >= endTime) {
              xhr.abort();
              rej(new Error('Cancelled'));
              return;
            }
            if (e.lengthComputable) {
              const diff = e.loaded - lastLoaded;
              lastLoaded = e.loaded;
              totalBytesUploaded += diff;
            }
          };
          
          xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
              res();
            } else {
              rej(new Error('HTTP status error'));
            }
          };
          
          xhr.onerror = function () {
            rej(new Error('Network error'));
          };
          
          xhr.send(chunk);
        });
        
        // Auto-tuning upload chunk sizes:
        const requestDuration = performance.now() - requestStart;
        if (requestDuration < 200 && chunkSize < randomBuffer.length) {
          chunkSize = Math.min(randomBuffer.length, chunkSize * 2);
        } else if (requestDuration > 800 && chunkSize > 32 * 1024) {
          chunkSize = Math.max(32 * 1024, chunkSize / 2);
        }
      } catch (err) {
        if (!testActive || err.message === 'Cancelled') break;
        await new Promise(r => setTimeout(r, 150)); // Sleep before retry
      }
    }
    resolve();
  });
}

// ----------------------------------------------------
// Statistical Calculation Helpers
// ----------------------------------------------------

// Calculates instantaneous speed over a 500ms sliding window
function calculateCurrentSpeed(samples, now, currentTotalBytes) {
  if (samples.length < 2) return 0;
  
  const windowMs = 500;
  const targetTime = now - windowMs;
  
  // Find oldest sample in window
  let oldestSample = samples[0];
  for (let i = samples.length - 1; i >= 0; i--) {
    if (samples[i].time <= targetTime) {
      oldestSample = samples[i];
      break;
    }
  }
  
  const bytesDiff = currentTotalBytes - oldestSample.bytes;
  const timeDiff = now - oldestSample.time; // ms
  
  if (timeDiff <= 0 || bytesDiff <= 0) return 0;
  
  let speedMbps = (bytesDiff * 8) / (timeDiff * 1000);
  
  // Add estimated protocol overhead (TCP/IP/Ethernet layers ~ 4.5% extra)
  if (includeOverhead) {
    speedMbps *= 1.045;
  }
  
  return speedMbps;
}

// Calculates the final speed using a trimmed mean to filter out anomalies/outliers
function calculateFinalSpeed(samples) {
  if (samples.length === 0) return 0;
  
  const firstSample = samples[0];
  const lastSample = samples[samples.length - 1];
  const totalDuration = lastSample.time - firstSample.time;
  
  if (totalDuration <= 0) return 0;
  
  // Discard the first 2.0 seconds (warm-up phase) to get a steady-state measurement
  const warmUpThreshold = firstSample.time + 2000;
  
  // Find the first sample after the warm-up period
  let stableStartSample = null;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i].time >= warmUpThreshold) {
      stableStartSample = samples[i];
      break;
    }
  }
  
  // Fallback if the test duration was too short or there are not enough samples
  if (!stableStartSample || stableStartSample === lastSample) {
    stableStartSample = samples[Math.floor(samples.length * 0.25)] || samples[0];
  }
  
  const bytesDiff = lastSample.bytes - stableStartSample.bytes;
  const timeDiff = lastSample.time - stableStartSample.time; // ms
  
  if (timeDiff <= 0 || bytesDiff <= 0) {
    // If stable calculation fails, fallback to simple total average
    const dt = lastSample.time - firstSample.time;
    if (dt <= 0) return 0;
    let fallbackSpeed = (lastSample.bytes * 8) / (dt * 1000);
    if (includeOverhead) fallbackSpeed *= 1.045;
    return fallbackSpeed;
  }
  
  let speedMbps = (bytesDiff * 8) / (timeDiff * 1000);
  if (includeOverhead) {
    speedMbps *= 1.045;
  }
  
  return speedMbps;
}
