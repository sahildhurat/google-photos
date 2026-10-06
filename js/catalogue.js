let objectURLMap = new Map();

/**
 * Reads current mode from localStorage. Default: 'demo'
 */
function getMode() {
  return localStorage.getItem('tow_mode') || 'demo';
}

/**
 * Writes mode to localStorage
 */
function setMode(mode) {
  localStorage.setItem('tow_mode', mode);
}

/**
 * Loads the catalogue based on the current mode.
 */
async function loadCatalogue(mode) {
  let records = [];
  
  if (mode === 'demo') {
    // Fetch static demo JSON
    try {
      const response = await fetch('data/catalogue.json');
      records = await response.json();
      
      // Merge user deposits from local storage
      const demoDeposits = JSON.parse(localStorage.getItem('tow_demo_deposits') || '{}');
      records.forEach(r => {
        if (demoDeposits[r.id]) {
          r.user_deposits = demoDeposits[r.id];
        }
      });
    } catch (e) {
      console.error("Failed to load demo catalogue:", e);
      throw e;
    }
  } else if (mode === 'user') {
    // Read from localStorage for user catalogue
    const userRecordsStr = localStorage.getItem('tow_user_catalogue');
    if (userRecordsStr) {
      records = JSON.parse(userRecordsStr);
      
      const userDeposits = JSON.parse(localStorage.getItem('tow_user_deposits') || '{}');
      records.forEach(r => {
        if (userDeposits[r.id]) {
          r.user_deposits = userDeposits[r.id];
        }
      });
    }
    
    // Pre-load all blobs from IndexedDB into memory map
    releaseImageURLs(); // Clear previous just in case
    
    if (window.idb && window.idb.getAllBlobs) {
      try {
        const blobs = await window.idb.getAllBlobs();
        blobs.forEach(entry => {
          objectURLMap.set(entry.id, URL.createObjectURL(entry.blob));
        });
      } catch (e) {
        console.error("Failed to preload IDB blobs:", e);
      }
    }
  }
  
  return records;
}

/**
 * Writes the updated records (specifically deposits) to localStorage
 */
function saveCatalogue(mode, records) {
  // Only deposits are updated in demo mode. User mode updates the catalogue too.
  // Actually, standardizing on just saving deposits to the right key is cleaner.
  const depositMap = {};
  records.forEach(r => {
    if (r.user_deposits && r.user_deposits.length > 0) {
      depositMap[r.id] = r.user_deposits;
    }
  });
  
  if (mode === 'demo') {
    localStorage.setItem('tow_demo_deposits', JSON.stringify(depositMap));
  } else {
    localStorage.setItem('tow_user_deposits', JSON.stringify(depositMap));
    // Also save the whole catalogue because user might add/delete photos (Stage 2)
    localStorage.setItem('tow_user_catalogue', JSON.stringify(records));
  }
}

/**
 * Gets the image source URL for a record ID.
 * Abstracts away the mode difference.
 */
function getImageURL(id, modeOverride) {
  // Pages that always work against one library (pass-it-on, the scratch card)
  // must say so. Reading the global mode here meant a demo photo id was looked
  // up in the uploaded-image map and came back empty: broken thumbnails.
  const mode = modeOverride || getMode();
  if (mode === 'demo') {
    return `images/${id}.jpg`;
  } else {
    return objectURLMap.get(id) || ''; // Empty string if not found, avoids broken img
  }
}

/**
 * Releases memory for object URLs. Must be called on mode switch or clear.
 */
function releaseImageURLs() {
  for (const url of objectURLMap.values()) {
    URL.revokeObjectURL(url);
  }
  objectURLMap.clear();
}

/**
 * Prepares the catalogue for the API by stripping the file path
 */
function prepareCatalogueForAPI(records) {
  return records.map(r => {
    const { file, ...rest } = r;
    return rest;
  });
}

window.catalogue = { 
  getMode, 
  setMode, 
  loadCatalogue, 
  saveCatalogue, 
  getImageURL, 
  releaseImageURLs,
  prepareCatalogueForAPI 
};
