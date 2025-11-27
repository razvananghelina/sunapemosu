# Call with Santa - Aplicatie de Apel Video cu Mos Craciun

O aplicatie interactiva care permite copiilor sa vorbeasca cu Mos Craciun folosind inteligenta artificiala. Aplicatia foloseste OpenAI (Whisper + GPT) pentru conversatie si Eleven Labs pentru voice synthesis, cu video-uri pre-renderizate ale lui Mos Craciun.

## Arhitectura

Proiectul este format din doua parti:

1. **Backend (Cloudflare Workers - JavaScript)**: API serverless care comunica cu OpenAI si Eleven Labs
2. **Frontend (React + Vite)**: Interfata utilizator cu video player, voice recording si playback

> **Note**: Backend-ul a fost migrat de la PHP la Cloudflare Workers pentru scalabilitate si cost redus. Codul PHP vechi ramane in folderul `backend/` ca referinta.

### Flow-ul Conversatiei

1. Utilizatorul apasa butonul de apel
2. Se afiseaza ecranul de apelare cu sunet de telefon
3. Mos Craciun raspunde cu un video de intro
4. Aplicatia asculta continuu microfonul
5. Cand utilizatorul vorbeste, se inregistreaza audio
6. Dupa 1 secunda de pauza, inregistrarea se opreste
7. Audio-ul este trimis la OpenAI Whisper pentru transcription (speech-to-text)
8. Textul este trimis la GPT pentru a primi raspunsul lui Mos Craciun (format JSON cu state, message, videos)
9. Raspunsul este convertit in audio cu Eleven Labs (text-to-speech)
10. Se afiseaza video-ul corespunzator starii (speaking, laughing, amazed, etc.)
11. Audio-ul este placat peste video
12. Daca GPT a cerut un video special (elfs_working, kids_list, flight), acesta se reda dupa vorbire
13. Dupa terminare, microfonul se activeaza din nou
14. La refresh, conversatia poate fi reluata din localStorage (max 1 ora)

## Functionalitati

### Video Player
- Video-uri pre-renderizate pentru diferite stari ale lui Mos Craciun
- Sincronizare audio TTS peste video
- Video-uri speciale cu sunet propriu (elfii, lista, zborul)
- Efect de glitch in timpul procesarii (dupa 4 secunde)

### Video-uri Disponibile
- `intro.mp4` - Introducerea lui Mos Craciun
- `listening.mp4` - Mos Craciun asculta (loop)
- `speaks.mp4` - Mos Craciun vorbeste (loop)
- `laughing.mp4` - Mos Craciun rade
- `amazed.mp4` - Mos Craciun uimit/surprins
- `elfs_working.mp4` - Video cu elfii lucrand la cadouri
- `kids_list.mp4` - Video cu cautarea pe lista copiilor cuminti
- `flight.mp4` - Zbor magic cu sania si renii
- `glitch.mp4` - Efect de glitch pentru asteptare

### Agenda Conversatiei (configurata in chat.php)
1. **Cunoastere** - Confirma cu cine vorbeste, afla toti copiii prezenti
2. **Secrete si Surprize** - Mentioneaza hobby-uri, prieteni (din CHILD_INFO)
3. **Polul Nord** - Povesteste despre elfi + video `elfs_working`
4. **Suspans** - Intreaba daca vor sa afle daca sunt pe lista
5. **Verificare Lista** - Video `kids_list` pentru fiecare copil
6. **Zbor Magic** - Intreaba daca vrea sa zboare + video `flight`
7. **Dorinte** - Afla ce isi doresc de Craciun
8. **Incheiere** - Urari de sarbatori

### Mecanisme de Protectie
- **API Retry**: 3 incercari cu exponential backoff (1s, 2s, 4s)
- **Stuck Detection**: Timeout 25s cu maxim 2 retry-uri automate
- **Session Recovery**: Salvare automata in localStorage, reluare la refresh
- **iOS Audio Blessing**: Ambience ruleaza silent pentru a pastra permisiunea

### Voice Recording
- Detectare automata a vocii (volume threshold)
- Detectare automata a pauzelor (1 secunda)
- Oprire automata a inregistrarii
- Vizualizare status (Te ascult, Vorbesti..., Se proceseaza...)

### Conversatie AI
- GPT-4o-mini cu system prompt personalizat pentru Mos Craciun
- Format raspuns JSON cu state, message, videos, summary
- Istoricul conversatiei limitat la ultimele 20 mesaje
- Sumar conversatie pentru context intre requesturi
- Informatii despre copil (CHILD_INFO) pentru personalizare

### Voice Synthesis
- Eleven Labs pentru voice synthesis de calitate
- Playback sincronizat cu video

### iOS/Mobile Support
- Audio unlock la prima interactiune
- Permisiune microfon ceruta devreme
- Video playback unlock
- Ambience audio persistent (volum 0 cand nu e nevoie)

## Setup

### 1. Backend Setup (Cloudflare Workers)

```bash
cd cloudflare-workers
npm install
```

1. Autentificare Cloudflare:
```bash
npx wrangler login
```

2. Adauga secretele (API keys):
```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put ELEVENLABS_API_KEY
```

3. Deploy:
```bash
npm run deploy
```

4. Noteaza URL-ul generat (ex: `https://sunapemosu-api.xxx.workers.dev`)

5. Pentru development local:
```bash
npm run dev
```

### 2. Frontend Setup

```bash
cd frontend
```

1. Instaleaza dependintele:
```bash
npm install
```

2. Adauga video-urile in `frontend/public/videos/`:
   - intro.mp4, listening.mp4, speaks.mp4, laughing.mp4, amazed.mp4
   - elfs_working.mp4, kids_list.mp4, flight.mp4, glitch.mp4

3. Adauga audio-urile in `frontend/public/audio/`:
   - ambience.mp3 (sunet de fundal)
   - suna.mp3 (sunet de apel)

4. Configureaza informatiile despre copil in `SantaCall.jsx`:
```javascript
const CHILD_INFO = "Numele, varsta, hobby-uri, prieteni, etc.";
```

5. Porneste aplicatia:
```bash
npm run dev
```

Aplicatia va fi disponibila la `http://localhost:5173`

## API Endpoints

### Backend API (Cloudflare Workers)

- `POST /api/speech-to-text` - Transcrie audio in text (Whisper)
- `POST /api/chat` - Obtine raspunsul lui Mos Craciun (GPT)
  - Input: message, history, childInfo, conversationSummary, agendaStep, agendaPrompt, childState
  - Output: message, summary, childState
- `POST /api/text-to-speech` - Converteste text in audio (Eleven Labs)

## Structura Proiect

```
sunapemosu/
├── cloudflare-workers/           # Backend API (productie)
│   ├── src/
│   │   └── index.js              # Worker principal cu toate endpoint-urile
│   ├── wrangler.toml             # Configurare Cloudflare
│   └── package.json
├── backend/                      # Backend PHP (deprecated, pentru referinta)
│   ├── api/
│   │   ├── cors.php              # CORS handling
│   │   ├── speech-to-text.php    # Whisper endpoint
│   │   ├── chat.php              # GPT endpoint
│   │   └── text-to-speech.php    # Eleven Labs endpoint
│   └── config/
│       ├── config.example.php    # Template configurare
│       └── config.php            # Configurare API keys (nu e in git)
└── frontend/
    ├── public/
    │   ├── videos/               # Video-uri Mos Craciun
    │   └── audio/                # Audio ambience si ringtone
    ├── src/
    │   ├── components/
    │   │   ├── SantaCall.jsx     # Componenta principala
    │   │   ├── SantaCall.css
    │   │   └── VideoPlayer.jsx   # Player video
    │   ├── hooks/
    │   │   ├── useVoiceRecorder.js # Voice recording logic
    │   │   └── useAudioPlayer.js   # Audio playback logic
    │   ├── services/
    │   │   └── api.js            # API client
    │   ├── utils/
    │   │   └── audioManager.js   # iOS audio management
    │   ├── constants/
    │   │   ├── santaStates.js    # Stari Santa
    │   │   └── videoConfig.js    # Configurare video-uri
    │   └── assets/
    │       └── mosul.png         # Avatar Mos Craciun
    └── package.json
```

## Tehnologii Folosite

### Backend (Cloudflare Workers)
- JavaScript (ES Modules)
- Cloudflare Workers runtime
- Fetch API pentru API calls
- JSON response format

### Frontend
- React 19
- Vite
- React Icons
- Web Audio API (pentru voice analysis)
- MediaRecorder API (pentru voice recording)
- LocalStorage (pentru session recovery)

### APIs Externe
- OpenAI Whisper (speech-to-text)
- OpenAI GPT-4o-mini (conversatie)
- Eleven Labs (text-to-speech)

## Note Importante

1. **API Keys**: Adauga cheile API ca secrete Cloudflare cu `wrangler secret put`
2. **Video-uri**: Toate video-urile trebuie sa fie in format MP4, aspect ratio 464:688
3. **iOS**: Prima interactiune trebuie sa fie un click pentru a debloca audio
4. **HTTPS**: Cloudflare Workers ofera HTTPS automat
5. **CHILD_INFO**: Personalizeaza informatiile despre copil pentru o experienta magica
6. **Costuri Cloudflare**: Free tier include 100,000 requests/zi

## Licenta

Acest proiect este pentru uz personal si educational.
