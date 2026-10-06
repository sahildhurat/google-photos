const STOP_WORDS = new Set(["a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "if", "in", "into", "is", "it", "no", "not", "of", "on", "or", "such", "that", "the", "their", "then", "there", "these", "they", "this", "to", "was", "will", "with", "what", "where", "when", "why", "who", "how", "i", "you", "he", "she", "we", "me", "my", "your", "remember", "photo", "picture", "show", "find", "look", "like"]);

/**
 * Captures user messages from the current hunt as deposits on a photo.
 * @param {string} photoId - The ID of the confirmed photo.
 * @param {Array<string>} huntMessages - The user's messages during this hunt.
 * @param {Array<Object>} catalogue - The current catalogue array.
 * @param {string} mode - 'demo' or 'user'.
 * @returns {string} - Confirmation message.
 */
function captureDeposits(photoId, huntMessages, catalogue, mode) {
  const record = catalogue.find(r => r.id === photoId);
  if (!record) return "Could not save deposits: photo not found.";
  
  if (!record.user_deposits) {
    record.user_deposits = [];
  }
  
  // Create deposit entries
  const timestamp = new Date().toISOString();
  huntMessages.forEach(msg => {
    // Only deposit if not just whitespace
    if (msg.trim()) {
      record.user_deposits.push({
        said: msg.trim(),
        at: timestamp
      });
    }
  });
  
  // Save to storage
  window.catalogue.saveCatalogue(mode, catalogue);
  
  // Extract distinctive words
  const allText = huntMessages.join(' ').toLowerCase();
  const words = allText.match(/\b[a-z]{2,}\b/g) || [];
  
  const distinctWords = Array.from(new Set(words))
    .filter(w => !STOP_WORDS.has(w))
    .sort((a, b) => b.length - a.length) // Pick longest words first as a simple heuristic
    .slice(0, 5);
  
  if (distinctWords.length > 0) {
    return `Saved what you said. This photo now answers to: "${distinctWords.join(', ')}".`;
  } else {
    return "Saved what you said.";
  }
}

/**
 * Renders the deposits page if we are on deposits.html
 */
async function renderDepositsPage() {
  const container = document.getElementById('deposits-list');
  if (!container) return; // Not on deposits.html
  
  const mode = window.catalogue.getMode();
  let catalogue = [];
  try {
    catalogue = await window.catalogue.loadCatalogue(mode);
  } catch (e) {
    container.innerHTML = '<p>Error loading catalogue.</p>';
    return;
  }
  
  const depositedRecords = catalogue.filter(r => r.user_deposits && r.user_deposits.length > 0);
  
  if (depositedRecords.length === 0) {
    container.innerHTML = `<p class="empty-state">No deposits yet. Find a photo and tap 'That's it' to start building your index.</p>`;
    return;
  }
  
  depositedRecords.forEach(record => {
    const card = document.createElement('div');
    card.className = 'deposit-card';
    
    // Thumbnail
    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'deposit-thumbnail';
    const img = document.createElement('img');
    img.src = window.catalogue.getImageURL(record.id);
    imgWrapper.appendChild(img);
    
    // Info
    const info = document.createElement('div');
    info.className = 'deposit-info';
    
    let contextHTML = '';
    if (record.taken_at) {
      const d = new Date(record.taken_at);
      if (!isNaN(d.getTime())) {
        contextHTML += `<strong>${d.toLocaleDateString()}</strong>`;
      }
    }
    if (record.place && record.place.name) {
      contextHTML += (contextHTML ? ' · ' : '') + record.place.name;
    }
    
    if (contextHTML) {
      const contextDiv = document.createElement('div');
      contextDiv.className = 'deposit-context';
      contextDiv.innerHTML = contextHTML;
      info.appendChild(contextDiv);
    }
    
    // Deposits list
    const ul = document.createElement('ul');
    ul.className = 'deposit-phrases';
    
    // Sort deposits newest first
    const sortedDeposits = [...record.user_deposits].sort((a, b) => new Date(b.at) - new Date(a.at));
    
    sortedDeposits.forEach(dep => {
      const li = document.createElement('li');
      const d = new Date(dep.at);
      const timeStr = !isNaN(d.getTime()) ? d.toLocaleDateString() : 'Unknown date';
      li.innerHTML = `<span class="deposit-text">"${dep.said}"</span> <span class="deposit-time">(${timeStr})</span>`;
      ul.appendChild(li);
    });
    
    info.appendChild(ul);
    card.appendChild(imgWrapper);
    card.appendChild(info);
    
    container.appendChild(card);
  });
}

window.captureDeposits = captureDeposits;

// Auto-init for deposits.html
document.addEventListener('DOMContentLoaded', renderDepositsPage);
