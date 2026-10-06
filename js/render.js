/**
 * Normalises a phrase for exact comparison: case, punctuation and runs of
 * whitespace stop mattering, nothing else does. "Blue Chairs!" and
 * "blue  chairs" are the same phrase; "blue" and "chairs" are not.
 */
function normaliseForMatch(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Creates and appends the assistant message bubble + candidate grid to the message thread.
 */
function renderAssistantMessage(response, catalogueList, mode = 'hunt', query = '') {
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

  // --- MECHANISM C: Exact deposit match ---
  // A deposit is the user's own label for a photo. When what they typed is
  // exactly what they once wrote on one, that is not a signal to weigh against
  // others - it is an answer they already gave us, and it outranks anything the
  // model inferred. So the hoist is deterministic: it happens here, in code,
  // whether or not the model thought to return that photo at all.
  //
  // Only exact equality counts. A partial overlap ("blue", "chairs") is an
  // ordinary search and ranks the ordinary way.
  //
  // Hunt mode only. `single` is the baseline being tested against, and handing
  // it this advantage would make the three-way comparison meaningless.
  const q = mode === 'hunt' ? normaliseForMatch(query) : '';
  const exact = new Map();   // id -> the phrase they wrote
  if (q) {
    catalogueList.forEach(r => {
      const hit = (r.user_deposits || []).find(d => normaliseForMatch(d.said) === q);
      if (hit) exact.set(r.id, hit.said);
    });
  }

  if (exact.size) {
    // A photo they labelled must appear even if the model left it out.
    exact.forEach((phrase, id) => {
      if (catMap.has(id) && !expandedList.some(r => r.id === id)) {
        expandedList.push(catMap.get(id));
      }
    });
    // Stable partition: labelled first, everything else in its existing order.
    expandedList = expandedList.filter(r => exact.has(r.id))
      .concat(expandedList.filter(r => !exact.has(r.id)));
    // They have told us which one it is. Claiming we cannot tell them apart
    // would now be false, and the honesty band is only worth anything while
    // it is true.
    cannotDistinguish = false;
  }

  // Render the grid container
  const gridContainer = document.createElement('div');
  gridContainer.className = 'grid-container';

  // --- MECHANISM B: Enforcement Bands ---

  // 0. The user's own words resolved it. Said first, because it is the answer.
  if (exact.size) {
    const yoursBand = document.createElement('div');
    yoursBand.className = 'enforcement-band info';
    yoursBand.style.fontWeight = '600';
    yoursBand.style.color = 'var(--accent-color, #1967d2)';
    const phrase = exact.values().next().value;
    yoursBand.textContent = exact.size === 1
      ? `You called this one “${phrase}”.`
      : `${exact.size} photos you called “${phrase}”.`;
    gridContainer.appendChild(yoursBand);
  }

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
    infoBand.textContent = exact.size
      ? "The rest are from the same moment."
      : "All from the same moment.";
    gridContainer.appendChild(infoBand);
  }

  // Render Thumbnails
  const grid = document.createElement('div');
  grid.className = 'thumbnail-grid';

  expandedList.forEach(r => {
    const wrapper = document.createElement('div');
    wrapper.className = 'thumbnail-wrapper';

    // Mark the hoisted one, so the ordering is legible rather than mysterious.
    if (exact.has(r.id)) {
      wrapper.style.position = 'relative';
      const tag = document.createElement('span');
      tag.textContent = 'your words';
      tag.style.cssText = 'position:absolute;left:6px;top:6px;z-index:2;' +
        'background:rgba(0,0,0,.68);color:#fff;font-size:.58rem;font-weight:600;' +
        'letter-spacing:.05em;text-transform:uppercase;padding:2px 6px;' +
        'border-radius:999px;pointer-events:none;';
      wrapper.appendChild(tag);
    }

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

    // Nothing is stuck if their own deposit just answered it.
    if (!exact.size && (coPresent.length > 0 || userTurns >= 3)) {
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

  // What they have written on this photo, shown as their own words.
  const deposits = record.user_deposits || [];
  let depositText = '';
  if (deposits.length) {
    const phrases = deposits.map(d => `“${String(d.said || '').replace(/[<>&]/g, '')}”`);
    depositText = `<div>✎ You called it ${phrases.join(', ')}</div>`;
  }

  info.innerHTML = `
    <div class="modal-date">${dateText}</div>
    <div class="modal-context">
      ${placeText ? `<div>📍 ${placeText}</div>` : ''}
      ${peopleText ? `<div>👥 ${peopleText}</div>` : ''}
      ${depositText}
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
