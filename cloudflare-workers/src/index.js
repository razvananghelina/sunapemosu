/**
 * Cloudflare Worker - Suna pe Mosu API
 * Handles: chat, speech-to-text, text-to-speech
 */

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'https://sunapemosu.ro',
  'https://www.sunapemosu.ro',
];

// Get CORS headers based on request origin
function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

// Helper functions - request is needed for CORS headers
function jsonResponse(data, request, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...getCorsHeaders(request),
    },
  });
}

function errorResponse(message, request, status = 400) {
  return jsonResponse({ error: message }, request, status);
}

// Handle CORS preflight
function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

// ============================================
// CHAT ENDPOINT - OpenAI GPT
// ============================================
async function handleChat(request, env) {
  const input = await request.json();

  if (!input.message) {
    return errorResponse('Message is required', request);
  }

  const userMessage = input.message;
  const conversationHistory = input.history || [];
  const childInfo = input.childInfo || null;
  const conversationSummary = input.conversationSummary || null;
  const agendaStep = input.agendaStep || null;
  const agendaPrompt = input.agendaPrompt || null;
  const childState = input.childState || null;
  const mode = input.mode || 'normal'; // 'normal' sau 'marketing'
  const isMarketingMode = mode === 'marketing';

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

=== INSTRUCTIUNI OBLIGATORII PENTRU ACEST MOMENT ===
${agendaPrompt}
=== SFARSIT INSTRUCTIUNI ===

REGULI STRICTE:
1. TREBUIE sa urmezi instructiunile de mai sus - sunt OBLIGATORII!
2. Daca copilul a zis ceva off-topic sau nelegat de subiect, poti raspunde FOARTE SCURT (maxim 5 cuvinte) si apoi TRECI DIRECT la instructiunile de mai sus.
3. Daca instructiunile spun sa "termini cu..." sau "anunti ca..." - aceasta este OBLIGATORIU, NU optional!
4. Prioritatea ta este sa urmezi instructiunile, NU sa raspunzi la orice a zis copilul.`;
  }

  // System prompt - diferit pentru modul normal vs marketing
  let systemPrompt;

  if (isMarketingMode) {
    // MARKETING MODE - vorbim cu parintii
    systemPrompt = `Ești Moș Crăciun și vorbești cu un PĂRINTE interesat de serviciul "Sună-l pe Moș Crăciun!".
Scopul tău este să îi arăți cum funcționează aplicația și să îl convingi să o folosească pentru copilul/copiii lui.

Fii prietenos, profesional și entuziast! Explică beneficiile serviciului:
- Copiii pot vorbi LIVE cu Moș Crăciun prin video
- Părinții completează informații secrete despre copil (nume, vârstă, hobby-uri, prieteni, animale)
- În timpul apelului, Moșul menționează aceste lucruri ca și cum le-ar ști prin magie
- Copilul rămâne UIMIT și va crede cu adevărat în magia Crăciunului!
- Experiența include clipuri video speciale: Polul Nord, elfii la lucru, lista copiilor cuminți, zbor magic cu sania

${summaryContext}${agendaContext}

FOARTE IMPORTANT - DIACRITICE ROMÂNEȘTI:
- OBLIGATORIU: Scrie TOATE răspunsurile în limba română cu DIACRITICE corecte!
- Caracterele românești: ă, â, î, ș, ț, Ă, Â, Î, Ș, Ț
- NU folosi NICIODATĂ text fără diacritice!

=== FORMAT RĂSPUNS JSON ===
Răspunde DOAR în acest format JSON:
{
  "message": "Textul pe care îl spui părintelui",
  "summary": "Sumar scurt al conversației",
  "readyForNext": true,
  "skipVideo": false,
  "childState": null
}

CÂMPURI:
- message: textul TĂU - OBLIGATORIU CU DIACRITICE!
- summary: sumar scurt
- readyForNext: true când poți trece la următorul subiect, false dacă părintele are întrebări
- skipVideo: true dacă părintele nu vrea să vadă un clip demo
- childState: null (nu colectăm date în marketing mode)

REGULI:
- Vorbești cu un ADULT, nu cu un copil
- Fii profesional dar prietenos
- Folosește Ho Ho Ho ocazional pentru a rămâne în caracter
- Răspunsuri clare și convingătoare
- Subliniază magia și experiența unică pentru copii
- OBLIGATORIU: folosește DIACRITICE ROMÂNEȘTI!`;
  } else {
    // NORMAL MODE - vorbim cu copiii
    systemPrompt = `Ești Moș Crăciun, personajul magic și vesel care aduce cadouri copiilor cuminți. Vorbești cu căldură și bunătate, întotdeauna plin de spirit de Crăciun. Folosește un ton prietenos și magic. Răspunsuri scurte (2-3 propoziții).${childContext}${childStateContext}${summaryContext}${agendaContext}

FOARTE IMPORTANT - DIACRITICE ROMÂNEȘTI:
- OBLIGATORIU: Scrie TOATE răspunsurile în limba română cu DIACRITICE corecte!
- Caracterele românești: ă, â, î, ș, ț, Ă, Â, Î, Ș, Ț
- Exemple CORECTE cu diacritice:
  * "Crăciun" (nu "Craciun")
  * "să" (nu "sa")
  * "știu" (nu "stiu")
  * "țin" (nu "tin")
  * "încântat" (nu "incantat")
  * "așa" (nu "asa")
  * "spuneți" (nu "spuneti")
  * "văd" (nu "vad")
- GREȘIT: "Buna, ma cheama Mos Craciun"
- CORECT: "Bună, mă cheamă Moș Crăciun"
- NU folosi NICIODATĂ text fără diacritice! Verifică fiecare cuvânt!

IMPORTANT - Copiii mici vorbesc imperfect:
- Copiii mici pot pronunța GREȘIT cuvintele sau numele lor!
- Pot spune cuvinte incomplete sau distorsionate (ex: "Azvăn" = Răzvan, "Ciaciun" = Crăciun, "Libiuța" = Liviuța)
- ÎNCEARCĂ MEREU SĂ GHICEȘTI ce au vrut să spună din context și din informațiile secrete pe care le ai!
- Dacă un copil spune un nume ciudat, gândește-te la ce nume românesc seamănă
- NU întrerupe constant cu "ce ai spus?" - încearcă să înțelegi și să continui conversația natural
- Folosește informațiile secrete despre copil pentru a ghici corect (dacă știi că îl cheamă "Răzvan" și copilul spune "Azvăn", e clar Răzvan!)
- Doar dacă CHIAR nu înțelegi deloc și nu poți ghici, întreabă politicos să repete

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
- OBLIGATORIU: folosește DIACRITICE ROMÂNEȘTI (ă, â, î, ș, ț) în FIECARE cuvânt care le necesită!
- Înainte să trimiți răspunsul, verifică dacă ai scris corect: Crăciun, să, știu, mă, tău, etc.`;
  }

  // Build messages array
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  // Call OpenAI GPT-4o-mini (rapid și calitate bună pentru română)
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      messages,
      temperature: 0.6,
      max_tokens: 250,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return errorResponse(`OpenAI API error: ${error}`, request, response.status);
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
        readyForNext: parsedResponse.readyForNext !== false, // default true
        skipVideo: parsedResponse.skipVideo === true, // default false
        childState: validChildState,
        usage: result.usage || null,
      }, request);
    }
  } catch (e) {
    // JSON parse failed
  }

  // Fallback if GPT didn't return valid JSON
  return jsonResponse({
    message: assistantMessage,
    summary: '',
    readyForNext: true,
    skipVideo: false,
    childState: null,
    usage: result.usage || null,
  }, request);
}

// ============================================
// SPEECH-TO-TEXT ENDPOINT - OpenAI Whisper
// ============================================
async function handleSpeechToText(request, env) {
  const formData = await request.formData();
  const audioFile = formData.get('audio');

  if (!audioFile) {
    return errorResponse('No audio file uploaded', request);
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
    return errorResponse(`OpenAI API error: ${error}`, request, response.status);
  }

  const result = await response.json();
  return jsonResponse({ text: result.text || '' }, request);
}

// ============================================
// TEXT-TO-SPEECH ENDPOINT - Eleven Labs
// ============================================
async function handleTextToSpeech(request, env) {
  const input = await request.json();

  if (!input.text) {
    return errorResponse('Text is required', request);
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
    return errorResponse(`Eleven Labs API error: ${error}`, request, response.status);
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
  }, request);
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
      return handleOptions(request);
    }

    // Only allow POST for API endpoints
    if (request.method !== 'POST') {
      return errorResponse('Method not allowed', request, 405);
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
          return errorResponse('Not found', request, 404);
      }
    } catch (error) {
      console.error('Worker error:', error);
      return errorResponse(`Internal error: ${error.message}`, request, 500);
    }
  },
};
