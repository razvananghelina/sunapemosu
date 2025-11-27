# Santa Call API - Backend (DEPRECATED)

> **IMPORTANT**: Acest backend PHP a fost inlocuit cu Cloudflare Workers.
> Vezi `/cloudflare-workers/` pentru noul backend.
> Acest folder ramane pentru referinta.

## Setup (Legacy)

1. Copy `config/config.example.php` to `config/config.php`
2. Add your API keys:
   - OpenAI API key
   - Eleven Labs API key
   - Voice ID from Eleven Labs

## Configuration

### OpenAI
- Model: gpt-4o-mini (can be changed in config)
- Used for Whisper (speech-to-text) and Chat completions

### Eleven Labs
- Voice ID: Get from your Eleven Labs account
- Voice settings: Adjust stability, similarity_boost, style, and speaker_boost

## API Endpoints

### POST /api/speech-to-text.php
Converts audio to text using OpenAI Whisper

**Request:**
- multipart/form-data with audio file

**Response:**
```json
{
  "text": "transcribed text"
}
```

### POST /api/chat.php
Gets Santa's response using GPT

**Request:**
```json
{
  "message": "user message",
  "history": [
    {"role": "user", "content": "previous message"},
    {"role": "assistant", "content": "previous response"}
  ]
}
```

**Response:**
```json
{
  "message": "Santa's response",
  "usage": {...}
}
```

### POST /api/text-to-speech.php
Converts text to speech using Eleven Labs

**Request:**
```json
{
  "text": "text to convert",
  "voice_id": "optional voice id",
  "voice_settings": {
    "stability": 0.5,
    "similarity_boost": 0.75
  }
}
```

**Response:**
```json
{
  "audio": "base64 encoded mp3",
  "format": "mp3"
}
```

### GET /api/settings.php
Gets current Eleven Labs settings

### POST /api/settings.php
Updates Eleven Labs settings

**Request:**
```json
{
  "voice_id": "new voice id",
  "voice_settings": {
    "stability": 0.5,
    "similarity_boost": 0.75
  }
}
```

## Running the API

You can use PHP's built-in server for development:

```bash
cd backend
php -S localhost:8000
```

Or configure with Apache/Nginx with proper .htaccess support.
