# Santa Call - Frontend

Aplicatie React pentru a vorbi cu Mos Craciun folosind voice recognition si AI.

## Setup

1. Instaleaza dependintele:
```bash
npm install
```

2. Copiaza `.env.example` in `.env` si configureaza URL-ul API-ului daca e necesar:
```bash
cp .env.example .env
```

3. Porneste aplicatia:
```bash
npm run dev
```

Aplicatia va rula pe `http://localhost:5173`

## Functionalitati

### Apel cu Mos Craciun
- Click pe butonul "Suna Mosul" pentru a incepe conversatia
- Aplicatia asculta continuu microfonul
- Vorbeste si dupa o pauza de 1.5 secunde se opreste inregistrarea
- Mesajul tau este transcris si trimis catre Mos Craciun (GPT)
- Raspunsul lui Mos Craciun este convertit in audio (Eleven Labs) si plasat
- In timpul playback-ului, microfonul nu este activ
- Dupa terminarea audio-ului, microfonul se activeaza din nou

### Settings
- Click pe iconita de settings (rotita) din coltul dreapta-sus
- Configureaza Voice ID de la Eleven Labs
- Ajusteaza setarile vocii:
  - **Stability**: Consistenta vocii
  - **Similarity Boost**: Similariatea cu vocea originala
  - **Style**: Exagerarea stilului
  - **Speaker Boost**: Imbunatateste claritatea

## Tehnologii

- React 19
- Vite
- React Router DOM
- React Icons
- Web Audio API
- MediaRecorder API

## Structura

```
src/
├── components/
│   ├── SantaCall.jsx       # Componenta principala pentru apel
│   ├── SantaCall.css
│   ├── Settings.jsx         # Pagina de settings
│   └── Settings.css
├── hooks/
│   ├── useVoiceRecorder.js  # Hook pentru voice recording
│   └── useAudioPlayer.js    # Hook pentru audio playback
├── services/
│   └── api.js               # Serviciu pentru API calls
├── App.jsx
└── main.jsx
```

## API Integration

Aplicatia comunica cu backend-ul PHP prin urmatoarele endpoints:
- `POST /api/speech-to-text.php` - Whisper transcription
- `POST /api/chat.php` - GPT chat completion
- `POST /api/text-to-speech.php` - Eleven Labs TTS
- `GET/POST /api/settings.php` - Settings management
