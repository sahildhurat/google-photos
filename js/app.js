let messages = []; // Conversation history
let currentHuntUserMessages = []; // For Stage 4 deposits
let catalogueList = [];
let voiceInput = null;
let currentSearchMode = 'converse'; // 'classic', 'single', 'converse'

async function init() {
  const modeBtnDemo = document.getElementById('mode-demo');
  const modeBtnUser = document.getElementById('mode-user');
  
  // Wire up mode switch
  modeBtnDemo.addEventListener('click', () => switchMode('demo'));
  modeBtnUser.addEventListener('click', () => switchMode('user'));
  
  // Wire up classic search toggle
  document.getElementById('toggle-converse').addEventListener('click', () => toggleSearchMode('converse'));
  document.getElementById('toggle-single').addEventListener('click', () => toggleSearchMode('single'));
  document.getElementById('toggle-classic').addEventListener('click', () => toggleSearchMode('classic'));
  
  // Wire up try these buttons
  const step2 = document.getElementById('demo-step-2');
  if (step2) {
    step2.addEventListener('click', (e) => {
      e.preventDefault();
      runComparison("The one where I had pizza and wine");
    });
  }

  // Handle First Load Note
  const firstLoadKey = 'tow_first_load_dismissed';
  const firstLoadNote = document.getElementById('first-load-note');
  if (firstLoadNote && !localStorage.getItem(firstLoadKey)) {
    firstLoadNote.classList.remove('hidden');
    document.getElementById('dismiss-first-load').addEventListener('click', () => {
      firstLoadNote.classList.add('hidden');
      localStorage.setItem(firstLoadKey, 'true');
    });
  }

  // Handle Scratch Notification
  const scratchNotif = document.getElementById('scratch-notification');
  const sessionDismissedKey = 'tow_scratch_notif_dismissed';
  const lastScratch = localStorage.getItem('tow_last_scratch_date');
  const todayStr = new Date().toDateString();
  if (scratchNotif && lastScratch !== todayStr && !sessionStorage.getItem(sessionDismissedKey)) {
    scratchNotif.classList.remove('hidden');
    
    document.getElementById('dismiss-notification').addEventListener('click', (e) => {
      e.stopPropagation();
      scratchNotif.classList.add('hidden');
      sessionStorage.setItem(sessionDismissedKey, 'true');
    });

    scratchNotif.addEventListener('click', () => {
      window.location.href = 'scratch.html';
    });
  }
  
  // Initialize mode
  const currentMode = window.catalogue.getMode();
  await switchMode(currentMode, true);

  // Init Voice
  const userInput = document.getElementById('user-input');
  const micBtn = document.getElementById('mic-btn');
  voiceInput = window.initVoice(userInput, micBtn);
  
  // Wire up inputs
  micBtn.addEventListener('click', () => {
    if (currentSearchMode === 'classic') return; // Disabled in classic mode
    if (voiceInput.isListening()) {
      voiceInput.stop();
    } else {
      voiceInput.start();
    }
  });

  document.getElementById('send-btn').addEventListener('click', handleInputSubmit);
  userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleInputSubmit();
    }
  });
  
  // CC-14: Stop recognition if user types
  userInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && voiceInput && voiceInput.isListening()) {
      voiceInput.stop();
    }
  });
  
  // Clear classic results if input is emptied
  userInput.addEventListener('input', (e) => {
    if (e.target.value.trim() === '') {
      document.getElementById('classic-results-message').textContent = '';
      document.getElementById('classic-results-grid').innerHTML = '';
    }
  });
  
  // Wire "That's it" button for Stage 4
  document.getElementById('modal-thats-it').addEventListener('click', () => {
    const record = window.render.getCurrentModalRecord();
    if (record) {
      if (window.captureDeposits) {
        const mode = window.catalogue.getMode();
        const confirmMsg = window.captureDeposits(record.id, currentHuntUserMessages, catalogueList, mode);
        window.render.closeModal();
        resetHunt();
        
        // Display confirmation in the thread
        const thread = document.getElementById('thread');
        document.getElementById('default-greeting').classList.add('hidden');
        
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message assistant';
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.innerHTML = `${confirmMsg} <br><br><a href="deposits.html" style="color: var(--accent-color);">View your index →</a>`;
        msgDiv.appendChild(bubble);
        thread.appendChild(msgDiv);
      } else {
        window.render.closeModal();
        resetHunt();
      }
    }
  });

  // Postcard referral logic
  // Postcard/Comparison referral logic
  const urlParams = new URLSearchParams(window.location.search);
  const q = urlParams.get('q');
  const doCompare = urlParams.get('compare');
  if (doCompare) {
    runComparison("The one where I had pizza and wine");
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (q) {
    userInput.value = q;
    handleInputSubmit();
    // Clean URL so refresh doesn't trigger it again
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

function resetHunt() {
  messages = [];
  currentHuntUserMessages = [];
  
  // Clear the thread except for consent screen and default greeting
  const thread = document.getElementById('thread');
  const children = Array.from(thread.children);
  children.forEach(child => {
    if (child.id !== 'consent-screen' && child.id !== 'default-greeting') {
      child.remove();
    }
  });
  
  // Clear classic search view
  document.getElementById('classic-results-message').textContent = '';
  document.getElementById('classic-results-grid').innerHTML = '';
}

async function switchMode(mode, isInit = false) {
  const modeBtnDemo = document.getElementById('mode-demo');
  const modeBtnUser = document.getElementById('mode-user');
  const consentScreen = document.getElementById('consent-screen');
  const defaultGreeting = document.getElementById('default-greeting');
  const inputRow = document.getElementById('input-row');
  
  if (!isInit) {
    window.catalogue.releaseImageURLs();
  }
  
  window.catalogue.setMode(mode);
  
  if (mode === 'demo') {
    modeBtnDemo.classList.add('active');
    modeBtnUser.classList.remove('active');
  } else {
    modeBtnUser.classList.add('active');
    modeBtnDemo.classList.remove('active');
  }
  
  try {
    catalogueList = await window.catalogue.loadCatalogue(mode);
  } catch (e) {
    console.error("Catalogue load failed:", e);
    alert("Couldn't load the photo library.");
    return;
  }
  
  resetHunt();
  
  // Show/Hide UI based on mode and catalogue state
  if (mode === 'user' && catalogueList.length === 0) {
    consentScreen.classList.remove('hidden');
    defaultGreeting.classList.add('hidden');
    inputRow.classList.add('hidden');
    document.getElementById('search-toggle-container').classList.add('hidden');
  } else {
    consentScreen.classList.add('hidden');
    if (currentSearchMode !== 'classic') {
      defaultGreeting.classList.remove('hidden');
    }
    inputRow.classList.remove('hidden');
    // The comparison toggle is revealed by revealComparison() after the first
    // answer, not here: comparing modes before any result is meaningless.
    if (hasFirstResult) {
      document.getElementById('search-toggle-container').classList.remove('hidden');
    }
  }
}

let hasFirstResult = false;
function revealComparison() {
  if (hasFirstResult) return;
  hasFirstResult = true;
  const c = document.getElementById('search-toggle-container');
  if (c) c.classList.remove('hidden');
  const hint = document.getElementById('compare-hint');
  if (hint) hint.classList.remove('hidden');
}

// Starter chips: a reviewer opening this cold does not know what to type.
function wireStarters() {
  document.querySelectorAll('.starter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = btn.dataset.q;
      const input = document.getElementById('user-input');
      if (input) input.value = q;
      const send = document.getElementById('send-btn');
      if (send) send.click();
    });
  });
  const link = document.getElementById('mode-user-link');
  if (link) link.addEventListener('click', () => {
    document.getElementById('mode-switch-container').classList.remove('hidden');
    const mu = document.getElementById('mode-user');
    if (mu) mu.click();
    link.classList.add('hidden');
  });
}
// Which library is active was invisible and sticky: after one upload every
// later search silently ran against the user's own photos, so demo queries
// returned nothing and looked like a broken engine. Once an uploaded library
// exists, the switch is always shown and the active one is named.
function showActiveLibrary() {
  var hasUser = false;
  try { hasUser = !!localStorage.getItem('tow_user_catalogue'); } catch (e) {}
  var mode = window.catalogue ? window.catalogue.getMode() : 'demo';
  var sw = document.getElementById('mode-switch-container');
  var link = document.getElementById('mode-user-link');

  if (hasUser || mode === 'user') {
    if (sw) sw.classList.remove('hidden');
    if (link) link.classList.add('hidden');
  }

  var badge = document.getElementById('active-library');
  if (!badge) {
    var host = document.querySelector('.app-title');
    if (!host) return;
    badge = document.createElement('p');
    badge.id = 'active-library';
    badge.className = 'active-library';
    host.appendChild(badge);
  }
  badge.textContent = mode === 'user'
    ? 'Searching: your uploaded photos'
    : 'Searching: the demo library';
  badge.classList.toggle('is-user', mode === 'user');
  badge.hidden = !(hasUser || mode === 'user');
}

document.addEventListener('DOMContentLoaded', function () {
  wireStarters();
  showActiveLibrary();
  ['mode-demo', 'mode-user'].forEach(function (id) {
    var b = document.getElementById(id);
    if (b) b.addEventListener('click', function () { setTimeout(showActiveLibrary, 60); });
  });
});

function toggleSearchMode(newMode) {
  currentSearchMode = newMode;
  const toggleConverse = document.getElementById('toggle-converse');
  const toggleSingle = document.getElementById('toggle-single');
  const toggleClassic = document.getElementById('toggle-classic');
  
  const thread = document.getElementById('thread');
  const classicView = document.getElementById('classic-search-view');
  const comparisonView = document.getElementById('comparison-view');
  const micBtn = document.getElementById('mic-btn');
  
  // Hide comparison view if any toggle is clicked
  if (comparisonView) comparisonView.classList.add('hidden');
  
  toggleClassic.classList.remove('active');
  toggleSingle.classList.remove('active');
  toggleConverse.classList.remove('active');
  
  if (newMode === 'classic') {
    toggleClassic.classList.add('active');
    thread.classList.add('hidden');
    classicView.classList.remove('hidden');
    micBtn.classList.add('hidden');
    
    // Stop voice if listening
    if (voiceInput && voiceInput.isListening()) {
      voiceInput.stop();
    }
  } else {
    if (newMode === 'single') toggleSingle.classList.add('active');
    if (newMode === 'converse') toggleConverse.classList.add('active');
    
    thread.classList.remove('hidden');
    classicView.classList.add('hidden');
    micBtn.classList.remove('hidden');
  }
  
  // Also clear the classic view whenever switching to it if input is empty
  if (newMode === 'classic') {
    const text = document.getElementById('user-input').value.trim();
    if (!text) {
      document.getElementById('classic-results-message').textContent = '';
      document.getElementById('classic-results-grid').innerHTML = '';
    }
  }
}

let isSending = false;

async function handleInputSubmit() {
  if (isSending) return;
  
  const inputEl = document.getElementById('user-input');
  let text = inputEl.value.trim();
  
  if (currentSearchMode !== 'classic' && voiceInput && voiceInput.isListening()) {
    voiceInput.stop();
    text = inputEl.value.trim(); 
  }
  
  if (!text) return;
  
  if (currentSearchMode === 'classic') {
    runClassicSearch(text);
  } else {
    await sendConversationMessage(text, currentSearchMode);
  }
  
  inputEl.value = '';
}

function runClassicSearch(query) {
  const results = window.classicSearch(query, catalogueList);
  
  const msgEl = document.getElementById('classic-results-message');
  const gridEl = document.getElementById('classic-results-grid');
  
  gridEl.innerHTML = '';
  
  if (results.length === 0) {
    msgEl.innerHTML = `Keyword search found nothing. <a href="#" id="try-converse-link" style="color: var(--accent-color);">Try describing it instead.</a>`;
    document.getElementById('try-converse-link').addEventListener('click', (e) => {
      e.preventDefault();
      toggleSearchMode('converse');
      // Pre-fill user input with their failed search and submit
      const inputEl = document.getElementById('user-input');
      inputEl.value = query;
      handleInputSubmit();
    });
  } else {
    msgEl.textContent = `${results.length} result${results.length > 1 ? 's' : ''}`;
    
    results.forEach(r => {
      const wrapper = document.createElement('div');
      wrapper.className = 'thumbnail-wrapper';
      
      const img = document.createElement('img');
      img.src = window.catalogue.getImageURL(r.id);
      img.alt = r.scene;
      
      wrapper.addEventListener('click', () => window.render.openModal(r));
      
      wrapper.appendChild(img);
      gridEl.appendChild(wrapper);
    });
  }
}

async function sendConversationMessage(text, modeStr = 'hunt') {
  isSending = true;
  
  document.getElementById('default-greeting').classList.add('hidden');
  
  window.render.renderUserMessage(text);
  messages.push({ role: 'user', content: text });
  currentHuntUserMessages.push(text);
  
  window.render.showLoading();
  
  try {
    const payload = {
      mode: modeStr === 'single' ? 'single' : 'hunt',
      messages: messages,
      catalogue: window.catalogue.prepareCatalogueForAPI(catalogueList)
    };
    
    const response = await fetch('/api/converse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with ${response.status}`);
    }
    
    const data = await response.json();
    
    messages.push({ 
      role: 'assistant', 
      content: data.say || "Here are some options." 
    });
    
    window.render.hideLoading();
    window.render.renderAssistantMessage(data, catalogueList, modeStr === 'single' ? 'single' : 'hunt');
    revealComparison();
    
  } catch (error) {
    console.error("Error in sendMessage:", error);
    window.render.hideLoading();
    
    window.render.renderAssistantMessage({
      say: error.message || "Something went wrong. Check your connection and try again.",
      candidates: []
    }, catalogueList, modeStr === 'single' ? 'single' : 'hunt');
    
    messages.pop();
    currentHuntUserMessages.pop();
  } finally {
    isSending = false;
    document.getElementById('user-input').focus();
  }
}

async function runComparison(query) {
  // Switch to comparison view
  const thread = document.getElementById('thread');
  const classicView = document.getElementById('classic-search-view');
  const comparisonView = document.getElementById('comparison-view');
  
  thread.classList.add('hidden');
  classicView.classList.add('hidden');
  if (comparisonView) comparisonView.classList.remove('hidden');
  
  document.getElementById('comparison-title').textContent = `Query: "${query}"`;
  
  // 1. Classic Search
  const classicContainer = document.getElementById('compare-classic-results');
  classicContainer.innerHTML = '';
  const classicResults = window.classicSearch(query, catalogueList);
  
  if (classicResults.length === 0) {
    classicContainer.innerHTML = '<em>Keyword search found nothing.</em>';
  } else {
    const grid = document.createElement('div');
    grid.className = 'thumbnail-grid';
    classicResults.forEach(r => {
      const wrapper = document.createElement('div');
      wrapper.className = 'thumbnail-wrapper';
      const img = document.createElement('img');
      img.src = window.catalogue.getImageURL(r.id);
      img.alt = r.scene;
      wrapper.addEventListener('click', () => window.render.openModal(r));
      wrapper.appendChild(img);
      grid.appendChild(wrapper);
    });
    classicContainer.appendChild(grid);
  }
  
  // Create helper to render API response to a container
  const renderAPIResult = (containerId, data, modeStr) => {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (data.say) {
      const p = document.createElement('p');
      p.style.marginBottom = '12px';
      p.style.fontSize = '0.9rem';
      p.textContent = data.say;
      container.appendChild(p);
    }
    
    if (data.candidates && data.candidates.length > 0) {
      // Mock the thread element just for reusing renderAssistantMessage logic slightly? 
      // Actually, since renderAssistantMessage appends to #thread, we need to temporarily mock it 
      // or just rebuild the grid here. Rebuilding is safer to not mess with state.
      const grid = document.createElement('div');
      grid.className = 'thumbnail-grid';
      
      const catMap = new Map();
      catalogueList.forEach(r => catMap.set(r.id, r));
      
      let cleanCandidates = [...new Set(data.candidates)].filter(id => catMap.has(id)).slice(0, 8);
      let expandedList = [];
      let clustersExpanded = new Set();
      
      if (modeStr === 'hunt') {
        const clusterCounts = {};
        cleanCandidates.forEach(id => {
          const r = catMap.get(id);
          if (r.cluster) clusterCounts[r.cluster] = (clusterCounts[r.cluster] || 0) + 1;
        });
        
        cleanCandidates.forEach(id => {
          const r = catMap.get(id);
          if (r.cluster && clusterCounts[r.cluster] >= 2 && r.near_identical) {
            if (!clustersExpanded.has(r.cluster)) {
              expandedList.push(...catalogueList.filter(c => c.cluster === r.cluster));
              clustersExpanded.add(r.cluster);
            }
          } else {
            if (!r.cluster || !clustersExpanded.has(r.cluster)) {
              expandedList.push(r);
            }
          }
        });
      } else {
        cleanCandidates.forEach(id => expandedList.push(catMap.get(id)));
      }
      
      if (data.cannot_distinguish) {
        const strongBand = document.createElement('div');
        strongBand.className = 'enforcement-band honest';
        strongBand.textContent = "I can't tell these apart from what I have.";
        container.appendChild(strongBand);
      }
      
      if (clustersExpanded.size > 0) {
        const infoBand = document.createElement('div');
        infoBand.className = 'enforcement-band info';
        infoBand.textContent = "All from the same moment.";
        container.appendChild(infoBand);
      }
      
      expandedList.forEach(r => {
        const wrapper = document.createElement('div');
        wrapper.className = 'thumbnail-wrapper';
        const img = document.createElement('img');
        img.src = window.catalogue.getImageURL(r.id);
        img.alt = r.scene;
        wrapper.addEventListener('click', () => window.render.openModal(r));
        wrapper.appendChild(img);
        grid.appendChild(wrapper);
      });
      container.appendChild(grid);
    } else {
      container.innerHTML += '<em>No candidates returned.</em>';
    }
  };
  
  const fetchCompare = async (modeStr, containerId) => {
    document.getElementById(containerId).innerHTML = '<em>Loading...</em>';
    try {
      const payload = {
        mode: modeStr,
        messages: [{ role: 'user', content: query }],
        catalogue: window.catalogue.prepareCatalogueForAPI(catalogueList)
      };
      const response = await fetch('/api/converse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const ed = await response.json().catch(() => ({}));
        throw new Error(ed.error || `Server responded with ${response.status}`);
      }
      const data = await response.json();
      renderAPIResult(containerId, data, modeStr);
    } catch (e) {
      document.getElementById(containerId).innerHTML = `<em style="color:red">Error: ${e.message}</em>`;
    }
  };

  // 2. Single Answer
  // 3. The One Where
  await Promise.all([
    fetchCompare('single', 'compare-single-results'),
    fetchCompare('hunt', 'compare-converse-results')
  ]);
}

window.app = { switchMode };
document.addEventListener('DOMContentLoaded', init);
