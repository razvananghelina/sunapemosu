# Arhitectura - Suna pe Mosu

## Fisiere Principale

### Frontend

| Fisier | Rol |
|--------|-----|
| `frontend/src/components/SantaCall.jsx` | Componenta principala - orchestreaza tot flow-ul |
| `frontend/src/components/VideoPlayer.jsx` | Player video cu preload si event handling |
| `frontend/src/hooks/useAgenda.js` | Hook pentru gestionarea agendei conversatiei |
| `frontend/src/hooks/useVoiceRecorder.js` | Hook pentru inregistrare audio cu detectare voce/tacere |
| `frontend/src/hooks/useAudioPlayer.js` | Hook pentru playback audio TTS |
| `frontend/src/utils/audioManager.js` | Manager audio iOS/mobile (unlock, ambience, ringtone) |
| `frontend/src/constants/santaAgenda.js` | Definitia agendei conversatiei (pasi, prompts, video-uri) |
| `frontend/src/constants/santaStates.js` | Starile Santa (IDLE, CALLING, SPEAKING, etc.) |
| `frontend/src/constants/videoConfig.js` | Configurare video-uri (src, loop, description) |
| `frontend/src/services/api.js` | Client API pentru backend |

### Backend

| Fisier | Rol |
|--------|-----|
| `backend/api/chat.php` | Endpoint GPT - primeste mesaj, returneaza raspuns + childState |
| `backend/api/speech-to-text.php` | Endpoint Whisper - audio -> text |
| `backend/api/text-to-speech.php` | Endpoint Eleven Labs - text -> audio |

---

## Flow Principal

```
1. User apasa buton apel
   -> startCall() [SantaCall.jsx:663]
   -> unlockMediaPlayback() - deblocheaza audio iOS
   -> ringtone 2s
   -> video 'intro' porneste

2. Intro se termina
   -> handleVideoEnd('intro') [SantaCall.jsx:807]
   -> agenda.goToNextStep() -> pas 'cunoastere'
   -> microfonul porneste (startListening)
   -> video 'listening' loop

3. User vorbeste
   -> useVoiceRecorder detecteaza voce (volumeThreshold)
   -> incepe inregistrarea
   -> detecteaza tacere (silenceThreshold 700ms)
   -> stopRecording() -> onRecordingComplete(blob)

4. Procesare conversatie
   -> handleRecordingComplete() [SantaCall.jsx:427]
   -> speechToText API -> text
   -> processConversation() [SantaCall.jsx:192]

5. In processConversation:
   -> Obtine pas curent: agenda.getCurrentStep()

   5a. Daca pas are audio predefinit (fara prompt):
       -> playPredefinedAudio()
       -> video speaking_state
       -> dupa audio: video special (daca exista) sau listening

   5b. Daca pas are prompt (GPT):
       -> chat API cu: message, history, childInfo, summary, agendaStep, agendaPrompt, childState
       -> primeste: message, summary, childState (optional)
       -> textToSpeech API -> audio
       -> video speaking_state + audio TTS
       -> dupa audio: video special (daca exista) sau listening

6. Video special (elfs_working, kids_list, flight)
   -> playNextSpecialVideo() [SantaCall.jsx:593]
   -> setCurrentVideo (ambience NU se opreste - ramane activ)
   -> la sfarsit: handleVideoEnd -> playNextSpecialVideo sau goBackToListening

7. Dupa TTS/video special
   -> handlePlaybackEnd() [SantaCall.jsx:576]
   -> agenda.goToNextStep() (daca shouldListenOnComplete != false)
   -> goBackToListening() -> microfonul reporneste
```

---

## Agenda (santaAgenda.js)

Fiecare pas poate avea:
- `id` - identificator unic
- `prompt` - text trimis la GPT (optional)
- `audio` - cale catre audio predefinit (optional)
- `video` - video special de redat dupa vorbire (optional)
- `speakingState` - ce video speaking sa foloseasca (speaking_normal/amused/amazed)
- `shouldListenOnComplete` - daca pornim microfonul dupa (default: true)

**Pasi:**
1. intro - doar video
2. cunoastere - GPT afla cine e copilul
3. secrete - GPT mentioneaza info secrete
4. polul_nord - GPT + video elfs_working
5. suspans_lista - GPT creeaza suspans
6. verificare_lista - GPT + video kids_list
7. zbor_magic_intro - GPT intreaba daca vrea sa zboare
8. zbor_magic - GPT + video flight
9. dupa_zbor - GPT intreaba cum a fost
10. dorinte - GPT afla dorinte
11. incheiere - GPT (shouldListenOnComplete: false)

---

## State Management

### SantaCall State
- `callActive` - apelul e activ
- `currentState` - IDLE/CALLING/INTRO/LISTENING/SPEAKING
- `currentVideo` - ce video e afisat
- `isSantaSpeaking` - audio TTS in curs
- `isRequestPending` - asteptam raspuns API
- `conversationHistory` - istoricul mesajelor
- `showGlitch` - overlay glitch dupa 4s procesare

### useAgenda State
- `currentStepIndex` - index pas curent
- `childState` - {childGender, childCount, childNames, childAges}
- `pendingSpecialVideosRef` - video-uri de redat dupa TTS
- `playedVideosRef` - video-uri deja redate
- `conversationSummaryRef` - sumar conversatie pentru GPT

---

## Video-uri Speaking Multiple

| State | Video | Utilizare |
|-------|-------|-----------|
| speaking_normal | speaks.mp4 | Vorbire normala |
| speaking_amused | speaks_amused.mp4 | Vorbire amuzata |
| speaking_amazed | speaks_amazed.mp4 | Vorbire uimita |

Definite in:
- `santaStates.js` - SPEAKING_NORMAL, SPEAKING_AMUSED, SPEAKING_AMAZED
- `videoConfig.js` - configurare video src
- `santaAgenda.js` - speakingState per pas

**Fallback Mechanism:**
Daca un video speaking nu exista (ex: `speaks_amazed.mp4`), sistemul face fallback automat la `speaking_normal`:
1. Video error -> `handleVideoEnd` detecteaza eroare pe speaking video
2. Daca `pendingAudioRef` are audio si `speakingVideoFallbackTriedRef` e false -> incearca `speaking_normal`
3. Daca si fallback esueaza -> renunta si revine la listening

Ref: `speakingVideoFallbackTriedRef` in SantaCall.jsx

---

## API Calls

### chat.php
```
Input: message, history, childInfo, conversationSummary, agendaStep, agendaPrompt, childState
Output: message, summary, childState (optional), usage
```

### speech-to-text.php
```
Input: audio blob (multipart/form-data)
Output: text
```

### text-to-speech.php
```
Input: text, voice_id (optional)
Output: audio (base64)
```

---

## Session Recovery (localStorage)

Key: `santaCallState`
```json
{
  "conversationHistory": [...],
  "agendaIndex": 3,
  "childState": {"childGender": "baiat", "childNames": ["Razvan"]},
  "conversationSummary": "...",
  "playedVideos": ["elfs_working"],
  "callStartTime": 1734567890000,
  "timestamp": 1734567890123
}
```
- `callStartTime` - timestamp (ms) cand a inceput apelul, pentru a calcula timpul scurs la resume
- `timestamp` - timestamp (ms) cand s-a salvat starea
- Expira dupa 1 ora de la ultima salvare

---

## Debugging

Log prefixes:
- `[AGENDA]` - useAgenda.js
- `[VOICE]` - useVoiceRecorder.js
- `[AUDIO MANAGER]` - audioManager.js
- `[CONVERSATION]` - processConversation
- `[VIDEO]` - video special handling
- `[CHAT]` - chat API
- `[TTS]` - text-to-speech API
- `[STORAGE]` - localStorage
- `[PRELOAD]` - VideoPlayer preload

---

## Voice Recording Settings

Configurate in `SantaCall.jsx`:
- `silenceThreshold: 1500` - 1.5s de tacere inainte de a opri inregistrarea (permite pauze naturale)
- `volumeThreshold: 0.03` - sensibilitate detectare voce (mai mic = mai sensibil)
- `MIN_SPEECH_DURATION: 500` - minim 500ms de vorbire pentru a considera ca user-ul a vorbit (in useVoiceRecorder.js)

---

## Call Timer

Timer afisat deasupra video-ului in format `MM:SS`.

**Implementare:**
- `elapsedTime` state - timpul scurs in secunde
- `callStartTimeRef` - timestamp cand a inceput apelul
- `timerIntervalRef` - referinta la setInterval

**Persistenta:**
- `callStartTime` salvat in localStorage
- La resume, se calculeaza timpul scurs: `Math.floor((Date.now() - callStartTime) / 1000)`
- Timer-ul continua de unde a ramas
