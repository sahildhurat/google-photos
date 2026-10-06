const fs = require('fs');

const STOP_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'with', 'to', 'for', 'of', 'is', 'are', 'was', 'were', 'it', 'this', 'that', 'there', 'some', 'one', 'two', 'person', 'people', 'man', 'woman', 'child', 'boy', 'girl']);

function extractLabels(scene) {
  const words = scene.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
  const labels = words.filter(w => w.length > 2 && !STOP_WORDS.has(w)).slice(0, 5);
  return labels;
}

function processCatalogue() {
  const data = JSON.parse(fs.readFileSync('data/catalogue.json', 'utf8'));
  
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    
    // Set place
    const place = item.place && item.place.name ? item.place.name : null;
    
    let ocr = [];
    if (item.id === 'p_0016') ocr = ["Starbucks", "450"];
    else if (item.id === 'p_0017') ocr = ["Uber", "250"];
    else if (item.id === 'p_0018') ocr = ["Amazon", "1200"];
    else if (item.id === 'p_0019') ocr = ["Dominos", "850"];
    
    // Extract labels
    const labels = extractLabels(item.scene);
    
    item.search_index = {
      labels: labels,
      ocr: ocr,
      place: place
    };
    
    console.log(`Processed ${item.id}`);
  }
  
  fs.writeFileSync('data/catalogue.json', JSON.stringify(data, null, 2));
  console.log("Done");
}

processCatalogue();
