# Suna pe Mosu API - Cloudflare Workers

Backend API serverless pentru aplicatia "Suna pe Mosu".

## Endpoint-uri

| Metoda | Path | Descriere |
|--------|------|-----------|
| POST | `/api/chat` | Chat cu OpenAI GPT |
| POST | `/api/speech-to-text` | Transcriere audio cu Whisper |
| POST | `/api/text-to-speech` | Text-to-speech cu Eleven Labs |

## Setup

### 1. Instaleaza dependintele

```bash
npm install
```

### 2. Autentificare Cloudflare

```bash
npx wrangler login
```

### 3. Adauga secretele

```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put ELEVENLABS_API_KEY
```

### 4. Deploy

```bash
npm run deploy
```

## Development local

```bash
npm run dev
```

Worker-ul va rula la `http://localhost:8787`

## Monitorizare logs

```bash
npm run tail
```

## Configurare

Variabilele de mediu sunt in `wrangler.toml`:

```toml
[vars]
ELEVENLABS_MODEL_ID = "eleven_turbo_v2_5"
OPENAI_MODEL = "gpt-4o-mini"
```

Secretele (API keys) se adauga cu `wrangler secret put` si sunt stocate securizat in Cloudflare.

## Costuri

- **Free tier**: 100,000 requests/zi
- **Paid ($5/luna)**: 10 milioane requests/luna

## API Reference

### POST /api/chat

**Request:**
```json
{
  "message": "Buna ziua!",
  "history": [],
  "childInfo": "Informatii despre copil",
  "conversationSummary": "Sumar conversatie anterioara",
  "agendaStep": "cunoastere",
  "agendaPrompt": "Instructiuni pentru acest pas",
  "childState": {
    "childNames": ["Razvan"],
    "childAges": [7]
  }
}
```

**Response:**
```json
{
  "message": "Ho ho ho! Buna ziua!",
  "summary": "Salut initial",
  "childState": null
}
```

### POST /api/speech-to-text

**Request:** multipart/form-data cu fisier audio

**Response:**
```json
{
  "text": "textul transcris"
}
```

### POST /api/text-to-speech

**Request:**
```json
{
  "text": "Textul de convertit in audio",
  "voice_id": "optional",
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
