/* The conversation engine.
 *
 * MODULE FORMAT: this file is CommonJS, end to end. There is no
 * "type": "module" in package.json, so Node parses every .js here as
 * CommonJS, and a single `export default` anywhere makes the whole module
 * fail to parse - which means the function dies before the handler runs and
 * the caller gets a bare 500 with no JSON body. So: module.exports at the
 * bottom, and the SDK is pulled in with a dynamic import() inside the
 * handler, which works from CommonJS whether or not @google/genai ships as
 * ESM-only. Schema types are the plain uppercase strings the API expects,
 * so the `Type` enum is not needed at module scope.
 */

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
13. EXACT DEPOSIT MATCH. A record's 'user_deposits' entries are phrases the user themselves wrote on that photo. If the user's latest message, ignoring case and punctuation, is EXACTLY one of those phrases, that photo is the answer - not a candidate to weigh. Put its id first in 'candidates', set 'cannot_distinguish' to false, and say plainly that this is the one they labelled with those words. Do not ask a splitting question; they have already answered it. A partial overlap is NOT an exact match: if they typed "blue" and the deposit reads "blue chairs", rule 13 does not apply and you rank normally.

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
  type: 'OBJECT',
  properties: {
    say: { type: 'STRING' },
    candidates: { type: 'ARRAY', items: { type: 'STRING' } },
    cannot_distinguish: { type: 'BOOLEAN' },
    co_present: { type: 'ARRAY', items: { type: 'STRING' } }
  },
  required: ['say', 'candidates', 'cannot_distinguish', 'co_present']
};

const askFriendSchema = {
  type: 'OBJECT',
  properties: {
    question: { type: 'STRING' },
    options: { type: 'ARRAY', items: { type: 'STRING' } },
    why: { type: 'STRING' }
  },
  required: ['question', 'options', 'why']
};

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Distinct wording, so this is never confused with a model outage.
    return res.status(500).json({
      error: 'GEMINI_API_KEY is not set on this deployment.'
    });
  }

  try {
    // Vercel normally parses JSON bodies, but a wrong content-type leaves a
    // string, and destructuring that silently yields undefined.
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { mode = 'hunt', messages, catalogue } = body;

    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: 'No messages were sent.' });
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    let promptTemplate;
    if (mode === 'ask_friend') {
      promptTemplate = SYSTEM_ASK_FRIEND;
    } else if (mode === 'single') {
      promptTemplate = SYSTEM_SINGLE;
    } else {
      promptTemplate = SYSTEM_HUNT;
    }

    // Map roles: 'assistant' -> 'model', 'user' -> 'user'
    const mappedMessages = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    // Note: We reuse huntSchema for 'single' mode. cannot_distinguish and co_present are permitted but ignored.
    const responseSchema = mode === 'ask_friend' ? askFriendSchema : huntSchema;

    const delay = (ms) => new Promise((r) => setTimeout(r, ms));

    // A call that never returns is worse than one that fails: the page just
    // spins. So every attempt gets a hard budget and we move on when it is
    // spent. Promise.race cannot cancel the request, but it frees us to try
    // the next model, which is what matters to the person waiting.
    const withBudget = (p, ms, label) => Promise.race([
      p,
      new Promise((_, reject) => setTimeout(
        () => reject(Object.assign(new Error(label + ' exceeded ' + ms + 'ms'), { status: 503 })),
        ms))
    ]);

    // The catalogue is the bulk of every prompt. Compact JSON, not indented:
    // the indentation was ~30% of the payload and carries no meaning.
    const systemInstruction = promptTemplate + '\n\nCATALOGUE:\n' + JSON.stringify(catalogue);

    const baseConfig = {
      contents: mappedMessages,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0,
        // The answer is two sentences and at most eight ids. Without a ceiling
        // a model is free to spend minutes on a reply this small.
        maxOutputTokens: 800,
        responseMimeType: 'application/json',
        responseSchema: responseSchema
      }
    };

    // Extended reasoning is the likeliest source of a minute-long wait on a
    // task this mechanical: read 37 records, rank them, ask one question.
    // Turning it off is not a downgrade of the model - it is the same model,
    // not deliberating. If the field is rejected we retry that model without it.
    const fastConfig = {
      contents: mappedMessages,
      config: Object.assign({}, baseConfig.config, { thinkingConfig: { thinkingBudget: 0 } })
    };

    // Budgets fall as we go: the first model gets the most room, later ones
    // are fallbacks and a slow fallback helps nobody.
    const MODELS = [
      { name: 'gemini-3.8-flash', ms: 11000 },
      { name: 'gemini-3.5-flash', ms: 9000 },
      { name: 'gemini-3.1-flash-lite', ms: 9000 }
    ];

    let response, lastError, servedBy = null, noThinking = true;
    const startedAt = Date.now();

    outer:
    for (const m of MODELS) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const cfg = noThinking ? fastConfig : baseConfig;
        try {
          response = await withBudget(
            ai.models.generateContent(Object.assign({ model: m.name }, cfg)),
            m.ms, m.name);
          servedBy = m.name;
          break outer;
        } catch (error) {
          lastError = error;
          const code = error.status || error.code;
          const msg = String(error.message || '');

          // The model does not accept a thinking budget: same model, same
          // attempt, without that field. Not a failure worth falling back for.
          if (noThinking && (code === 400 || /thinking|unknown name|invalid.*argument/i.test(msg))) {
            noThinking = false;
            attempt--;
            continue;
          }

          const retryable = code === 503 || code === 429 || code === 500 || /exceeded \d+ms/.test(msg);
          if (!retryable) throw error;
          if (attempt === 0) await delay(300);
        }
      }
    }
    if (!response) throw lastError;

    let content = response.text;
    // Strip markdown formatting if the model incorrectly wraps the JSON
    content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    const parsedData = JSON.parse(content);

    parsedData._model = servedBy;
    parsedData._ms = Date.now() - startedAt;
    parsedData._thinking = noThinking ? 'off' : 'on';
    return res.status(200).json(parsedData);
  } catch (error) {
    console.error('API Error:', error);
    const code = error.status || error.code;
    if (code === 503 || code === 429 || code === 500) {
      // Capacity, not a fault in the product. Say so plainly so a reviewer
      // knows to try again rather than concluding the demo is broken.
      return res.status(503).json({
        error: 'The model is busy right now. Give it a few seconds and try again.',
        retryable: true
      });
    }
    return res.status(502).json({ error: error.message || 'Unknown error occurred' });
  }
}

module.exports = handler;
module.exports.default = handler;
