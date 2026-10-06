/* Describes uploaded photos so "Your photos" mode has records to search.
 *
 * MODULE FORMAT: CommonJS, end to end - same reason as api/converse.js.
 * There is no "type": "module" in package.json, so a single `export default`
 * here stops the whole module parsing and the upload path dies with a bare
 * 500 before any of this code runs.
 */

const describeSchema = {
  type: 'OBJECT',
  properties: {
    kind: {
      type: 'STRING',
      enum: ['photo', 'screenshot', 'document', 'receipt', 'video_thumb']
    },
    scene: { type: 'STRING' },
    visible_only_on_close_look: { type: 'ARRAY', items: { type: 'STRING' } }
  },
  required: ['kind', 'scene', 'visible_only_on_close_look']
};

const SYSTEM_PROMPT = `
You are a highly capable image analysis agent. Your task is to extract three fields from the provided image:
1. 'kind': Classify the image strictly into one of the allowed enums.
2. 'scene': Describe the main subjects, action, and setting in one concise sentence. Be strictly literal. Do not name objects that are not clearly visible.
3. 'visible_only_on_close_look': An array of 1-3 tiny details that aren't obvious at first glance. CRITICAL: DO NOT HALLUCINATE. DO NOT MAKE UP DETAILS. If you are not 100% sure an object (e.g. a red saree) is in the image, DO NOT mention it. Keep it strictly to undeniable facts.
`;

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY is not set on this deployment.'
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { images } = body; // Expects { images: [{ id, dataUrl }] }

    if (!images || !Array.isArray(images)) {
      return res.status(400).json({ error: 'Invalid request format' });
    }

    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    // Process the batch sequentially since the client handles parallelization and rate limiting
    const results = [];

    for (const img of images) {
      try {
        // dataUrl format: "data:image/jpeg;base64,/9j/4AAQ..."
        const base64Data = String(img.dataUrl || '').split(',')[1];
        if (!base64Data) throw new Error('No image data received.');

        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: [{
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
              { text: 'Extract the required details from this image.' }
            ]
          }],
          config: {
            systemInstruction: SYSTEM_PROMPT,
            temperature: 0,
            responseMimeType: 'application/json',
            responseSchema: describeSchema
          }
        });

        const parsed = JSON.parse(String(response.text).replace(/^```json\s*/, '').replace(/\s*```$/, '').trim());
        results.push({ id: img.id, ...parsed });
      } catch (err) {
        console.error('Describe error for id', img.id, err);
        results.push({ id: img.id, error: err.message });
      }
    }

    return res.status(200).json({ results });
  } catch (error) {
    console.error('Describe API Error:', error);
    return res.status(502).json({ error: error.message || 'Unknown error occurred' });
  }
}

module.exports = handler;
module.exports.default = handler;
