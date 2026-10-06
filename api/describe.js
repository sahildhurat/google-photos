const { GoogleGenAI, Type } = require('@google/genai');

const describeSchema = {
  type: Type.OBJECT,
  properties: {
    kind: {
      type: Type.STRING,
      enum: ["photo", "screenshot", "document", "receipt", "video_thumb"]
    },
    scene: { type: Type.STRING },
    visible_only_on_close_look: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["kind", "scene", "visible_only_on_close_look"]
};

const SYSTEM_PROMPT = `
You are a highly capable image analysis agent. Your task is to extract three fields from the provided image:
1. 'kind': Classify the image strictly into one of the allowed enums.
2. 'scene': Describe the main subjects, action, and setting in one concise sentence. Be strictly literal. Do not name objects that are not clearly visible.
3. 'visible_only_on_close_look': An array of 1-3 tiny details that aren't obvious at first glance. CRITICAL: DO NOT HALLUCINATE. DO NOT MAKE UP DETAILS. If you are not 100% sure an object (e.g. a red saree) is in the image, DO NOT mention it. Keep it strictly to undeniable facts.
`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { images } = req.body; // Expects { images: [{ id, dataUrl }] }
    
    if (!images || !Array.isArray(images)) {
      return res.status(400).json({ error: 'Invalid request format' });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Process the batch sequentially since the client handles parallelization and rate limiting
    const results = [];
    
    for (const img of images) {
      try {
        // dataUrl format: "data:image/jpeg;base64,/9j/4AAQ..."
        const base64Data = img.dataUrl.split(',')[1];
        
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: [{
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
              { text: "Extract the required details from this image." }
            ]
          }],
          config: {
            systemInstruction: SYSTEM_PROMPT,
            temperature: 0,
            responseMimeType: "application/json",
            responseSchema: describeSchema
          }
        });
        
        const parsed = JSON.parse(response.text);
        results.push({ id: img.id, ...parsed });
      } catch (err) {
        console.error("Describe error for id", img.id, err);
        results.push({ id: img.id, error: err.message });
      }
    }

    return res.status(200).json({ results });
  } catch (error) {
    console.error("Describe API Error:", error);
    return res.status(502).json({ error: error.message || "Unknown error occurred" });
  }
}
