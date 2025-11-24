# Call with Santa - Aplicatie de Apel cu Mos Craciun

O aplicatie interactiva care permite utilizatorilor sa vorbeasca cu Mos Craciun folosind inteligenta artificiala. Aplicatia foloseste OpenAI (Whisper + GPT) pentru conversatie si Eleven Labs pentru voice synthesis.

## Arhitectura

Proiectul este format din doua parti:

1. **Backend (PHP)**: API care comunica cu OpenAI si Eleven Labs
2. **Frontend (React + Vite)**: Interfata utilizator cu voice recording si playback

### Flow-ul Conversatiei

1. Utilizatorul apasa "Suna Mosul"
2. Aplicatia asculta continuu microfonul
3. Cand utilizatorul vorbeste, se inregistreaza audio
4. Dupa 1-1.5 secunde de pauza, inregistrarea se opreste
5. Audio-ul este trimis la OpenAI Whisper pentru transcription (speech-to-text)
6. Textul este trimis la GPT-4o-mini pentru a primi raspunsul lui Mos Craciun
7. Raspunsul este convertit in audio cu Eleven Labs (text-to-speech)
8. Audio-ul este plasat pentru utilizator
9. Dupa terminarea playback-ului, microfonul se activeaza din nou
10. Ciclul continua pana cand utilizatorul inchide apelul

## Setup

### 1. Backend Setup

```bash
cd backend
```

1. Copiaza fisierul de configurare:
```bash
cp config/config.example.php config/config.php
```

2. Editeaza `config/config.php` si adauga cheile tale API:
   - OpenAI API Key (pentru Whisper si GPT)
   - Eleven Labs API Key
   - Voice ID de la Eleven Labs

3. Porneste serverul PHP:
```bash
php -S localhost:8000
```

Alternativ, poti configura cu Apache sau Nginx.

### 2. Frontend Setup

```bash
cd frontend
```

1. Instaleaza dependintele:
```bash
npm install
```

2. (Optional) Configureaza URL-ul API-ului:
```bash
cp .env.example .env
# Editeaza .env daca backend-ul ruleaza pe alt URL
```

3. Porneste aplicatia:
```bash
npm run dev
```

Aplicatia va fi disponibila la `http://localhost:5173`

## API Endpoints

### Backend API (PHP)

- `POST /api/speech-to-text.php` - Transcrie audio in text (Whisper)
- `POST /api/chat.php` - Obtine raspunsul lui Mos Craciun (GPT)
- `POST /api/text-to-speech.php` - Converteste text in audio (Eleven Labs)
- `GET /api/settings.php` - Obtine setarile Eleven Labs
- `POST /api/settings.php` - Actualizeaza setarile Eleven Labs

## Functionalitati

### Voice Recording
- Detectare automata a vocii
- Detectare automata a pauzelor (1.5 secunde)
- Oprire automata a inregistrarii
- Vizualizare status (ascultare, inregistrare, procesare)

### Conversatie AI
- GPT-4o-mini cu system prompt personalizat pentru Mos Craciun
- Istoricul conversatiei este mentinut pe durata apelului
- Raspunsuri scurte si naturale (2-4 propozitii)

### Voice Synthesis
- Eleven Labs pentru voice synthesis de calitate
- Setari personalizabile (stability, similarity boost, style)
- Playback control

### Settings
- Configurare Voice ID
- Ajustare parametri voci:
  - Stability (consistenta vocii)
  - Similarity Boost (similaritate cu vocea originala)
  - Style (exagerare stil)
  - Speaker Boost (claritate)

## Tehnologii Folosite

### Backend
- PHP 7.4+
- cURL pentru API calls
- Multipart form data pentru audio upload

### Frontend
- React 19
- Vite
- React Router DOM
- React Icons
- Web Audio API (pentru voice analysis)
- MediaRecorder API (pentru voice recording)

### APIs Externe
- OpenAI Whisper (speech-to-text)
- OpenAI GPT-4o-mini (conversatie)
- Eleven Labs (text-to-speech)

## Structura Proiect

```
mesaj_de_la_mosul/
├── backend/
│   ├── api/
│   │   ├── cors.php              # CORS handling
│   │   ├── speech-to-text.php    # Whisper endpoint
│   │   ├── chat.php               # GPT endpoint
│   │   ├── text-to-speech.php    # Eleven Labs endpoint
│   │   └── settings.php           # Settings endpoint
│   ├── config/
│   │   ├── config.example.php     # Template configurare
│   │   └── config.php             # Configurare API keys (nu e in git)
│   ├── .htaccess                  # Apache rewrite rules
│   └── README.md
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── SantaCall.jsx      # Componenta apel
    │   │   ├── SantaCall.css
    │   │   ├── Settings.jsx        # Componenta settings
    │   │   └── Settings.css
    │   ├── hooks/
    │   │   ├── useVoiceRecorder.js # Voice recording logic
    │   │   └── useAudioPlayer.js   # Audio playback logic
    │   ├── services/
    │   │   └── api.js              # API client
    │   ├── App.jsx
    │   ├── App.css
    │   ├── main.jsx
    │   └── index.css
    ├── .env.example
    ├── package.json
    └── README.md
```

## Note Importante

1. **API Keys**: Nu uita sa adaugi cheile API in `backend/config/config.php`
2. **CORS**: Backend-ul permite cereri doar de la `localhost:5173` si `localhost:3000`. Modifica in `config.php` daca ai nevoie de alte origini.
3. **Microphone Permission**: Browser-ul va cere permisiune pentru acces la microfon la primul apel.
4. **HTTPS**: Pentru productie, asigura-te ca aplicatia ruleaza pe HTTPS (microfon access este restrictionat pe HTTP in unele browsere).

## Dezvoltare Viitoare

Posibile imbunatatiri:
- Salvare conversatii in baza de date
- Multiple voci pentru Mos Craciun
- Efecte sonore de background (clopoței, etc.)
- Video call cu avatar animat
- Suport pentru multiple limbi
- Rapoarte pentru parinti

## Licenta

Acest proiect este pentru uz personal si educational.
