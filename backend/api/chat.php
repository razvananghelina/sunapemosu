<?php
require_once __DIR__ . '/cors.php';
handleCors();

$config = require __DIR__ . '/../config/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Method not allowed', 405);
}

$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['message'])) {
    sendError('Message is required');
}

$userMessage = $input['message'];
$conversationHistory = $input['history'] ?? [];
$childInfo = $input['childInfo'] ?? null;
$conversationSummary = $input['conversationSummary'] ?? null;
$agendaStep = $input['agendaStep'] ?? null; // Pasul curent din agenda (id)
$agendaPrompt = $input['agendaPrompt'] ?? null; // Prompt-ul specific pentru pasul curent
$childState = $input['childState'] ?? null; // Starea copilului (gender, count, names, ages)

// Build child context - childInfo e un string simplu cu toate informatiile de la parinti
$childContext = '';
if ($childInfo && is_string($childInfo) && strlen(trim($childInfo)) > 0) {
    $childContext = "\n\nINFORMATII SECRETE despre copil/copii (completate de parinti):
{$childInfo}

IMPORTANT - Foloseste aceste informatii pentru a-i SURPRINDE pe copii:
- Daca stii numele, NU intreba cum il cheama - spune-i pe nume: \"Aaaa, tu esti [nume]! Te-am recunoscut!\"
- Daca stii varsta, NU o mai intreba
- Mentioneaza hobby-uri, prieteni, realizari pentru a-i uimi
- Fa-i sa creada ca stii TOTUL despre ei pentru ca esti Mos Craciun magic!
- Daca sunt MAI MULTI copii si nu ii cunosti pe toti, intreaba doar despre cei necunoscuti";
}

// Build child state context
$childStateContext = '';
if ($childState && is_array($childState)) {
    $parts = [];
    if (!empty($childState['childNames'])) {
        $parts[] = "Nume cunoscute: " . implode(", ", $childState['childNames']);
    }
    if (!empty($childState['childAges'])) {
        $parts[] = "Varste: " . implode(", ", $childState['childAges']);
    }
    if (!empty($childState['childGender'])) {
        $parts[] = "Gen: " . $childState['childGender'];
    }
    if (!empty($childState['childCount'])) {
        $parts[] = "Numar copii: " . $childState['childCount'];
    }
    if (!empty($parts)) {
        $childStateContext = "\n\nINFORMATII CUNOSCUTE DESPRE COPII (din conversatia anterioara):\n" . implode("\n", $parts);
    }
}

// Build conversation summary context
$summaryContext = '';
if ($conversationSummary && is_string($conversationSummary) && strlen(trim($conversationSummary)) > 0) {
    $summaryContext = "\n\n=== SUMAR CONVERSATIE (ce s-a intamplat pana acum) ===
{$conversationSummary}
=== SFARSIT SUMAR ===";
}

// Build agenda step context
$agendaContext = '';
if ($agendaStep) {
    $agendaContext = "\n\nPAS CURENT IN AGENDA: {$agendaStep}";
}
if ($agendaPrompt) {
    $agendaContext .= "\n\nINSTRUCTIUNI PENTRU ACEST PAS:\n{$agendaPrompt}";
}

// System prompt for Santa Claus - simplificat, fara agenda
$systemPrompt = "Esti Mos Craciun, personajul magic si vesel care aduce cadouri copiilor cuminti. Vorbesti cu caldura si bunatate, intotdeauna plin de spirit de Craciun. Raspunde in limba romana, folosind un ton prietenos si magic. Pastreaza raspunsurile relativ scurte (2-4 propozitii) pentru a simula o conversatie naturala.{$childContext}{$childStateContext}{$summaryContext}{$agendaContext}

IMPORTANT - Nu auzi prea bine:
- Daca nu intelegi ceva, spune ca nu ai auzit bine: \"Ce ai spus?\", \"Poti repeta?\", \"Scuze, nu te-am auzit bine\"
- Fii prietenos si amuzant cu faptul ca nu auzi prea bine

=== FORMAT RASPUNS JSON ===
Raspunde DOAR in acest format JSON (nimic altceva!):
{
  \"message\": \"Textul pe care il spui copilului\",
  \"summary\": \"Sumar scurt al conversatiei (include ce ai aflat)\",
  \"childState\": {
    \"childGender\": null,
    \"childCount\": null,
    \"childNames\": [],
    \"childAges\": []
  }
}

CAMPURI:
- message: textul TAU (ce spui copilului, fara marcaje)
- summary: OBLIGATORIU! Sumar actualizat al conversatiei. Include:
  * Ce ai aflat despre copii (nume, varsta, ce le place)
  * Ce dorinte au spus
  * Reactiile lor importante
- childState: OPTIONAL - completeaza DOAR daca ai aflat informatii NOI despre copii:
  * childGender: \"baiat\", \"fata\", sau \"mixed\" daca sunt mai multi de genuri diferite
  * childCount: numarul de copii prezenti (1, 2, 3, etc)
  * childNames: array cu numele copiilor (ex: [\"Razvan\", \"Livia\"])
  * childAges: array cu varstele (ex: [7, 8])
  * Daca nu ai informatii noi, lasa null sau []

EXEMPLE:

1. Prima interactiune (cunoastere):
{\"message\": \"Buna ziua! Cu cine vorbesc? Esti Razvan?\", \"summary\": \"Salutare initiala, astept sa confirm cine vorbeste.\", \"childState\": null}

2. Dupa ce aflii numele si varsta:
{\"message\": \"Razvan! Ce bucuros sunt sa te vad! Si ai 7 ani? Ce mare ai crescut!\", \"summary\": \"Am confirmat ca e Razvan, 7 ani. Un baiat.\", \"childState\": {\"childGender\": \"baiat\", \"childCount\": 1, \"childNames\": [\"Razvan\"], \"childAges\": [7]}}

3. Daca sunt mai multi copii:
{\"message\": \"Waaau, esti cu Livia! Ce surpriza frumoasa!\", \"summary\": \"Sunt doi copii: Razvan (baiat) si Livia (fata).\", \"childState\": {\"childGender\": \"mixed\", \"childCount\": 2, \"childNames\": [\"Razvan\", \"Livia\"], \"childAges\": [7, 8]}}

4. Conversatie normala (fara informatii noi despre copii):
{\"message\": \"Ho ho ho! Elfii mei lucreaza din greu la cadouri!\", \"summary\": \"Am povestit despre elfi si Polul Nord.\", \"childState\": null}

IMPORTANT:
- Raspunde NATURAL, ca si cum ai vorbi cu un copil
- Foloseste Ho Ho Ho din cand in cand
- Fii cald, dragastos si plin de magie
- Urmeaza instructiunile pentru pasul curent din agenda";

// Build messages array
$messages = [
    ['role' => 'system', 'content' => $systemPrompt]
];

// Add conversation history
foreach ($conversationHistory as $msg) {
    $messages[] = $msg;
}

// Add current user message
$messages[] = ['role' => 'user', 'content' => $userMessage];

// Prepare request to OpenAI
$data = [
    'model' => $config['openai']['model'],
    'messages' => $messages,
    'temperature' => 0.7,
    'max_tokens' => 300,
    'response_format' => ['type' => 'json_object']
];

$ch = curl_init();

curl_setopt_array($ch, [
    CURLOPT_URL => 'https://api.openai.com/v1/chat/completions',
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($data),
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $config['openai']['api_key'],
        'Content-Type: application/json'
    ],
    CURLOPT_TIMEOUT => 30,
    CURLOPT_CONNECTTIMEOUT => 10
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    sendError('Curl error: ' . curl_error($ch), 500);
}

curl_close($ch);

if ($httpCode !== 200) {
    sendError('OpenAI API error: ' . $response, $httpCode);
}

$result = json_decode($response, true);
$assistantMessage = $result['choices'][0]['message']['content'] ?? '';

// Parse JSON response from GPT
$parsedResponse = json_decode($assistantMessage, true);

if (json_last_error() === JSON_ERROR_NONE && isset($parsedResponse['message'])) {
    $message = $parsedResponse['message'];
    $summary = $parsedResponse['summary'] ?? '';
    $newChildState = $parsedResponse['childState'] ?? null;

    // Validam childState daca exista
    if ($newChildState && is_array($newChildState)) {
        // Ne asiguram ca are structura corecta
        $validChildState = [
            'childGender' => $newChildState['childGender'] ?? null,
            'childCount' => $newChildState['childCount'] ?? null,
            'childNames' => $newChildState['childNames'] ?? [],
            'childAges' => $newChildState['childAges'] ?? [],
        ];
        // Filtram valorile goale
        if (empty($validChildState['childGender']) &&
            empty($validChildState['childCount']) &&
            empty($validChildState['childNames']) &&
            empty($validChildState['childAges'])) {
            $validChildState = null;
        }
    } else {
        $validChildState = null;
    }

    sendJsonResponse([
        'message' => $message,
        'summary' => $summary,
        'childState' => $validChildState,
        'usage' => $result['usage'] ?? null
    ]);
} else {
    // Fallback if GPT didn't return valid JSON
    sendJsonResponse([
        'message' => $assistantMessage,
        'summary' => '',
        'childState' => null,
        'usage' => $result['usage'] ?? null
    ]);
}
