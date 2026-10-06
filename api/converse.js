const { GoogleGenAI, Type } = require('@google/genai');

const SYSTEM_HUNT = `
You are the conversation engine for a personal photo retrieval system.
The user is trying to find a specific photo based on a vague memory.

Here are the behavioural rules you MUST follow:
1. Never ask for a better description. The user has given everything they can.
2. Shortlist, then ask ONE splitting question. A question that actually distinguishes between held candidates.
3. Hedged details rank, never filter. "maybe", "I think", "possibly" boost but never exclude.
4. Say plainly when you cannot distinguish. Never present one photo confidently while holding an ambiguous set.
5. Prefer time anchors over dates. "the week before Diwali" > "August 2019".
6. Remember everything. Each turn narrows; nothing is forgotten.
7. Note mentioned people. May suggest asking them.
8. Weight user_deposits heavily. They are the user's own words.
9. Be honest about missing dates. Say "I don't know when" rather than guessing.
10. Two or three sentences. Talking, not writing.
11. NEVER invent candidate IDs. The 'candidates' array must ONLY contain exact 'id' strings from the provided catalogue (e.g., "p_0031", "p_0012").
12. CRITICAL ANTI-HALLUCINATION RULE: If the user asks for specific visual elements (like "pizza", "wine", "dog", etc.) and those elements are NOT explicitly present in the provided catalogue records, you MUST NOT return any candidates. You must return an empty 'candidates' array [] and say "I cannot find any photos matching that description."

- candidates: best-first, at most 8. (Empty array [] if NO records contain the requested visual elements).
- cannot_distinguish: true when top candidates are near-identical and the distinguishing detail is not in the records.
- co_present: names of people who were present.
`;

const SYSTEM_SINGLE = `
You help someone find a photo. You have a catalogue of their photos as
structured records. You cannot see the images; you only have the records.

Give the user the single most likely photo, with a brief confident
explanation of why it matches what they described. People want an answer,
not a list.

Do not hedge. Do not ask clarifying questions. Do not offer alternatives.
Do not mention uncertainty. Choose the best match and give it.

Return JSON only:
{
  "say": "<one or two sentences naming the photo you found and why it matches. Or state that you couldn't find it.>",
  "candidates": ["<the single photo id>"]
}

\`candidates\` holds exactly one id. CRITICAL: If the user asks for specific visual elements that are NOT in ANY of the provided records, \`candidates\` MUST be an empty array []. Do not guess or substitute.
`;

const SYSTEM_ASK_FRIEND = `
Someone is trying to find a photo and has got stuck. A second person, who was
present when the photo was taken, is now being asked for help.

You are given the candidate records and the conversation so far.

Write ONE question for that second person. It must be:
- answerable in a few words, without them seeing the full photo
- about something the second person would know and the first person would not
- a question whose answer would change which candidate ranks highest

Do not ask them to describe the photo. Do not ask more than one question.

Give 2 or 3 options. They must be mutually exclusive, and each must point to a
different candidate.
`;

const huntSchema = {
  type: Type.OBJECT,
  properties: {
    say: { type: Type.STRING },
    candidates: { type: Type.ARRAY, items: { type: Type.STRING } },
    cannot_distinguish: { type: Type.BOOLEAN },
    co_present: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["say", "candidates", "cannot_distinguish", "co_present"]
};

const askFriendSchema = {
  type: Type.OBJECT,
  properties: {
    question: { type: Type.STRING },
    options: { type: Type.ARRAY, items: { type: Type.STRING } },
    why: { type: Type.STRING }
  },
  required: ["question", "options", "why"]
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { mode = 'hunt', messages, catalogue } = req.body;

    const ai = new GoogleGenAI({ apiKey });
    let promptTemplate;
    if (mode === 'ask_friend') {
      promptTemplate = SYSTEM_ASK_FRIEND;
    } else if (mode === 'single') {
      promptTemplate = SYSTEM_SINGLE;
    } else {
      promptTemplate = SYSTEM_HUNT;
    }
    
    // System instruction includes the prompt and the catalogue
    const systemInstruction = `${promptTemplate}\n\nCATALOGUE:\n${JSON.stringify(catalogue, null, 2)}`;
    
    // Map roles: 'assistant' -> 'model', 'user' -> 'user'
    const mappedMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    // Note: We reuse huntSchema for 'single' mode. cannot_distinguish and co_present are permitted but ignored.
    const responseSchema = mode === 'ask_friend' ? askFriendSchema : huntSchema;
    
    // Robust retry wrapper to seamlessly bypass temporary 503 capacity errors
    const delay = ms => new Promise(res => setTimeout(res, ms));
    const baseConfig = {
      contents: mappedMessages,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    };

    // A 503 on the newest flagship is a capacity error, and retrying the SAME
    // model usually hits the same shortage. So fall back down the family:
    // older Flash models carry far less load and are on the same free tier.
    // Two attempts per model, then move on. Total worst case ~6s.
    const MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'];
    let response, lastError;

    outer:
    for (const model of MODELS) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          response = await ai.models.generateContent({ model, ...baseConfig });
          if (model !== MODELS[0]) console.warn(`Served by fallback model ${model}`);
          break outer;
        } catch (error) {
          lastError = error;
          const code = error.status || error.code;
          const overloaded = code === 503 || code === 429 || code === 500;
          if (!overloaded) throw error;           // a real error: surface it
          if (attempt === 0) await delay(800);    // one quick retry, same model
        }
      }
    }
    if (!response) throw lastError;

    let content = response.text;
    // Strip markdown formatting if the model incorrectly wraps the JSON
    content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    const parsedData = JSON.parse(content);

    return res.status(200).json(parsedData);
  } catch (error) {
    console.error("API Error:", error);
    const code = error.status || error.code;
    if (code === 503 || code === 429 || code === 500) {
      // Capacity, not a fault in the product. Say so plainly so a reviewer
      // knows to try again rather than concluding the demo is broken.
      return res.status(503).json({
        error: "The model is busy right now. Give it a few seconds and try again.",
        retryable: true
      });
    }
    return res.status(502).json({ error: error.message || "Unknown error occurred" });
  }
}
