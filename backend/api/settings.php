<?php
require_once __DIR__ . '/cors.php';
handleCors();

$config = require __DIR__ . '/../config/config.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Return current Eleven Labs settings (without API key)
    sendJsonResponse([
        'voice_id' => $config['elevenlabs']['voice_id'],
        'model_id' => $config['elevenlabs']['model_id'],
        'voice_settings' => $config['elevenlabs']['voice_settings']
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    // Update config file with new settings
    $configPath = __DIR__ . '/../config/config.php';
    $currentConfig = require $configPath;

    if (isset($input['voice_id'])) {
        $currentConfig['elevenlabs']['voice_id'] = $input['voice_id'];
    }

    if (isset($input['voice_settings'])) {
        $currentConfig['elevenlabs']['voice_settings'] = array_merge(
            $currentConfig['elevenlabs']['voice_settings'],
            $input['voice_settings']
        );
    }

    // Save updated config
    $configContent = "<?php\nreturn " . var_export($currentConfig, true) . ";\n";
    file_put_contents($configPath, $configContent);

    sendJsonResponse(['success' => true, 'message' => 'Settings updated']);
}

sendError('Method not allowed', 405);
