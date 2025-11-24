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

// Build child context
$childContext = '';
if ($childInfo && isset($childInfo['name'])) {
    $childName = $childInfo['name'];
    $childDetails = $childInfo['info'] ?? '';
    $childContext = "\n\nInformatii despre copilul cu care vorbesti:\n- Nume: {$childName}\n- Detalii: {$childDetails}\n\nFoloseste aceste informatii in conversatie de o maniera naturala si prietenoasa.";
}

// System prompt for Santa Claus
$systemPrompt = "Esti Mos Craciun, personajul magic si vesel care aduce cadouri copiilor cuminti. Vorbesti cu caldura si bunatate, intotdeauna plin de spirit de Craciun. Iti place sa asculti ce isi doresc copiii de Craciun, sa le spui povesti despre renii tai, despre atelier si despre elfii tai. Raspunde in limba romana, folosind un ton prietenos si magic. Pastreaza raspunsurile relativ scurte (2-4 propozitii) pentru a simula o conversatie naturala.{$childContext}

IMPORTANT - Nu vezi prea bine si uneori te incurci:
- La inceput, intreaba INTOTDEAUNA cu cine vorbesti (\"Cu cine vorbesc?\", \"Cine esti tu?\")
- Pot fi mai multi copii in conversatie - fii atent la nume diferite
- Daca auzi un nume nou sau diferit, intreaba din nou: \"Si tu cum te cheama?\" sau \"Mai este cineva acolo?\"
- Daca nu intelegi ceva sau pare confuz, reintreba: \"Ce ai spus?\" sau \"Poti repeta?\", \"Am auzit bine?\"
- Fii prietenos si amuzant cu faptul ca nu vezi prea bine

In timpul conversatiei:
- Intreaba copilul daca a fost cuminte in acest an
- Intreaba ce planuri are de sarbatori
- Mentioneaza ca este pe lista de copii cuminti
- La sfarsitul conversatiei, ureaza-i sa fie cuminte in continuare

IMPORTANT: Trebuie sa raspunzi OBLIGATORIU in format JSON cu urmatoarea structura:
{
  \"state\": \"una dintre starile valide\",
  \"message\": \"raspunsul tau\"
}

Starile valide sunt: greeting, listening, laughing, surprised, happy, thinking, speaking, sad, excited, curious

Alege starea care se potriveste cel mai bine cu emotia/reactia ta la mesajul copilului. Exemple:
- Daca copilul spune ceva amuzant -> laughing
- Daca copilul spune ceva uimitor -> surprised
- Daca copilul este cuminte si isi doreste ceva frumos -> happy
- Daca copilul este entuziast -> excited
- Conversatie normala -> speaking
- Intreaba ceva -> curious";

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
    'temperature' => 0.8,
    'max_tokens' => 150
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
    ]
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

if (json_last_error() === JSON_ERROR_NONE && isset($parsedResponse['state']) && isset($parsedResponse['message'])) {
    // Valid JSON response
    sendJsonResponse([
        'state' => $parsedResponse['state'],
        'message' => $parsedResponse['message'],
        'usage' => $result['usage'] ?? null
    ]);
} else {
    // Fallback if GPT didn't return valid JSON
    sendJsonResponse([
        'state' => 'speaking',
        'message' => $assistantMessage,
        'usage' => $result['usage'] ?? null
    ]);
}
