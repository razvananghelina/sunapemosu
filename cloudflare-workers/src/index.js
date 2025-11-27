/**
 * Cloudflare Worker - Suna pe Mosu API
 * Handles: chat, speech-to-text, text-to-speech
 */

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // In production, restrict this
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// Helper functions
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders,
    },
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

// Handle CORS preflight
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// ============================================
// CHAT ENDPOINT - OpenAI GPT
// ============================================
async function handleChat(request, env) {
  const input = await request.json();

  if (!input.message) {
    return errorResponse('Message is required');
  }

  const userMessage = input.message;
  const conversationHistory = input.history || [];
  const childInfo = input.childInfo || null;
  const conversationSummary = input.conversationSummary || null;
  const agendaStep = input.agendaStep || null;
  const agendaPrompt = input.agendaPrompt || null;
  const childState = input.childState || null;

  // Build child context
  let childContext = '';
  if (childInfo && typeof childInfo === 'string' && childInfo.trim().length > 0) {
    childContext = `

INFORMATII SECRETE despre copil/copii (completate de parinti):
${childInfo}

IMPORTANT - Foloseste aceste informatii pentru a-i SURPRINDE pe copii:
- Daca stii numele, NU intreba cum il cheama - spune-i pe nume: "Aaaa, tu esti [nume]! Te-am recunoscut!"
- Daca stii varsta, NU o mai intreba
- Mentioneaza hobby-uri, prieteni, realizari pentru a-i uimi
- Fa-i sa creada ca stii TOTUL despre ei pentru ca esti Mos Craciun magic!
- Daca sunt MAI MULTI copii si nu ii cunosti pe toti, intreaba doar despre cei necunoscuti`;
  }

  // Build child state context
  let childStateContext = '';
  if (childState && typeof childState === 'object') {
    const parts = [];
    if (childState.childNames?.length) {
      parts.push(`Nume cunoscute: ${childState.childNames.join(', ')}`);
    }
    if (childState.childAges?.length) {
      parts.push(`Varste: ${childState.childAges.join(', ')}`);
    }
    if (childState.childGender) {
      parts.push(`Gen: ${childState.childGender}`);
    }
    if (childState.childCount) {
      parts.push(`Numar copii: ${childState.childCount}`);
    }
    if (parts.length) {
      childStateContext = `

INFORMATII CUNOSCUTE DESPRE COPII (din conversatia anterioara):
${parts.join('\n')}`;
    }
  }

  // Build conversation summary context
  let summaryContext = '';
  if (conversationSummary && typeof conversationSummary === 'string' && conversationSummary.trim().length > 0) {
    summaryContext = `

=== SUMAR CONVERSATIE (ce s-a intamplat pana acum) ===
${conversationSummary}
=== SFARSIT SUMAR ===`;
  }

  // Build agenda step context - doar instructiunile, fara numele pasului
  let agendaContext = '';
  if (agendaPrompt) {
    agendaContext = `

INSTRUCTIUNI PENTRU ACEST MOMENT AL CONVERSATIEI:
${agendaPrompt}

IMPORTANT: Concentreaza-te DOAR pe instructiunile de mai sus. Nu vorbi despre alte subiecte!`;
  }

  // System prompt
  const systemPrompt = `Ești Moș Crăciun, personajul magic și vesel care aduce cadouri copiilor cuminți. Vorbești cu căldură și bunătate, întotdeauna plin de spirit de Crăciun. Folosește un ton prietenos și magic. Răspunsuri scurte (2-3 propoziții).${childContext}${childStateContext}${summaryContext}${agendaContext}

FOARTE IMPORTANT - DIACRITICE:
- TOATE răspunsurile TREBUIE să fie în limba română CU DIACRITICE: ă, â, î, ș, ț
- Exemple corecte: "bucuros" -> "bucuros", "sunt" -> "sunt", "Crăciun" -> "Crăciun", "așa" -> "așa", "încântat" -> "încântat"
- NU folosi NICIODATĂ text fără diacritice!

IMPORTANT - Nu auzi prea bine:
- Dacă nu înțelegi ceva, spune că nu ai auzit bine: "Ce ai spus?", "Poți repeta?", "Scuză-mă, nu te-am auzit bine"
- Fii prietenos și amuzant cu faptul că nu auzi prea bine

=== FORMAT RĂSPUNS JSON ===
Răspunde DOAR în acest format JSON (nimic altceva!):
{
  "message": "Textul pe care îl spui copilului",
  "summary": "Sumar scurt al conversației",
  "readyForNext": true,
  "skipVideo": false,
  "childState": null
}

CÂMPURI:
- message: textul TĂU (ce spui copilului) - OBLIGATORIU CU DIACRITICE!
- summary: sumar scurt al conversației
- readyForNext: true dacă conversația pe acest subiect e completă și putem trece mai departe. false dacă copilul vrea să mai vorbească sau nu a răspuns clar.
- skipVideo: true DOAR dacă copilul a refuzat clar ceva (ex: "nu vreau să văd", "nu îmi place"). Default: false
- childState: OPȚIONAL - doar dacă ai aflat informații NOI:
  * childGender: "băiat", "fată", sau "mixed"
  * childCount: numărul de copii
  * childNames: array cu numele (ex: ["Răzvan"])
  * childAges: array cu vârstele (ex: [7])

EXEMPLE (observă diacriticele!):

1. Copilul răspunde clar, putem trece mai departe:
{"message": "Răzvan! Ce bucuros sunt să te văd! Ho ho ho!", "summary": "Am aflat că e Răzvan.", "readyForNext": true, "skipVideo": false, "childState": {"childNames": ["Răzvan"]}}

2. Copilul vrea să mai vorbească, NU trecem mai departe:
{"message": "Povestește-mi mai mult! Sunt foarte curios!", "summary": "Copilul vorbește despre hobby.", "readyForNext": false, "skipVideo": false, "childState": null}

3. Copilul REFUZĂ ceva (ex: zborul), nu arătăm video:
{"message": "Nicio problemă! Renii mei sunt drăguți, dar înțeleg.", "summary": "Copilul nu vrea să vadă zborul.", "readyForNext": true, "skipVideo": true, "childState": null}

REGULI:
- Răspunde NATURAL, ca și cum ai vorbi cu un copil
- Folosește Ho Ho Ho din când în când
- Fii cald, drăgăstos și plin de magie
- Urmează STRICT instrucțiunile date pentru acest moment
- Răspunsuri SCURTE (2-3 propoziții maxim)
- OBLIGATORIU: folosește DIACRITICE în TOATE răspunsurile!`;

  // Build messages array
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  // Call Groq (extrem de rapid)
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL || 'llama-3.1-8b-instant',
      messages,
      temperature: 0.6,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return errorResponse(`Groq API error: ${error}`, response.status);
  }

  const result = await response.json();
  const assistantMessage = result.choices?.[0]?.message?.content || '';

  // Parse JSON response from GPT
  try {
    const parsedResponse = JSON.parse(assistantMessage);

    if (parsedResponse.message) {
      let validChildState = null;

      if (parsedResponse.childState && typeof parsedResponse.childState === 'object') {
        validChildState = {
          childGender: parsedResponse.childState.childGender || null,
          childCount: parsedResponse.childState.childCount || null,
          childNames: parsedResponse.childState.childNames || [],
          childAges: parsedResponse.childState.childAges || [],
        };

        // Filter empty values
        if (!validChildState.childGender &&
            !validChildState.childCount &&
            !validChildState.childNames?.length &&
            !validChildState.childAges?.length) {
          validChildState = null;
        }
      }

      return jsonResponse({
        message: parsedResponse.message,
        summary: parsedResponse.summary || '',
        childState: validChildState,
        usage: result.usage || null,
      });
    }
  } catch (e) {
    // JSON parse failed
  }

  // Fallback if GPT didn't return valid JSON
  return jsonResponse({
    message: assistantMessage,
    summary: '',
    childState: null,
    usage: result.usage || null,
  });
}

// ============================================
// SPEECH-TO-TEXT ENDPOINT - OpenAI Whisper
// ============================================
async function handleSpeechToText(request, env) {
  const formData = await request.formData();
  const audioFile = formData.get('audio');

  if (!audioFile) {
    return errorResponse('No audio file uploaded');
  }

  // Prepare form data for OpenAI
  const openaiFormData = new FormData();
  openaiFormData.append('file', audioFile);
  openaiFormData.append('model', 'whisper-1');
  openaiFormData.append('language', 'ro');
  openaiFormData.append('prompt', 'Aceasta este o conversație în limba română între un copil și Moș Crăciun. Copilul spune nume românești precum Ana, Maria, Livia, Liviuța, Andrei, Mihai, Ioana, Răzvan. Vorbește despre cadouri, sărbători, și ce își dorește de Crăciun.');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: openaiFormData,
  });

  if (!response.ok) {
    const error = await response.text();
    return errorResponse(`OpenAI API error: ${error}`, response.status);
  }

  const result = await response.json();
  return jsonResponse({ text: result.text || '' });
}

// ============================================
// TEXT-TO-SPEECH ENDPOINT - Eleven Labs
// ============================================
async function handleTextToSpeech(request, env) {
  const input = await request.json();

  if (!input.text) {
    return errorResponse('Text is required');
  }

  const text = input.text;
  const voiceId = input.voice_id || env.ELEVENLABS_VOICE_ID || 'PPzYpIqttlTYA83688JI';
  const voiceSettings = input.voice_settings || {
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.0,
    use_speaker_boost: true,
  };

  // Extract speed if present
  let speed = null;
  if (voiceSettings.speed) {
    speed = voiceSettings.speed;
    delete voiceSettings.speed;
  }

  const data = {
    text,
    model_id: env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5',
    voice_settings: voiceSettings,
  };

  if (speed !== null) {
    data.speed = speed;
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    return errorResponse(`Eleven Labs API error: ${error}`, response.status);
  }

  // Convert audio to base64 (chunked to avoid stack overflow)
  const audioBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(audioBuffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  const audioBase64 = btoa(binary);

  return jsonResponse({
    audio: audioBase64,
    format: 'mp3',
  });
}

// ============================================
// MAIN ROUTER
// ============================================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    // Only allow POST for API endpoints
    if (request.method !== 'POST') {
      return errorResponse('Method not allowed', 405);
    }

    // Route requests
    try {
      switch (path) {
        case '/api/chat':
        case '/api/chat.php':
          return await handleChat(request, env);

        case '/api/speech-to-text':
        case '/api/speech-to-text.php':
          return await handleSpeechToText(request, env);

        case '/api/text-to-speech':
        case '/api/text-to-speech.php':
          return await handleTextToSpeech(request, env);

        default:
          return errorResponse('Not found', 404);
      }
    } catch (error) {
      console.error('Worker error:', error);
      return errorResponse(`Internal error: ${error.message}`, 500);
    }
  },
};
