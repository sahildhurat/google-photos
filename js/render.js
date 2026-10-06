/**
 * Creates and appends the assistant message bubble + candidate grid to the message thread.
 */
function renderAssistantMessage(response, catalogueList, mode = 'hunt') {
  const thread = document.getElementById('thread');
  
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message assistant';
  
  const say = response.say || '';
  const candidates = response.candidates || [];
  let cannotDistinguish = response.cannot_distinguish || false;
  
  // Render the text bubble if there's a message
  if (say) {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = say; // Text content prevents HTML injection
    msgDiv.appendChild(bubble);
  } else if (candidates.length === 0) {
    // Fallback if both say and candidates are empty
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = "I haven't found anything yet. Tell me something else you remember — anything at all, even if you're not sure about it.";
    msgDiv.appendChild(bubble);
  }

  // If no candidates, we're done
  if (candidates.length === 0) {
    thread.appendChild(msgDiv);
    scrollToBottom();
    return;
  }

  // Build a lookup map for quick access
  const catMap = new Map();
  catalogueList.forEach(r => catMap.set(r.id, r));

  // Remove duplicates and unknown IDs
  let cleanCandidates = [...new Set(candidates)].filter(id => {
    if (!catMap.has(id)) {
      console.warn("Unknown candidate ID skipped:", id);
      return false;
    }
    return true;
  });

  // Truncate to 8 before expansion
  cleanCandidates = cleanCandidates.slice(0, 8);

  // --- MECHANISM A: Structural Cluster Expansion ---
  // Mechanism A applies in `hunt` mode only. Do NOT "fix" this.
  // It is disabled in `single` mode to faithfully test confident single-answer failures.
  let expandedList = [];
  let clustersExpanded = new Set();
  
  if (mode === 'hunt') {
    // Count cluster occurrences in current candidates
    const clusterCounts = {};
    cleanCandidates.forEach(id => {
      const r = catMap.get(id);
      if (r.cluster) {
        clusterCounts[r.cluster] = (clusterCounts[r.cluster] || 0) + 1;
      }
    });

    cleanCandidates.forEach(id => {
      const r = catMap.get(id);
      
      // If it's part of a cluster that appears 2+ times AND near_identical is true
      if (r.cluster && clusterCounts[r.cluster] >= 2 && r.near_identical) {
        if (!clustersExpanded.has(r.cluster)) {
          // Find all records in the catalogue belonging to this cluster
          const allClusterMembers = catalogueList.filter(c => c.cluster === r.cluster);
          expandedList.push(...allClusterMembers);
          clustersExpanded.add(r.cluster);
        }
      } else {
        if (!r.cluster || !clustersExpanded.has(r.cluster)) {
          expandedList.push(r);
        }
      }
    });
  } else {
    // Non-hunt mode: no expansion
    cleanCandidates.forEach(id => expandedList.push(catMap.get(id)));
  }

  // Render the grid container
  const gridContainer = document.createElement('div');
  gridContainer.className = 'grid-container';

  // --- MECHANISM B: Enforcement Bands ---
  
  // 1. Model's judgement (cannot_distinguish flag)
  if (cannotDistinguish) {
    const strongBand = document.createElement('div');
    strongBand.className = 'enforcement-band honest';
    strongBand.textContent = "I can't tell these apart from what I have.";
    gridContainer.appendChild(strongBand);
  }
  
  // 2. Structural expansion
  if (clustersExpanded.size > 0) {
    const infoBand = document.createElement('div');
    infoBand.className = 'enforcement-band info';
    infoBand.textContent = "All from the same moment.";
    gridContainer.appendChild(infoBand);
  }

  // Render Thumbnails
  const grid = document.createElement('div');
  grid.className = 'thumbnail-grid';
  
  expandedList.forEach(r => {
    const wrapper = document.createElement('div');
    wrapper.className = 'thumbnail-wrapper';
    
    const img = document.createElement('img');
    img.src = window.catalogue.getImageURL(r.id);
    img.alt = r.scene;
    
    // On click, open the modal
    wrapper.addEventListener('click', () => openModal(r));
    
    wrapper.appendChild(img);
    grid.appendChild(wrapper);
  });
  
  gridContainer.appendChild(grid);
  
  // Stage 5: Ask a friend trigger
  // In hunt mode, if stuck (co_present or 3+ turns without success)
  if (mode === 'hunt') {
    const userTurns = document.querySelectorAll('#thread .message.user').length;
    const coPresent = response.co_present || [];
    
    if (coPresent.length > 0 || userTurns >= 3) {
      const askFriendBand = document.createElement('div');
      askFriendBand.className = 'enforcement-band info';
      askFriendBand.style.marginTop = '12px';
      askFriendBand.style.cursor = 'pointer';
      askFriendBand.style.color = 'var(--accent-color)';
      askFriendBand.style.fontWeight = '600';
      askFriendBand.style.textAlign = 'center';
      
      let text = "Want to ask someone who was there?";
      if (coPresent.length > 0) {
        text = `${coPresent[0]} was there. Ask them?`;
      }
      askFriendBand.textContent = text;
      
      askFriendBand.addEventListener('click', () => {
        const ids = cleanCandidates.join(',');
        window.location.href = `passiton.html#${ids}`;
      });
      
      gridContainer.appendChild(askFriendBand);
    }
  }

  msgDiv.appendChild(gridContainer);
  
  thread.appendChild(msgDiv);
  scrollToBottom();
}

function scrollToBottom() {
  const thread = document.getElementById('thread');
  thread.scrollTop = thread.scrollHeight;
}

/**
 * Renders a user message bubble
 */
function renderUserMessage(text) {
  const thread = document.getElementById('thread');
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message user';
  
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  
  msgDiv.appendChild(bubble);
  thread.appendChild(msgDiv);
  scrollToBottom();
}

/**
 * Handles showing the loading indicator
 */
let loadingIndicator = null;
function showLoading() {
  if (loadingIndicator) return;
  
  const thread = document.getElementById('thread');
  loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'message assistant loading-msg';
  
  const bubble = document.createElement('div');
  bubble.className = 'bubble loading';
  bubble.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
  
  loadingIndicator.appendChild(bubble);
  thread.appendChild(loadingIndicator);
  scrollToBottom();
}

function hideLoading() {
  if (loadingIndicator) {
    loadingIndicator.remove();
    loadingIndicator = null;
  }
}

// --- Modal Logic ---

let currentModalRecord = null;

function openModal(record) {
  currentModalRecord = record;
  const modal = document.getElementById('photo-modal');
  const img = document.getElementById('modal-img');
  const info = document.getElementById('modal-info');
  
  // Try loading image
  img.src = window.catalogue.getImageURL(record.id);
  img.onerror = () => {
    // Fallback if image fails to load
    img.src = '';
    img.alt = "Couldn't load this photo.";
  };
  
  // Format date anchor if possible
  let dateText = "Sometime";
  if (record.taken_at) {
    const d = new Date(record.taken_at);
    if (!isNaN(d.getTime())) {
      dateText = d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
  }
  
  let placeText = record.place ? `${record.place.name}, ${record.place.area}` : '';
  let peopleText = (record.people && record.people.length > 0) ? `With ${record.people.join(', ')}` : '';
  
  info.innerHTML = `
    <div class="modal-date">${dateText}</div>
    <div class="modal-context">
      ${placeText ? `<div>📍 ${placeText}</div>` : ''}
      ${peopleText ? `<div>👥 ${peopleText}</div>` : ''}
    </div>
  `;
  
  modal.classList.remove('hidden');
}

function closeModal() {
  const modal = document.getElementById('photo-modal');
  if (modal) modal.classList.add('hidden');
  currentModalRecord = null;
}

// render.js is shared across pages, and only index.html carries the photo modal.
// Wiring it unguarded threw on every other page and halted the rest of this file.
const modalClose = document.getElementById('modal-close');
if (modalClose) modalClose.addEventListener('click', closeModal);

const photoModal = document.getElementById('photo-modal');
if (photoModal) {
  photoModal.addEventListener('click', (e) => {
    if (e.target.id === 'photo-modal') closeModal();
  });
}

// Expose rendering functions
window.render = {
  renderAssistantMessage,
  renderUserMessage,
  showLoading,
  hideLoading,
  getCurrentModalRecord: () => currentModalRecord,
  closeModal,
  openModal
};
