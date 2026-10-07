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

/* Which photo the card offers.
 *
 * Testing was blunt about this. Nobody rejected the card; they rejected being
 * asked about a photo that did not deserve a sentence. "Whether I write anything
 * depends on the picture. If it's a random bill, I'll skip it." "Some photographs
 * don't need another sentence." "If a useful old one appears, I'd do that one."
 *
 * So the selection changed twice over:
 *
 *  - Documents, receipts and screenshots are out entirely. Two participants named
 *    them unprompted, and one asked for the scratch step on documents to be
 *    removed outright.
 *  - A frame from a near-identical set is picked FIRST when one is available.
 *    That is the photo a note genuinely rescues - it is the one case where no
 *    amount of searching will separate it from its neighbours, so the ask carries
 *    its own reason and the card can say what that reason is.
 */
function selectRecord(mode) {
  const exclusions = new Set(getExclusions());
  let validRecords = catalogueList.filter(r => !exclusions.has(r.id) && (!r.user_deposits || r.user_deposits.length === 0));

  // A bill is not a memory. Keep documents out unless nothing else is left.
  const photosOnly = validRecords.filter(r => r.kind === 'photo');
  if (photosOnly.length) validRecords = photosOnly;

  if (validRecords.length === 0) return;
  
  if (mode === 'demo') {
    // Collect possible tiers
    const possibleTiers = [];

    // Tier 0: a frame from a set that looks like its neighbours. Taken first
    // whenever one exists - this is the photo the note actually saves.
    const nearSets = {};
    catalogueList.forEach(r => {
      if (r.cluster && r.near_identical) (nearSets[r.cluster] = nearSets[r.cluster] || []).push(r);
    });
    const ambiguous = validRecords.find(r => r.cluster && r.near_identical && (nearSets[r.cluster] || []).length > 1);
    if (ambiguous) {
      currentRecord = ambiguous;
      currentTier = {
        level: 0,
        label: `One of ${nearSets[ambiguous.cluster].length} shots from the same moment.`
      };
      return;
    }
    
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
  if (level === 0) return "One you can't tell apart";
  if (level === 3) return "Something rare";
  if (level === 2) return "A day you've forgotten";
  return "A photo you've forgotten";
}

// The ask names what the note is FOR. A participant only understood the point of
// writing one after seeing it work: "It remembered my label and used that to get
// this photo." Saying so up front costs a line.
function getAsk(level) {
  return level === 0
    ? { title: 'What made this one different?',
        why: 'Searching will never separate these. A note will.' }
    : { title: 'What was this?',
        why: 'Whatever you type becomes a way back to it.' };
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
  const ask = getAsk(currentTier.level);
  container.innerHTML = `
    <div class="photo-area" id="photo-area">
      <img src="${window.catalogue.getImageURL(currentRecord.id, 'demo')}" alt="Forgotten photo">
      <button class="not-this-one-btn" id="not-this-one">Not this one</button>
      <canvas id="scratch-canvas" class="scratch-canvas"></canvas>
    </div>
    <div class="question-area" id="question-area">
      <div class="question-subtitle">${currentTier.label}</div>
      <div class="question-title">${ask.title}</div>
      <div class="question-why">${ask.why}</div>
      <div class="input-row" id="input-row">
        <input type="text" id="scratch-input" placeholder="Type or speak a memory...">
        <button id="scratch-mic" aria-label="Voice input">🎤</button>
        <button id="scratch-send" aria-label="Send">→</button>
      </div>
      <button class="skip-btn" id="scratch-skip">Nothing to add</button>
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
  document.getElementById('scratch-skip').addEventListener('click', skipDeposit);
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

/* Skipping has to be as finished as writing.
 *
 * "Let me skip it without making it feel unfinished." "I don't want a backlog of
 * photos I'm supposed to describe." "I don't want to write a quote just to finish
 * a card." Three of four asked for this in nearly the same words, so the skip is
 * a real button beside the input rather than closing the tab, and what it says
 * afterwards carries no debt: no streak broken, no counter, nothing owed.
 *
 * This is also why there is no streak. A streak is the obligation they rejected,
 * wearing a nicer coat.
 */
function skipDeposit() {
  document.getElementById('input-row').style.display = 'none';
  document.getElementById('scratch-skip').style.display = 'none';
  const payoffArea = document.getElementById('payoff-area');
  payoffArea.style.display = 'block';
  payoffArea.innerHTML =
    '<div style="color:#5f6368">Left as it is. Not every photo needs a sentence.</div>';
}

document.addEventListener('DOMContentLoaded', init);
