const fs = require('fs');
const catalogueList = JSON.parse(fs.readFileSync('data/catalogue.json', 'utf8'));

// Mock classic search
function classicSearch(query, catalogue) {
  if (!query || !query.trim()) return [];
  const tokens = query.toLowerCase().trim().split(/\s+/);
  return catalogue.filter(record => {
    let searchableParts = [];
    if (record.search_index) {
      if (record.search_index.labels) searchableParts.push(...record.search_index.labels);
      if (record.search_index.ocr) searchableParts.push(...record.search_index.ocr);
      if (record.search_index.place) searchableParts.push(record.search_index.place);
    }
    const searchableText = searchableParts.join(' ').toLowerCase();
    return tokens.every(token => searchableText.includes(token));
  });
}

async function fetchMode(mode, query) {
  const res = await fetch('http://localhost:3001/api/converse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode,
      messages: [{ role: 'user', content: query }],
      catalogue: catalogueList.map(r => ({
        id: r.id,
        taken_at: r.taken_at,
        place: r.place,
        people: r.people,
        scene: r.scene,
        visible_only_on_close_look: r.visible_only_on_close_look,
        cluster: r.cluster,
        near_identical: r.near_identical
      }))
    })
  });
  if (!res.ok) {
    const txt = await res.text();
    return `Error ${res.status}: ${txt}`;
  }
  return await res.json();
}

async function runTests() {
  const queries = [
    "The one where I had pizza and wine",
    "The one where we were drinking cocktails",
    "That bill I paid for books"
  ];
  
  let report = "# Full Project Test Results\n\n";

  for (const q of queries) {
    console.log("Testing:", q);
    report += `## Query: "${q}"\n\n`;
    
    // Classic
    const cRes = classicSearch(q, catalogueList);
    report += `### Classic Search\n`;
    if (cRes.length === 0) report += `0 results.\n`;
    else report += `${cRes.length} results: ${cRes.map(r => r.id).join(', ')}\n`;
    
    // Single Answer
    report += `\n### Single Answer (Best Guess)\n`;
    try {
      const sRes = await fetchMode('single', q);
      report += `**Say:** ${sRes.say}\n`;
      report += `**Candidates:** ${sRes.candidates ? sRes.candidates.join(', ') : 'None'}\n`;
    } catch (e) {
      report += `Error: ${e.message}\n`;
    }
    
    // Conversation
    report += `\n### The One Where (Conversation)\n`;
    try {
      const hRes = await fetchMode('hunt', q);
      report += `**Say:** ${hRes.say}\n`;
      report += `**Candidates:** ${hRes.candidates ? hRes.candidates.join(', ') : 'None'}\n`;
      if (hRes.cannot_distinguish) report += `*Cannot distinguish flag is TRUE*\n`;
    } catch (e) {
      report += `Error: ${e.message}\n`;
    }
    report += `\n---\n\n`;
  }
  
  fs.writeFileSync('C:/Users/Admin/.gemini/antigravity-ide/brain/2a390458-089a-4d50-8588-77cd65ed72ab/comparison_report.md', report);
  console.log("Done");
}

runTests();
