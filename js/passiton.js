let catalogueList = [];
let currentScenario = 1;

/* Who to ask.
 *
 * This was hard-coded to "Amit" while the search that led here named whoever is
 * in the photo - a participant caught it immediately ("Why is it Amit now? In my
 * actual search I'd ask Dev"). The person worth asking is someone who was there,
 * and the records already say who that is, so take the name from the candidates
 * rather than from a constant.
 */
let friendName = 'Amit';

function friendFor(records) {
  const withPeople = (records || []).find(r => r.people && r.people.length);
  return (withPeople && withPeople.people[0]) || 'whoever was there';
}

// Mock conversation histories for the scenarios
const scenarios = {
  1: {
    messages: [
      { role: "user", content: "That trek we did" },
      { role: "assistant", content: "I found a few treks. Anything else you remember?" },
      { role: "user", content: "We were standing near a ridge" }
    ],
    targetCandidates: ["p_0031", "p_0032", "p_0033"], // c_trek
    // Keyed by the real catalogue ids. Crops sit low and off-centre so the
    // detail establishes WHERE without revealing WHAT - never any legible text.
    cropSettings: {
      "p_0031": "35% 99%",
      "p_0032": "18% 97%",
      "p_0033": "62% 99%"
    },
    // Verified by screenshot at scale 4.2: boots, pole and trail. Enough to
    // recognise the terrain, no legible text. Crops higher in the frame are
    // empty sky - they hide the sign by showing nothing, which leaves Amit
    // with no basis to answer at all.
    defaultCrop: "35% 97%"
  },
  2: {
    messages: [
      { role: "user", content: "that photo from the café in Hampi" },
      { role: "assistant", content: "I found some café photos. There are a few very similar ones." },
      { role: "user", content: "I remember blue chairs" }
    ],
    targetCandidates: ["p_0001", "p_0002", "p_0003"], // c_hampi_cafe
    cropSettings: {
      "p_0001": "50% 95%",
      "p_0002": "70% 78%",
      "p_0003": "40% 93%"
    },
    // Floor and table only. A crop showing a chair would answer the very
    // question the disagreement scenario asks Amit, and the cafe blackboard
    // high in frame names the place outright.
    defaultCrop: "55% 94%"
  }
};

async function init() {
  catalogueList = await window.catalogue.loadCatalogue('demo');
  
  // Wire up toggles
  document.getElementById('scenario-1').addEventListener('click', () => loadScenario(1));
  document.getElementById('scenario-2').addEventListener('click', () => loadScenario(2));
  document.getElementById('ask-amit-btn').addEventListener('click', triggerAskAmit);
  
  loadScenario(2);  // cafe: the disagreement is the better opener
}

function getCandidateRecords(scenarioId) {
  // Try to find the specific records based on the scene string as a fallback, 
  // since IDs might not match exactly if generated randomly in Stage 0.
  const s = scenarios[scenarioId];
  if (scenarioId === 1) {
    return catalogueList.filter(r => r.cluster === 'c_trek').slice(0, 3);
  } else {
    return catalogueList.filter(r => r.cluster === 'c_hampi_cafe').slice(0, 3);
  }
}

function loadScenario(id) {
  currentScenario = id;
  
  document.getElementById('scenario-1').classList.toggle('active', id === 1);
  document.getElementById('scenario-2').classList.toggle('active', id === 2);
  
  const leftThread = document.getElementById('left-thread');
  leftThread.innerHTML = '';
  
  const data = scenarios[id];
  
  // Render initial messages
  data.messages.forEach(msg => {
    const div = document.createElement('div');
    div.className = `message ${msg.role}`;
    div.innerHTML = `<div class="bubble">${msg.content}</div>`;
    leftThread.appendChild(div);
  });
  
  // Render candidate grid
  const candidates = getCandidateRecords(id);
  friendName = friendFor(candidates);
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message assistant';
  
  const gridContainer = document.createElement('div');
  gridContainer.className = 'grid-container';
  
  // Band
  const band = document.createElement('div');
  // c_trek is near_identical:false - these photos ARE distinguishable, so the
  // strong band would be a false admission. Only the hampi cafe set earns it.
  band.className = id === 1 ? 'enforcement-band info' : 'enforcement-band honest';
  band.textContent = id === 1 ? "Three from that day." : "All from the same moment \u2014 I can't tell which one you mean.";
  gridContainer.appendChild(band);
  
  const grid = document.createElement('div');
  grid.className = 'thumbnail-grid';
  grid.id = 'left-grid';
  
  candidates.forEach(r => {
    const wrapper = document.createElement('div');
    wrapper.className = 'thumbnail-wrapper';
    wrapper.dataset.id = r.id;
    const img = document.createElement('img');
    img.src = window.catalogue.getImageURL(r.id, 'demo');
    wrapper.appendChild(img);
    grid.appendChild(wrapper);
  });
  
  gridContainer.appendChild(grid);
  msgDiv.appendChild(gridContainer);
  leftThread.appendChild(msgDiv);
  
  // Reset right pane
  const rightPane = document.getElementById('right-pane');
  rightPane.classList.add('inactive');
  document.getElementById('right-content').innerHTML = '';
  
  document.getElementById('ask-amit-btn').style.display = 'block';
  document.getElementById('ask-amit-btn').disabled = false;
  document.getElementById('ask-amit-btn').textContent = 'Ask ' + friendName + ' — they were there';
}

async function triggerAskAmit() {
  const btn = document.getElementById('ask-amit-btn');
  btn.disabled = true;
  btn.textContent = 'Asking ' + friendName + '…';
  
  const data = scenarios[currentScenario];
  const candidates = getCandidateRecords(currentScenario);
  
  try {
    const payload = {
      mode: 'ask_friend',
      messages: data.messages,
      catalogue: window.catalogue.prepareCatalogueForAPI(candidates)
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
    
    const result = await response.json();
    renderRightPane(result, candidates);
    btn.style.display = 'none';
    
  } catch (err) {
    console.error(err);
    alert('Couldn\'t reach ' + friendName + ' just now.');
    btn.disabled = false;
    btn.textContent = 'Ask ' + friendName + ' — they were there';
  }
}

function renderRightPane(apiResult, candidates) {
  const rightPane = document.getElementById('right-pane');
  const rightContent = document.getElementById('right-content');
  
  rightPane.classList.remove('inactive');
  rightContent.innerHTML = '';
  
  // Find a candidate to crop
  const targetPhoto = candidates[0];
  const cropPos = scenarios[currentScenario].cropSettings[targetPhoto.id] || scenarios[currentScenario].defaultCrop;
  
  // Crop Preview
  const cropDiv = document.createElement('div');
  cropDiv.className = 'crop-preview';
  const img = document.createElement('img');
  img.src = window.catalogue.getImageURL(targetPhoto.id, 'demo');
  img.style.objectPosition = cropPos;
  img.style.transformOrigin = cropPos;
  cropDiv.appendChild(img);
  rightContent.appendChild(cropDiv);
  
  // Question Box
  const qBox = document.createElement('div');
  qBox.className = 'question-box';
  
  const qText = document.createElement('div');
  qText.className = 'question-text';
  qText.textContent = apiResult.question || "What detail do you remember from this moment?";
  qBox.appendChild(qText);
  
  const optionsGrid = document.createElement('div');
  optionsGrid.className = 'options-grid';
  
  (apiResult.options || []).forEach(opt => {
    const obtn = document.createElement('button');
    obtn.className = 'option-btn';
    obtn.textContent = opt;
    obtn.addEventListener('click', () => submitAmitAnswer(opt));
    optionsGrid.appendChild(obtn);
  });
  
  const freeform = document.createElement('div');
  freeform.className = 'freeform-input';
  freeform.innerHTML = `
    <input type="text" id="amit-freeform" placeholder="Or type your own answer...">
    <button id="amit-submit-freeform">Send</button>
  `;
  optionsGrid.appendChild(freeform);
  qBox.appendChild(optionsGrid);
  
  rightContent.appendChild(qBox);
  
  // Add reason text slightly muted
  // Deliberate annotation, not debug output: strip internal record ids and
  // keep it to one sentence.
  let why = apiResult.why || "Only someone who was there can answer this.";
  why = why.replace(/\bp_\d+\b/g, '').replace(/\s*\(\s*,?\s*\)/g, '')
           .replace(/\s{2,}/g, ' ').replace(/\s+([.,;:])/g, '$1').trim();
  const firstStop = why.indexOf('. ');
  if (firstStop > 30) why = why.slice(0, firstStop + 1);
  if (why.length > 160) why = why.slice(0, 157).trimEnd() + '\u2026';

  const whyText = document.createElement('div');
  whyText.className = 'how-note';
  whyText.innerHTML = '<b>How this works</b>';
  whyText.appendChild(document.createTextNode(why));
  rightContent.appendChild(whyText);
  
  document.getElementById('amit-submit-freeform').addEventListener('click', () => {
    const val = document.getElementById('amit-freeform').value;
    if (val) submitAmitAnswer(val);
  });
}

async function submitAmitAnswer(answerText) {
  const rightContent = document.getElementById('right-content');
  rightContent.innerHTML = `<div class="message user"><div class="bubble">${answerText}</div></div>`;
  
  // Formulate the new history
  const data = scenarios[currentScenario];
  const newMessages = [...data.messages, { role: "user", content: `${friendName} says: "${answerText}"` }];
  
  // Update left pane visibly
  const leftThread = document.getElementById('left-thread');
  const div = document.createElement('div');
  div.className = 'message user';
  div.innerHTML = `<div class="bubble" style="background: #e5e7eb; color: #374151;">${friendName} says: "${answerText}"</div>`;
  leftThread.insertBefore(div, leftThread.lastElementChild);
  
  try {
    const candidates = getCandidateRecords(currentScenario);
    
    // For scenario 2, we simulate the disagreement resolution directly to avoid 
    // relying on the model producing the exact perfect string.
    if (currentScenario === 2) {
       await new Promise(r => setTimeout(r, 1000));
       resolveDisagreementSimulation(candidates);
    } else {
      const payload = {
        mode: 'hunt',
        messages: newMessages,
        catalogue: window.catalogue.prepareCatalogueForAPI(candidates)
      };
      
      const response = await fetch('/api/converse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      // Update UI
      const infoLine = document.createElement('div');
      infoLine.style.fontSize = '0.9rem';
      infoLine.style.color = '#4b5563';
      infoLine.style.margin = '10px 0';
      infoLine.textContent = currentScenario === 1 ? `${friendName} says it was the morning. That moves two photos up.` : `${friendName}'s answer came back. ${result.say}`;
      leftThread.appendChild(infoLine);
      
      // Re-order grid (simulation of re-ranking)
      const grid = document.getElementById('left-grid');
      grid.classList.add('re-ranking');
      
      if (result.candidates && result.candidates.length > 0) {
        // Move the top candidate to the front
        const topId = result.candidates[0];
        const wrapper = document.querySelector(`.thumbnail-wrapper[data-id="${topId}"]`);
        if (wrapper) {
          wrapper.style.transform = 'scale(1.05)';
          wrapper.style.borderColor = 'var(--accent-color)';
          wrapper.style.borderWidth = '3px';
          grid.prepend(wrapper);
          setTimeout(() => wrapper.style.transform = 'scale(1)', 500);
        }
      }
    }
    
    // Make deposit
    const topPhotoId = candidates[0].id; // Simplified targeting
    if (window.captureDeposits) {
      window.captureDeposits(topPhotoId, [answerText], catalogueList, 'demo');
      const depositMsg = document.createElement('div');
      depositMsg.style.fontSize = '0.8rem';
      depositMsg.style.color = '#10b981';
      depositMsg.style.marginTop = '10px';
      depositMsg.textContent = `✓ "${answerText}" saved as a deposit.`;
      rightContent.appendChild(depositMsg);
    }
    
  } catch (e) {
    console.error(e);
  }
}

function resolveDisagreementSimulation(candidates) {
  const leftThread = document.getElementById('left-thread');
  
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message assistant';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = `You remember blue, ${friendName} remembers green. Both are in these frames — there were two sets of chairs.`;
  msgDiv.appendChild(bubble);
  leftThread.appendChild(msgDiv);
  
  // Highlight the candidates
  const grid = document.getElementById('left-grid');
  grid.classList.add('re-ranking');
  const wrappers = grid.querySelectorAll('.thumbnail-wrapper');
  wrappers.forEach(w => {
    w.style.borderColor = 'var(--accent-color)';
    w.style.borderWidth = '2px';
  });
}

document.addEventListener('DOMContentLoaded', init);
