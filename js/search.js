/**
 * Performs a literal keyword search against the catalogue.
 * Reproduces the limitations of traditional keyword search systems.
 * No synonyms, no fuzzy matching, no LLM.
 *
 * @param {string} query - The user's search string.
 * @param {Array} catalogue - The array of records to search.
 * @returns {Array} - Matching records.
 */
function classicSearch(query, catalogue) {
  if (!query || !query.trim()) return [];
  
  // Lowercase and split on whitespace
  const tokens = query.toLowerCase().trim().split(/\s+/);
  
  return catalogue.filter(record => {
    // Concatenate searchable text: search_index.labels, ocr, and place
    let searchableParts = [];
    
    if (record.search_index) {
      if (record.search_index.labels) searchableParts.push(...record.search_index.labels);
      if (record.search_index.ocr) searchableParts.push(...record.search_index.ocr);
      if (record.search_index.place) searchableParts.push(record.search_index.place);
    }
    
    const searchableText = searchableParts.join(' ').toLowerCase();
    
    // A record matches only if ALL tokens are found in the searchable text
    return tokens.every(token => searchableText.includes(token));
  });
}

window.classicSearch = classicSearch;
