<?php
// Example configuration file
// Copy this to config.php and add your actual API keys

return [
    'openai' => [
        'api_key' => 'your-openai-api-key-here',
        'model' => 'gpt-4o-mini',
    ],
    'elevenlabs' => [
        'api_key' => 'your-elevenlabs-api-key-here',
        'voice_id' => 'default-voice-id',
        'model_id' => 'eleven_monolingual_v1',
        'voice_settings' => [
            'stability' => 0.5,
            'similarity_boost' => 0.75,
            'style' => 0.0,
            'use_speaker_boost' => true
        ]
    ],
    'cors' => [
        'allowed_origins' => [
            'http://localhost:5173',
            'http://localhost:3000',
            'https://webdesignmedia.ro',
            'http://webdesignmedia.ro'
        ]
    ]
];
