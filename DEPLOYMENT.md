# Deployment Instructions

## Backend Deployment

### 1. Copiaza pe server
Copiaza urmatoarele foldere pe serverul tau la `https://webdesignmedia.ro/sunapemosu/`:

```
backend/
├── api/          # Tot folderul cu toate endpoint-urile
├── config/       # Tot folderul
└── .htaccess     # Fisierul pentru Apache rewrite
```

### 2. Configureaza API Keys
Pe server, editeaza `config/config.php` (daca nu exista, copiaza din `config.example.php`):

```php
<?php
return [
    'openai' => [
        'api_key' => 'your-openai-api-key',
        'model' => 'gpt-4o-mini',
    ],
    'elevenlabs' => [
        'api_key' => 'your-elevenlabs-api-key',
        'voice_id' => 'your-voice-id',
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
```

### 3. Verifica Permissions
Asigura-te ca folderul `config/` are permisiuni corecte pentru ca PHP sa poata scrie in `config.php` (pentru settings).

```bash
chmod 755 config/
chmod 644 config/config.php
```

### 4. Testeaza API
Testeaza ca API-ul functioneaza:
```
https://webdesignmedia.ro/sunapemosu/api/settings.php
```

## Frontend Deployment

### 1. Build pentru productie
```bash
cd frontend
npm run build
```

### 2. Structura dupa build
Folderul `frontend/dist/` va contine:
```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── ...
└── vite.svg
```

### 3. Deploy
Copiaza tot continutul din `frontend/dist/` pe server unde vrei sa fie aplicatia (ex: root sau subfolder).

### 4. Verifica .env
Inainte de build, asigura-te ca `.env` are URL-ul corect:
```
VITE_API_URL=https://webdesignmedia.ro/sunapemosu/api
```

## Verificari Post-Deployment

1. **CORS**: Verifica ca API-ul permite cereri de la domeniul frontend-ului
2. **HTTPS**: Asigura-te ca aplicatia ruleaza pe HTTPS (pentru microfon access)
3. **API Keys**: Verifica ca toate API keys-urile sunt corecte
4. **Voice ID**: Configureaza Voice ID din pagina de Settings
5. **Microphone Permission**: Testeaza ca browser-ul cere permisiune pentru microfon

## Note Importante

- **Nu uita sa adaugi `backend/config/config.php` in `.gitignore`** daca folosesti git
- **HTTPS este obligatoriu** pentru production (browser-ul nu permite microfon access pe HTTP)
- **File uploads**: Verifica ca serverul permite upload de fisiere audio (pentru Whisper)
- **PHP Extensions**: Asigura-te ca serverul are `curl` enabled

## Troubleshooting

### CORS Errors
Daca primesti erori CORS, verifica:
- `allowed_origins` in `config/config.php` contine domeniul frontend-ului
- Apache are modulul `mod_headers` enabled

### File Upload Errors
Verifica in `php.ini`:
```
upload_max_filesize = 25M
post_max_size = 25M
```

### API Not Found
Verifica ca `.htaccess` este copiat si ca Apache are `mod_rewrite` enabled.
