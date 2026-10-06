let currentRecord = null;
let currentTier = null;
let catalogueList = [];
let voiceInput = null;
let isScratched = false;

// Helpers for localStorage
function getExclusions() {
  try {
    return JSON.parse(localStorage.getItem('tow_exclusion_list') || '[]');
  } catch (e) { return []; }
}
function addExclusions(ids) {
  const current = getExclusions();
  const next = [...new Set([...current, ...ids])];
  localStorage.setItem('tow_exclusion_list', JSON.stringify(next));
}
function hasScratchedToday() {
  const last = localStorage.getItem('tow_last_scratch_date');
  if (!last) return false;
  return last === new Date().toLocaleDateString();
}
function markScratchedToday() {
  localStorage.setItem('tow_last_scratch_date', new Date().toLocaleDateString());
}

async function init() {
  document.getElementById('reset-demo').addEventListener('click', () => {
    localStorage.removeItem('tow_last_scratch_date');
    location.reload();
  });

  // The daily card always draws from the demo library. Serving an uploaded
  // photo meant the deposit landed in the user catalogue, so searching for it
  // from the demo library found nothing - a confusing dead end.
  const mode = 'demo';
  try {
    catalogueList = await window.catalogue.loadCatalogue(mode);
  } catch (e) {
    document.getElementById('card-container').innerHTML = '<div class="empty-state">Error loading catalogue.</div>';
    return;
  }
  
  if (hasScratchedToday()) {
    renderAlreadyScratched();
    return;
  }
  
  selectRecord(mode);
  
  if (!currentRecord) {
    document.getElementById('card-container').innerHTML = '<div class="empty-state"><h2>You\'ve described everything!</h2><p>No forgotten photos left.</p></div>';
    return;
  }
  
  renderCard();
}

function selectRecord(mode) {
  const exclusions = new Set(getExclusions());
  const validRecords = catalogueList.filter(r => !exclusions.has(r.id) && (!r.user_deposits || r.user_deposits.length === 0));
  
  if (validRecords.length === 0) return;
  
  if (mode === 'demo') {
    // Collect possible tiers
    const possibleTiers = [];
    
    // Tier 1: Any unopened photo
    const t1 = validRecords.find(r => r.opened_since_capture === false);
    if (t1) possibleTiers.push({ level: 1, record: t1, label: getDateAnchor(t1.taken_at) });
    
    // Tier 2: A day with several photos (>= 4 for instance)
    const dateGroups = {};
    catalogueList.forEach(r => {
      if (!r.taken_at) return;
      const d = r.taken_at.split('T')[0];
      if (!dateGroups[d]) dateGroups[d] = [];
      dateGroups[d].push(r);
    });
    let t2Record = null;
    let t2Count = 0;
    for (const r of validRecords) {
      if (r.taken_at && dateGroups[r.taken_at.split('T')[0]].length >= 4) {
        t2Record = r;
        t2Count = dateGroups[r.taken_at.split('T')[0]].length;
        break;
      }
    }
    if (t2Record) possibleTiers.push({ level: 2, record: t2Record, label: `You took ${t2Count} photos this day.` });
    
    // Tier 3: Earliest photo of someone
    const peopleMap = {};
    validRecords.forEach(r => {
      if (r.people) {
        r.people.forEach(p => {
          if (!peopleMap[p]) peopleMap[p] = [];
          peopleMap[p].push(r);
        });
      }
    });
    let t3Record = null;
    let t3Label = "";
    for (const person in peopleMap) {
      if (peopleMap[person].length > 0) {
        const earliest = peopleMap[person].sort((a, b) => new Date(a.taken_at) - new Date(b.taken_at))[0];
        if (earliest && earliest.opened_since_capture === false) {
          t3Record = earliest;
          t3Label = `Your first photo of ${person}.`;
          break;
        }
      }
    }
    if (t3Record) possibleTiers.push({ level: 3, record: t3Record, label: t3Label });
    
    if (possibleTiers.length > 0) {
      // Pick one randomly so the demo shows variety
      const chosen = possibleTiers[Math.floor(Math.random() * possibleTiers.length)];
      currentRecord = chosen.record;
      currentTier = { level: chosen.level, label: chosen.label };
    } else {
      // Fallback
      currentRecord = validRecords[0];
      currentTier = { level: 1, label: getDateAnchor(currentRecord.taken_at) };
    }
  } else {
    // User mode fallback to Tier 1 oldest
    validRecords.sort((a, b) => new Date(a.taken_at || 0).getTime() - new Date(b.taken_at || 0).getTime());
    currentRecord = validRecords[0];
    currentTier = { level: 1, label: getDateAnchor(currentRecord.taken_at) };
  }
}

function getDateAnchor(dateString) {
  if (!dateString) return "Sometime in the past.";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "Sometime in the past.";
  const day = d.toLocaleDateString(undefined, { weekday: 'long' });
  const year = d.getFullYear();
  return `A ${day} in ${year}.`;
}

function getTeaser(level) {
  if (level === 3) return "Something rare";
  if (level === 2) return "A day you've forgotten";
  return "A photo you've forgotten";
}

function renderAlreadyScratched() {
  document.getElementById('card-container').innerHTML = `
    <div class="empty-state">
      <p>You've opened today's card.</p>
      <p style="font-size: 0.9rem; margin-top: 8px;">The next one arrives tomorrow.</p>
    </div>
  `;
}

function renderCard() {
  const container = document.getElementById('card-container');
  container.innerHTML = `
    <div class="photo-area" id="photo-area">
      <img src="${window.catalogue.getImageURL(currentRecord.id, 'demo')}" alt="Forgotten photo">
      <button class="not-this-one-btn" id="not-this-one">Not this one</button>
      <canvas id="scratch-canvas" class="scratch-canvas"></canvas>
    </div>
    <div class="question-area" id="question-area">
      <div class="question-subtitle">${currentTier.label}</div>
      <div class="question-title">What was this?</div>
      <div class="input-row" id="input-row">
        <input type="text" id="scratch-input" placeholder="Type or speak a memory...">
        <button id="scratch-mic" aria-label="Voice input">🎤</button>
        <button id="scratch-send" aria-label="Send">→</button>
      </div>
      <div id="payoff-area" style="display:none;"></div>
    </div>
  `;
  
  // Also respect prefers-reduced-motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    const btn = document.createElement('button');
    btn.className = 'reduce-motion-btn';
    btn.textContent = 'Reveal Photo';
    btn.onclick = revealCard;
    document.getElementById('photo-area').appendChild(btn);
  }
  
  initCanvas();
  
  document.getElementById('not-this-one').addEventListener('click', handleExclude);
  
  const inputEl = document.getElementById('scratch-input');
  const micBtn = document.getElementById('scratch-mic');
  const sendBtn = document.getElementById('scratch-send');
  
  voiceInput = window.initVoice(inputEl, micBtn);
  
  micBtn.addEventListener('click', () => {
    if (voiceInput.isListening()) voiceInput.stop();
    else voiceInput.start();
  });
  
  sendBtn.addEventListener('click', submitDeposit);
  inputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitDeposit();
  });
}

function initCanvas() {
  const canvas = document.getElementById('scratch-canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  // Set logical size equal to layout size to prevent scaling artifacts
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  
  // Draw flat neutral background
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw diagonal hatch pattern
  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth = 2;
  for(let i = -canvas.height; i < canvas.width; i += 10) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + canvas.height, canvas.height);
    ctx.stroke();
  }
  
  // Draw Teaser text
  ctx.fillStyle = '#4b5563';
  ctx.font = '500 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Scratch', canvas.width / 2, canvas.height / 2 - 10);
  ctx.font = '400 12px sans-serif';
  ctx.fillText(getTeaser(currentTier.level), canvas.width / 2, canvas.height / 2 + 10);
  
  ctx.globalCompositeOperation = 'destination-out';
  
  let isDrawing = false;
  let lastPos = null;
  let moveCount = 0;
  
  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX || e.touches?.[0].clientX) - rect.left,
      y: (e.clientY || e.touches?.[0].clientY) - rect.top
    };
  }
  
  function scratch(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    
    ctx.lineWidth = 56; // 28px radius roughly
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    if (lastPos) {
      ctx.moveTo(lastPos.x, lastPos.y);
    } else {
      ctx.moveTo(pos.x, pos.y);
    }
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos = pos;
    
    moveCount++;
    if (moveCount % 10 === 0) {
      checkAlpha(ctx, canvas);
    }
  }
  
  canvas.addEventListener('pointerdown', (e) => {
    isDrawing = true;
    canvas.setPointerCapture(e.pointerId);
    lastPos = getPos(e);
    scratch(e);
  });
  canvas.addEventListener('pointermove', scratch);
  canvas.addEventListener('pointerup', (e) => {
    isDrawing = false;
    lastPos = null;
    canvas.releasePointerCapture(e.pointerId);
  });
}

function checkAlpha(ctx, canvas) {
  if (isScratched) return;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  let transparentPixels = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] === 0) transparentPixels++;
  }
  const cleared = transparentPixels / (canvas.width * canvas.height);
  if (cleared > 0.55) {
    revealCard();
  }
}

function revealCard() {
  if (isScratched) return;
  isScratched = true;
  document.getElementById('scratch-canvas').classList.add('cleared');
  document.getElementById('question-area').classList.add('visible');
  markScratchedToday();
}

function handleExclude() {
  if (!currentRecord) return;
  const excludeIds = [currentRecord.id];
  if (currentRecord.taken_at) {
    const d = new Date(currentRecord.taken_at).getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    catalogueList.forEach(r => {
      if (r.taken_at) {
        const rd = new Date(r.taken_at).getTime();
        if (Math.abs(rd - d) <= sevenDays) {
          excludeIds.push(r.id);
        }
      }
    });
  }
  addExclusions(excludeIds);
  // Reload immediately to fetch a new card or show "no cards"
  location.reload();
}

function submitDeposit() {
  const inputEl = document.getElementById('scratch-input');
  let text = inputEl.value.trim();
  
  if (voiceInput && voiceInput.isListening()) {
    voiceInput.stop();
    text = inputEl.value.trim();
  }
  
  if (!text) return;
  
  document.getElementById('input-row').style.display = 'none';
  
  // The daily card always draws from the demo library. Serving an uploaded
  // photo meant the deposit landed in the user catalogue, so searching for it
  // from the demo library found nothing - a confusing dead end.
  const mode = 'demo';
  window.captureDeposits(currentRecord.id, [text], catalogueList, mode);
  
  const payoffArea = document.getElementById('payoff-area');
  payoffArea.style.display = 'block';
  payoffArea.innerHTML = `
    <div style="color: var(--primary-color); font-weight: 500; margin-bottom: 8px;">
      This photo now answers to "${text}".
    </div>
    <a href="index.html?q=${encodeURIComponent(text)}" class="payoff-chip">Try finding it →</a>
  `;
}

document.addEventListener('DOMContentLoaded', init);
