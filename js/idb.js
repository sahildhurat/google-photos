const DB_NAME = 'tow_images';
const STORE_NAME = 'blobs';
const DB_VERSION = 1;

/**
 * Returns a promise for the database handle.
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onerror = (event) => {
      console.error("IndexedDB open error:", event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Stores an image blob.
 */
async function putBlob(id, blob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    const request = store.put({ id, blob });
    
    request.onsuccess = () => resolve();
    request.onerror = (event) => {
      console.error("IndexedDB put error:", event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Retrieves a blob by record id.
 */
async function getBlob(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    
    const request = store.get(id);
    
    request.onsuccess = (event) => {
      resolve(event.target.result ? event.target.result.blob : null);
    };
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Retrieves all blobs (used for fast loading in user mode).
 */
async function getAllBlobs() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    
    const request = store.getAll();
    
    request.onsuccess = (event) => {
      resolve(event.target.result || []);
    };
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Removes a single blob.
 */
async function deleteBlob(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Deletes the entire object store.
 */
async function clearAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();
    
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
}

window.idb = { openDB, putBlob, getBlob, getAllBlobs, deleteBlob, clearAll };
