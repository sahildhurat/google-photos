// Batching config based on Gemini rate limits (15 RPM)
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 20000; // 20s between batches (5 calls * 3 batches = 15 calls per minute)

let rateLimitedCount = 0;
let failureCount = 0;

function initUploadUI() {
  const btnPick = document.getElementById('btn-pick-photos');
  const btnDelete = document.getElementById('btn-delete-all');
  const fileInput = document.getElementById('file-upload');
  
  if (!btnPick) return;

  btnPick.addEventListener('click', () => {
    fileInput.click();
  });

  btnDelete.addEventListener('click', async () => {
    if (confirm("Are you sure you want to delete all local photos and data?")) {
      await window.idb.clearAll();
      localStorage.removeItem('tow_user_catalogue');
      localStorage.removeItem('tow_user_deposits');
      // Reload UI
      window.app.switchMode('user');
    }
  });

  fileInput.addEventListener('change', handleFiles);
}

async function handleFiles(e) {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;
  if (files.length < 10 || files.length > 60) {
    alert(`Please select between 10 and 60 photos. You selected ${files.length}.`);
    return;
  }

  const consentScreen = document.getElementById('consent-screen');
  const progressDiv = document.getElementById('upload-progress');
  const progressText = document.getElementById('progress-text');
  const progressFill = document.getElementById('progress-bar-fill');
  
  progressDiv.classList.remove('hidden');
  document.getElementById('btn-pick-photos').disabled = true;

  rateLimitedCount = 0;
  failureCount = 0;

  const records = [];
  const blobsToDescribe = []; // { id, dataUrl }

  let dateMissingCount = 0;

  // Process files: downscale, extract EXIF, store in IDB
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    progressText.textContent = `Processing image ${i + 1} of ${files.length}...`;
    progressFill.style.width = `${((i) / files.length) * 30}%`; // First 30% is processing
    
    const id = 'user_' + Date.now() + '_' + i;
    
    let takenAt = null;
    try {
      // Exifr is loaded globally via module script
      const exif = await exifr.parse(file, ['DateTimeOriginal']);
      if (exif && exif.DateTimeOriginal) {
        takenAt = new Date(exif.DateTimeOriginal).toISOString();
      }
    } catch (err) {
      console.warn("EXIF extraction failed for", file.name, err);
    }

    if (!takenAt) {
      takenAt = new Date(file.lastModified).toISOString();
      dateMissingCount++;
    }

    // Downscale and convert to JPEG 0.7
    const { blob, dataUrl } = await downscaleImage(file);
    
    // Store in IDB
    await window.idb.putBlob(id, blob);

    records.push({
      id,
      taken_at: takenAt,
      near_identical: false,
      cluster: null,
      user_deposits: []
    });

    blobsToDescribe.push({ id, dataUrl });
  }

  if (dateMissingCount > files.length / 2) {
    alert("Warning: Many photos were missing EXIF dates (e.g. WhatsApp forwards). Dates will be inaccurate.");
  }

  // Batch describe via API
  const total = blobsToDescribe.length;
  let processedCount = 0;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = blobsToDescribe.slice(i, i + BATCH_SIZE);
    
    progressText.textContent = `Describing ${Math.min(i + BATCH_SIZE, total)} of ${total}...`;
    progressFill.style.width = `${30 + (processedCount / total) * 70}%`;
    
    const results = await describeBatch(batch);
    
    // Merge results into records
    results.forEach(res => {
      const record = records.find(r => r.id === res.id);
      if (res.error) {
        if (res.rate_limited) {
          rateLimitedCount++;
          console.warn(`Rate limited on ${res.id}`);
        } else {
          failureCount++;
          console.error(`Failed to describe ${res.id}:`, res.error);
        }
        // Fallback for failed descriptions
        record.kind = "photo";
        record.scene = "Unknown scene (description failed)";
        record.visible_only_on_close_look = [];
        record.search_index = { labels: [], ocr: [], place: null };
      } else {
        record.kind = res.kind;
        record.scene = res.scene;
        record.visible_only_on_close_look = res.visible_only_on_close_look;
        
        // Build search_index.labels by taking the three to six most concrete nouns from scene
        const STOP_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'with', 'to', 'for', 'of', 'is', 'are', 'was', 'were', 'it', 'this', 'that', 'there', 'some', 'one', 'two', 'person', 'people', 'man', 'woman', 'child', 'boy', 'girl']);
        const words = (res.scene || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
        const labels = words.filter(w => w.length > 2 && !STOP_WORDS.has(w)).slice(0, 5);
        
        record.search_index = {
          labels: labels,
          ocr: [], // Cannot reliably extract OCR without a second API call in this setup
          place: null // Place extraction from EXIF is complex; default to null for now
        };
      }
    });

    processedCount += batch.length;

    // Delay if there are more batches
    if (i + BATCH_SIZE < total) {
      progressText.textContent = `Waiting for API limits...`;
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  // Apply time-based clustering
  applyClustering(records);

  // Save catalogue
  localStorage.setItem('tow_user_catalogue', JSON.stringify(records));
  
  // Show report if failures
  if (failureCount > 0 || rateLimitedCount > 0) {
    alert(`Upload finished with some issues:\n- Failed descriptions: ${failureCount}\n- Skipped due to rate limits: ${rateLimitedCount}`);
  }

  // Reload UI
  window.app.switchMode('user');
}

/**
 * Describes a batch of images concurrently.
 */
async function describeBatch(batch) {
  // Use Promise.allSettled to ensure batch doesn't fail entirely
  const promises = batch.map(async (item) => {
    let attempts = 0;
    const maxAttempts = 3;
    let delay = 2000; // start with 2s backoff

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const response = await fetch('/api/describe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: [item] }) // API expects { images: [{ id, dataUrl }] }
        });

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          let waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delay;
          if (attempts >= maxAttempts) {
            return { id: item.id, error: "Rate limit exceeded after retries", rate_limited: true };
          }
          console.warn(`429 received, retrying in ${waitTime}ms...`);
          await new Promise(r => setTimeout(r, waitTime));
          delay *= 2; // exponential backoff
          continue;
        }

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        // Since API processes batch of 1 here (we parallelize client side), get first result
        const res = data.results[0];
        if (res.error) throw new Error(res.error);
        return res;

      } catch (err) {
        if (attempts >= maxAttempts) {
          return { id: item.id, error: err.message, rate_limited: false };
        }
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      }
    }
  });

  const settled = await Promise.allSettled(promises);
  return settled.map(s => s.value);
}

/**
 * Time-based clustering for consecutive photos within 60s
 */
function applyClustering(records) {
  // Sort by time
  records.sort((a, b) => new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime());
  
  let currentCluster = 1;
  let i = 0;
  
  while (i < records.length - 1) {
    const t1 = new Date(records[i].taken_at).getTime();
    const t2 = new Date(records[i+1].taken_at).getTime();
    
    // Check if within 60s
    if (Math.abs(t2 - t1) <= 60000) {
      const clusterId = `user_cluster_${currentCluster}`;
      records[i].cluster = clusterId;
      records[i].near_identical = true;
      
      let j = i + 1;
      while (j < records.length) {
        const tj = new Date(records[j].taken_at).getTime();
        const tprev = new Date(records[j-1].taken_at).getTime();
        if (Math.abs(tj - tprev) <= 60000) {
          records[j].cluster = clusterId;
          records[j].near_identical = true;
          j++;
        } else {
          break;
        }
      }
      currentCluster++;
      i = j;
    } else {
      i++;
    }
  }
}

/**
 * Downscales image to max 768px longest edge, returns Blob and Base64 Data URL.
 */
function downscaleImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_EDGE = 768;
      let w = img.width;
      let h = img.height;
      
      if (w > MAX_EDGE || h > MAX_EDGE) {
        if (w > h) {
          h = Math.floor(h * (MAX_EDGE / w));
          w = MAX_EDGE;
        } else {
          w = Math.floor(w * (MAX_EDGE / h));
          h = MAX_EDGE;
        }
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      canvas.toBlob((blob) => {
        resolve({ blob, dataUrl });
      }, 'image/jpeg', 0.7);
    };
    img.onerror = reject;
    img.src = url;
  });
}

document.addEventListener('DOMContentLoaded', initUploadUI);
