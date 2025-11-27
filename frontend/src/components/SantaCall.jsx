import { useState, useCallback, useEffect, useRef } from 'react';
import { FaPhone, FaPhoneSlash } from 'react-icons/fa';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useAgenda } from '../hooks/useAgenda';
import { api } from '../services/api';
import { SANTA_STATES, isSpeakingState } from '../constants/santaStates';
import { SANTA_AGENDA, AGENDA_SPECIAL_VIDEOS, getNextAgendaStep } from '../constants/santaAgenda';
import { VideoPlayer } from './VideoPlayer';
import {
  unlockAudio,
  setAmbienceSrc,
  setRingtoneSrc,
  startAmbience as startAmbienceAudio,
  stopAmbience as stopAmbienceAudio,
  muteAmbience as muteAmbienceAudio,
  unmuteAmbience as unmuteAmbienceAudio,
  playRingtone as playRingtoneAudio,
  stopRingtone as stopRingtoneAudio,
  playPredefinedAudio
} from '../utils/audioManager';
import { getAudioUrl, getVideoUrl } from '../constants/assetsConfig';
import mosulImage from '../assets/mosul.png';
import './SantaCall.css';

// Informatii despre copil - parintele completeaza aici toate detaliile
const CHILD_INFO = "Razvan, 7 ani, ii place sa faca muzica si are o prietena Livia. Liviei ii placa sa faca designuri de site-uri web si sa calatoreasca, in special in Olanda. De asemenea ii place foarte mult sa se ingrijeasca plantele. Are o catelusa in curtea vecina numita Melissa. De asemenea si Razvan are o catelusa portocalie cu care se joaca la scara blocului.";

// LocalStorage key pentru salvarea starii conversatiei
const STORAGE_KEY = 'santaCallState';

// Mod de testare - disable API calls pentru testarea video-urilor
const DISABLE_GENERATION = false;

// Mod debug audio - reda audio-ul inregistrat in loc sa-l trimita la Whisper
const DEBUG_AUDIO_PLAYBACK = false;

export const SantaCall = () => {
  const [callActive, setCallActive] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [currentState, setCurrentState] = useState(SANTA_STATES.IDLE);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [isSantaSpeaking, setIsSantaSpeaking] = useState(false);
  const [isRequestPending, setIsRequestPending] = useState(false);
  const [showGlitch, setShowGlitch] = useState(false);
  const [hasSavedSession, setHasSavedSession] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0); // Timpul scurs in secunde

  // Folosim hook-ul pentru agenda
  const agenda = useAgenda();

  const pendingMessagesRef = useRef([]);
  const requestTimeoutRef = useRef(null);
  const voiceRecorderRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const pendingAudioRef = useRef(null);
  const processingStartTimeRef = useRef(null);
  const glitchTimeoutRef = useRef(null);
  const glitchVideoRef = useRef(null);
  const pendingVideosRef = useRef([]);
  const isPlayingSpecialVideoRef = useRef(false);
  const pendingReadyForNextRef = useRef(true); // GPT zice daca putem avansa
  const endCallRef = useRef(null); // Ref pentru endCall (evita circular dependency)
  const playPredefinedAudioForStepRef = useRef(null); // Ref pentru playPredefinedAudioForStep (evita circular dependency)
  const processingTimeoutRef = useRef(null);
  const retryCountRef = useRef(0);
  const isProcessingConversationRef = useRef(false);
  const currentSpeakingStateRef = useRef('speaking'); // Starea de speaking curenta
  const speakingVideoFallbackTriedRef = useRef(false); // Daca am incercat deja fallback pentru speaking video
  const timerIntervalRef = useRef(null); // Interval pentru timer
  const callStartTimeRef = useRef(null); // Timestamp cand a inceput apelul

  const MAX_RETRIES = 2;
  const PROCESSING_TIMEOUT_MS = 25000;
  const API_RETRY_COUNT = 3;
  const API_RETRY_DELAY_MS = 1000;

  // Helper pentru salvarea starii in localStorage
  const saveStateToStorage = useCallback((history, agendaIndex, childState, summary) => {
    try {
      const state = {
        conversationHistory: history,
        agendaIndex: agendaIndex,
        childState: childState,
        conversationSummary: summary,
        playedVideos: agenda.getPlayedVideos(),
        callStartTime: callStartTimeRef.current, // Timestamp de start al apelului
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      console.log('[STORAGE] State saved to localStorage');
    } catch (e) {
      console.warn('[STORAGE] Failed to save state:', e.message);
    }
  }, [agenda]);

  // Helper pentru incarcarea starii din localStorage
  const loadStateFromStorage = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return null;

      const state = JSON.parse(saved);
      const ONE_HOUR = 60 * 60 * 1000;
      if (Date.now() - state.timestamp > ONE_HOUR) {
        console.log('[STORAGE] Saved state is too old, discarding');
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      console.log('[STORAGE] State loaded from localStorage');
      return state;
    } catch (e) {
      console.warn('[STORAGE] Failed to load state:', e.message);
      return null;
    }
  }, []);

  // Helper pentru stergerea starii din localStorage
  const clearStateFromStorage = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('[STORAGE] State cleared from localStorage');
    } catch (e) {
      console.warn('[STORAGE] Failed to clear state:', e.message);
    }
  }, []);

  // Helper pentru formatarea timpului (MM:SS)
  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Functii pentru timer
  const startTimer = useCallback((initialStartTime = null) => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    // Daca avem un start time salvat, il folosim; altfel, setam unul nou
    if (initialStartTime) {
      callStartTimeRef.current = initialStartTime;
      // Calculam timpul scurs de la start
      const elapsed = Math.floor((Date.now() - initialStartTime) / 1000);
      setElapsedTime(elapsed);
    } else {
      callStartTimeRef.current = Date.now();
      setElapsedTime(0);
    }

    timerIntervalRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    callStartTimeRef.current = null;
    setElapsedTime(0);
  }, []);

  // Surse audio pentru ambience si ringtone (din R2)
  const ambienceSrc = getAudioUrl('ambience.mp3');
  const ringtoneSrc = getAudioUrl('suna.mp3');

  const startAmbience = useCallback(() => {
    startAmbienceAudio(ambienceSrc);
  }, [ambienceSrc]);

  const stopAmbience = useCallback(() => {
    stopAmbienceAudio();
  }, []);

  const muteAmbience = useCallback(() => {
    muteAmbienceAudio();
  }, []);

  const unmuteAmbience = useCallback(() => {
    unmuteAmbienceAudio(0.3);
  }, []);

  // Functie pentru a porni timer-ul de glitch
  const startGlitchTimer = useCallback(() => {
    processingStartTimeRef.current = Date.now();
    if (glitchTimeoutRef.current) {
      clearTimeout(glitchTimeoutRef.current);
    }
    glitchTimeoutRef.current = setTimeout(() => {
      console.log('4 seconds passed, showing glitch');
      setShowGlitch(true);
    }, 4000);
  }, []);

  // Functie pentru a opri glitch-ul
  const stopGlitch = useCallback(() => {
    if (glitchTimeoutRef.current) {
      clearTimeout(glitchTimeoutRef.current);
      glitchTimeoutRef.current = null;
    }
    setShowGlitch(false);
    processingStartTimeRef.current = null;
  }, []);

  // Functie pentru a opri timeout-ul de procesare
  const clearProcessingTimeout = useCallback(() => {
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
  }, []);

  // Functie helper pentru retry API calls cu exponential backoff
  const retryApiCall = useCallback(async (apiCall, maxRetries = API_RETRY_COUNT, initialDelay = API_RETRY_DELAY_MS) => {
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        lastError = error;
        console.warn(`[API RETRY] Attempt ${attempt + 1}/${maxRetries} failed:`, error.message);
        if (attempt < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, attempt);
          console.log(`[API RETRY] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }, []);

  // Functie pentru procesarea conversatiei cu noul sistem de agenda
  const processConversation = useCallback(async (isRetry = false, retryMessage = null) => {
    const currentStep = agenda.getCurrentStep();
    console.log('[AGENDA] === processConversation START ===');
    console.log('[AGENDA] Current step index:', agenda.currentStepIndex);
    console.log('[AGENDA] Current step:', currentStep?.id, currentStep?.name);
    console.log('[AGENDA] Current step prompt:', currentStep?.prompt?.substring(0, 100) + '...');
    console.log('[AGENDA] Current step video:', currentStep?.video);
    console.log('[AGENDA] Played videos:', agenda.getPlayedVideos());
    console.log('[CONVERSATION] processConversation called', {
      pendingMessages: pendingMessagesRef.current.length,
      isRequestPending,
      isSantaSpeaking,
      isPlayingSpecialVideo: isPlayingSpecialVideoRef.current,
      isRetry,
      retryCount: retryCountRef.current,
      currentAgendaStep: currentStep?.id
    });

    if (isProcessingConversationRef.current) {
      console.log('[GUARD] Already processing conversation, skipping');
      return;
    }

    if (isPlayingSpecialVideoRef.current) {
      console.log('Special video playing, skipping conversation processing');
      return;
    }

    if (!isRetry) {
      if (pendingMessagesRef.current.length === 0 || isRequestPending || isSantaSpeaking) {
        return;
      }
    } else {
      if (isRequestPending) {
        console.log('[RETRY] Request already pending, skipping retry');
        return;
      }
    }

    isProcessingConversationRef.current = true;
    setError(null);

    const concatenatedMessage = isRetry && retryMessage
      ? retryMessage
      : pendingMessagesRef.current.join(' ');

    if (!isRetry) {
      pendingMessagesRef.current = [];
    }

    setIsRequestPending(true);

    if (voiceRecorderRef.current) {
      voiceRecorderRef.current.stopListening();
    }

    // Obtinem pasul curent din agenda (refolosim currentStep definit mai sus)
    console.log('[AGENDA] Step for processing:', currentStep?.id, 'prompt:', currentStep?.prompt ? 'YES' : 'NO', 'video:', currentStep?.video);

    // Nota: Audio-ul predefinit e gestionat de playPredefinedAudioForStep (apelat din handleVideoEnd/handlePlaybackEnd)
    // processConversation se ocupa doar de pasi cu prompt GPT
    startGlitchTimer();

    clearProcessingTimeout();
    processingTimeoutRef.current = setTimeout(async () => {
      console.warn('[TIMEOUT] Processing took too long! Attempting recovery...');
      retryCountRef.current++;

      if (retryCountRef.current <= MAX_RETRIES) {
        console.log(`[TIMEOUT] Retry ${retryCountRef.current}/${MAX_RETRIES} - sending continue message`);
        setIsRequestPending(false);
        isProcessingConversationRef.current = false;
        stopGlitch();

        pendingMessagesRef.current = ['continua'];
        setTimeout(() => {
          processConversation(true, 'continua te rog');
        }, 1000);
      } else {
        console.error('[TIMEOUT] Max retries reached, going back to listening');
        retryCountRef.current = 0;
        isProcessingConversationRef.current = false;
        setIsRequestPending(false);
        stopGlitch();
        setError('Conexiunea a fost intrerupta. Te rog vorbeste din nou.');
        setCurrentState(SANTA_STATES.LISTENING);
        setCurrentVideo('listening');
        setIsSantaSpeaking(false);

        if (voiceRecorderRef.current) {
          await voiceRecorderRef.current.startListening();
        }
      }
    }, PROCESSING_TIMEOUT_MS);

    try {
      console.log('[AGENDA] === CALLING GPT ===');
      console.log('[AGENDA] User message:', concatenatedMessage);
      console.log('[AGENDA] Step ID:', currentStep?.id);
      console.log('[AGENDA] Step Name:', currentStep?.name);
      console.log('[AGENDA] Step Prompt:', currentStep?.prompt);
      console.log('[AGENDA] Child state:', agenda.childState);
      console.log('[AGENDA] Summary:', agenda.getSummary());

      // Chat API call cu noii parametri
      const chatResponse = await retryApiCall(() =>
        api.chat(
          concatenatedMessage,
          conversationHistory,
          CHILD_INFO,
          agenda.getSummary(),
          currentStep?.id,
          currentStep?.prompt,
          agenda.childState
        )
      );

      const { message: santaResponse, summary = '', childState: newChildState, readyForNext = true, skipVideo = false } = chatResponse;
      console.log('[AGENDA] GPT response:', santaResponse);
      console.log('[AGENDA] readyForNext:', readyForNext, 'skipVideo:', skipVideo);
      console.log('[AGENDA] New child state:', newChildState);

      clearProcessingTimeout();
      retryCountRef.current = 0;

      // Actualizam sumarul conversatiei
      if (summary) {
        agenda.updateSummary(summary);
      }

      // Actualizam starea copilului daca am primit informatii noi
      if (newChildState) {
        agenda.updateChildState(newChildState);
      }

      // Limitam history la ultimele 20 mesaje
      const MAX_HISTORY = 20;
      const newHistory = [
        ...conversationHistory,
        { role: 'user', content: concatenatedMessage },
        { role: 'assistant', content: santaResponse }
      ].slice(-MAX_HISTORY);

      setConversationHistory(newHistory);

      // Salvam starea
      saveStateToStorage(newHistory, agenda.currentStepIndex, agenda.childState, summary);

      // Salvam readyForNext pentru a decide daca avansam
      pendingReadyForNextRef.current = readyForNext;

      // Verificam daca pasul curent are video special
      console.log('[AGENDA] === CHECKING FOR SPECIAL VIDEO ===');
      console.log('[AGENDA] currentStep.video:', currentStep?.video);
      console.log('[AGENDA] skipVideo:', skipVideo);

      if (skipVideo) {
        console.log('[AGENDA] Video SKIPPED - copilul a refuzat');
        // Marcam video-ul ca "played" pentru a nu-l mai incerca
        if (currentStep?.video) {
          agenda.markVideoAsPlayed(currentStep.video);
        }
      } else if (currentStep?.video && AGENDA_SPECIAL_VIDEOS.includes(currentStep.video)) {
        const alreadyPlayed = agenda.isVideoPlayed(currentStep.video);
        console.log('[AGENDA] Special video found:', currentStep.video, 'alreadyPlayed:', alreadyPlayed);
        if (!alreadyPlayed) {
          pendingVideosRef.current.push(currentStep.video);
          agenda.markVideoAsPlayed(currentStep.video);
          console.log('[AGENDA] ADDED special video to pending:', currentStep.video);
        } else {
          console.log('[AGENDA] Skipping already played video:', currentStep.video);
        }
      } else {
        console.log('[AGENDA] No special video for this step');
      }

      // TTS API call
      console.log('[TTS] Calling TTS API...');
      const { audio } = await retryApiCall(() => api.textToSpeech(santaResponse));
      console.log('[TTS] API response received, audio length:', audio?.length);

      clearProcessingTimeout();
      setIsRequestPending(false);
      isProcessingConversationRef.current = false;

      // Stocam audio-ul si setam starea de speaking corespunzatoare
      pendingAudioRef.current = audio;
      const speakingState = currentStep?.speakingState || 'speaking';
      currentSpeakingStateRef.current = speakingState;
      speakingVideoFallbackTriedRef.current = false; // Reset fallback flag
      setCurrentState(SANTA_STATES.SPEAKING);
      setCurrentVideo(speakingState);
      console.log('[SPEAKING] Set video to:', speakingState);

    } catch (err) {
      console.error('Error processing conversation (after retries):', err);
      clearProcessingTimeout();
      setError(err.message);
      setIsRequestPending(false);
      isProcessingConversationRef.current = false;
      stopGlitch();
      setCurrentState(SANTA_STATES.LISTENING);
      setCurrentVideo('listening');
      setIsSantaSpeaking(false);

      if (callActive && voiceRecorderRef.current) {
        await voiceRecorderRef.current.startListening();
      }
    }
  }, [conversationHistory, callActive, isSantaSpeaking, isRequestPending, startGlitchTimer, stopGlitch, clearProcessingTimeout, retryApiCall, saveStateToStorage, agenda]);

  const scheduleRequestIfNeeded = useCallback(() => {
    if (requestTimeoutRef.current) {
      clearTimeout(requestTimeoutRef.current);
    }

    if (isSantaSpeaking || isRequestPending) {
      return;
    }

    if (pendingMessagesRef.current.length > 0) {
      requestTimeoutRef.current = setTimeout(() => {
        processConversation();
      }, 300);
    }
  }, [isSantaSpeaking, isRequestPending, processConversation]);

  const handleRecordingComplete = useCallback(async (audioBlob) => {
    console.log('Recording complete, blob size:', audioBlob?.size);

    if (isPlayingSpecialVideoRef.current) {
      console.log('Special video playing, ignoring recording');
      return;
    }

    if (isSantaSpeaking) {
      console.log('Santa is speaking, ignoring recording');
      return;
    }

    if (DISABLE_GENERATION) {
      return;
    }

    const MIN_BLOB_SIZE = 5000;
    if (audioBlob?.size < MIN_BLOB_SIZE) {
      console.log('Recording too small, ignoring:', audioBlob?.size, '< ', MIN_BLOB_SIZE);
      return;
    }

    if (DEBUG_AUDIO_PLAYBACK) {
      console.log('DEBUG: Playing back recorded audio...');
      const audioUrl = URL.createObjectURL(audioBlob);
      const debugAudio = new Audio(audioUrl);
      debugAudio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        console.log('DEBUG: Playback finished');
      };
      debugAudio.play().catch(err => console.error('DEBUG playback error:', err));
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      console.log('Calling speech-to-text API...');
      const { text } = await retryApiCall(() => api.speechToText(audioBlob));
      console.log('Speech-to-text result:', text);

      if (!text || text.trim().length === 0) {
        setIsProcessing(false);
        return;
      }

      // Ignoram halucinatii evidente
      const hasAsianChars = /[\u3131-\uD79D\u4E00-\u9FFF]/.test(text);
      const lowerText = text.toLowerCase();
      const hallucinations = [
        'subscribe', 'like and subscribe', 'hit the bell', 'click the button',
        'thanks for watching', 'see you next', 'don\'t forget to', 'leave a comment',
        'share this video', 'check out', 'link in description', 'my channel',
        'abonați', 'aboneaza', 'dați like', 'dati like', 'da like', 'lăsați un comentariu',
        'lasati un comentariu', 'distribuiți', 'distribuiti', 'nu uitați', 'nu uitati',
        'mulțumim pentru vizionare', 'multumim pentru vizionare', 'pe curand',
        'revedem', 'următorul video', 'urmatorul video', 'următoarea', 'urmatoarea',
        'rețetă', 'reteta', 'vizionare plăcută', 'vizionare placuta',
        'rețele sociale', 'retele sociale', 'link în descriere', 'link in descriere',
        'canalul meu', 'subtitrat', 'subtitrari'
      ];
      const isHallucination = hallucinations.some(h => lowerText.includes(h));

      if (hasAsianChars || isHallucination) {
        console.log('[HALLUCINATION] Ignoring Whisper hallucination:', text);
        setIsProcessing(false);
        return;
      }

      pendingMessagesRef.current.push(text);

      if (requestTimeoutRef.current) {
        clearTimeout(requestTimeoutRef.current);
        requestTimeoutRef.current = null;
      }

      if (!isRequestPending && !isSantaSpeaking) {
        scheduleRequestIfNeeded();
      }

      setIsProcessing(false);
    } catch (err) {
      console.error('Error transcribing audio (after retries):', err);
      setError(err.message);
      setIsProcessing(false);
    }
  }, [scheduleRequestIfNeeded, isSantaSpeaking, isRequestPending, retryApiCall]);

  // Functie pentru a reveni la listening
  const goBackToListening = useCallback(async () => {
    console.log('[LISTENING] Going back to listening mode');
    setIsProcessing(false);
    setIsSantaSpeaking(false);
    setError(null);
    setCurrentState(SANTA_STATES.LISTENING);
    setCurrentVideo('listening');

    if (callActive && voiceRecorderRef.current) {
      console.log('[TIMING] Starting microphone restart at:', Date.now());
      try {
        await voiceRecorderRef.current.startListening();
        console.log('[TIMING] Microphone started at:', Date.now());
      } catch (err) {
        console.error('[ERROR] Failed to restart microphone:', err);
      }
      scheduleRequestIfNeeded();
    }
  }, [callActive, scheduleRequestIfNeeded]);

  // Functie pentru a reda urmatorul video special
  // Nota: NU oprim ambience aici - ambience se opreste doar la recording (in useEffect)
  const playNextSpecialVideo = useCallback(() => {
    if (pendingVideosRef.current.length > 0) {
      const nextVideo = pendingVideosRef.current.shift();
      console.log('[VIDEO] Playing special video:', nextVideo);
      isPlayingSpecialVideoRef.current = true;

      if (voiceRecorderRef.current) {
        voiceRecorderRef.current.stopListening();
      }

      stopGlitch();
      // NU apelam muteAmbience() - ambience ramane activ in timpul video-urilor speciale
      setCurrentVideo(nextVideo);
      setIsSantaSpeaking(false);
    } else {
      console.log('[VIDEO] No more special videos');
      isPlayingSpecialVideoRef.current = false;

      // Verificam pasul curent din agenda
      const currentStep = agenda.getCurrentStep();
      const shouldListen = currentStep?.shouldListenOnComplete !== false;

      if (shouldListen) {
        // Obtinem urmatorul pas INAINTE de a apela goToNextStep
        const nextStep = getNextAgendaStep(currentStep?.id);
        console.log('[AGENDA] After special video, next step:', nextStep?.id);

        // Trecem la urmatorul pas
        agenda.goToNextStep();

        // Verificam daca urmatorul pas are audio predefinit
        if (nextStep?.audio && !nextStep?.prompt) {
          console.log('[AGENDA] Next step has predefined audio:', nextStep.id);
          if (playPredefinedAudioForStepRef.current) {
            playPredefinedAudioForStepRef.current(nextStep);
          }
          return;
        }

        goBackToListening();
      } else {
        // Incheiere - nu mai ascultam
        console.log('[AGENDA] Conversation ended after special video');
        setCurrentState(SANTA_STATES.LISTENING);
        setCurrentVideo('listening');
        setIsSantaSpeaking(false);
      }
    }
  }, [goBackToListening, stopGlitch, agenda]);

  // Helper pentru a reda audio predefinit dintr-un pas din agenda
  const playPredefinedAudioForStep = useCallback(async (step) => {
    if (!step?.audio) return false;

    console.log('[AGENDA] Playing predefined audio for step:', step.id);

    // Setam starea de speaking
    const speakingState = step.speakingState || 'speaking';
    currentSpeakingStateRef.current = speakingState;
    setCurrentState(SANTA_STATES.SPEAKING);
    setCurrentVideo(speakingState);
    setIsSantaSpeaking(true);

    // Redam audio-ul predefinit
    await playPredefinedAudio(getAudioUrl(step.audio), async () => {
      console.log('[AGENDA] Predefined audio ended for step:', step.id);
      setIsSantaSpeaking(false);

      // Verificam daca pasul are video special
      if (step.video && AGENDA_SPECIAL_VIDEOS.includes(step.video)) {
        if (!agenda.isVideoPlayed(step.video)) {
          pendingVideosRef.current.push(step.video);
          agenda.markVideoAsPlayed(step.video);
          console.log('[AGENDA] Added special video to queue:', step.video);
        }
      }

      // Daca avem video pending, il redam
      if (pendingVideosRef.current.length > 0) {
        playNextSpecialVideo();
      } else {
        // Trecem la urmatorul pas sau revenim la listening
        const shouldListen = step.shouldListenOnComplete !== false;
        if (shouldListen) {
          agenda.goToNextStep();
          goBackToListening();
        } else {
          console.log('[AGENDA] Step ended, not listening');
          setCurrentState(SANTA_STATES.LISTENING);
          setCurrentVideo('listening');
        }
      }
    });

    return true;
  }, [agenda, playNextSpecialVideo, goBackToListening]);

  const handlePlaybackEnd = useCallback(async () => {
    console.log('[AGENDA] === AUDIO PLAYBACK ENDED ===');
    console.log('[AGENDA] pendingVideosRef:', [...pendingVideosRef.current]);
    console.log('[AGENDA] Current step:', agenda.getCurrentStep()?.id);
    console.log('[AGENDA] Elapsed time:', elapsedTime, 'seconds');

    if (pendingVideosRef.current.length > 0) {
      console.log('[AGENDA] TTS ended, will play special video:', pendingVideosRef.current[0]);
      playNextSpecialVideo();
    } else {
      const currentStep = agenda.getCurrentStep();
      const shouldListen = currentStep?.shouldListenOnComplete !== false;

      // Verificam daca trebuie sa inchidem automat apelul
      if (currentStep?.autoEndCall) {
        console.log('[AGENDA] Auto-ending call after:', currentStep.id);
        setTimeout(() => {
          if (endCallRef.current) endCallRef.current();
        }, 2000); // Asteptam 2 secunde apoi inchidem
        return;
      }

      // Verificam daca am depasit 5 minute si suntem in conversatie libera
      const MAX_CALL_DURATION = 5 * 60; // 5 minute in secunde
      if (elapsedTime >= MAX_CALL_DURATION && currentStep?.isLooping) {
        console.log('[AGENDA] Time limit reached, moving to incheiere');
        agenda.goToStep('incheiere');
        goBackToListening();
        return;
      }

      // Daca pasul curent e looping, nu avansam - ramanem pe el
      if (currentStep?.isLooping) {
        console.log('[AGENDA] Looping step, staying on:', currentStep.id);
        goBackToListening();
        return;
      }

      // Verificam daca GPT a zis ca putem avansa
      const canAdvance = pendingReadyForNextRef.current;
      console.log('[AGENDA] canAdvance (readyForNext):', canAdvance);
      pendingReadyForNextRef.current = true; // Reset pentru urmatorul schimb

      if (shouldListen) {
        if (canAdvance) {
          // Obtinem urmatorul pas INAINTE de a apela goToNextStep (pentru ca state update e async)
          const nextStep = getNextAgendaStep(currentStep?.id);
          console.log('[AGENDA] Moving to next step:', nextStep?.id);

          // Trecem la urmatorul pas
          agenda.goToNextStep();

          // Verificam daca urmatorul pas are audio predefinit (fara prompt GPT)
          if (nextStep?.audio && !nextStep?.prompt) {
            console.log('[AGENDA] Next step has predefined audio, playing it:', nextStep.id);
            await playPredefinedAudioForStep(nextStep);
            return;
          }
        } else {
          console.log('[AGENDA] Staying on current step - GPT said not ready');
        }
        goBackToListening();
      } else {
        // Incheiere - nu mai ascultam, doar setam starea finala
        console.log('[AGENDA] Conversation ended, not listening anymore');
        setCurrentState(SANTA_STATES.LISTENING);
        setCurrentVideo('listening');
        setIsSantaSpeaking(false);
      }
    }
  }, [playNextSpecialVideo, goBackToListening, agenda, elapsedTime, playPredefinedAudioForStep]);

  const voiceRecorder = useVoiceRecorder({
    onRecordingComplete: handleRecordingComplete,
    silenceThreshold: 1500, // 1.5s - permite pauze naturale in vorbire
    volumeThreshold: 0.03   // putin mai sensibil pentru a detecta vorbire mai lina
  });

  const audioPlayer = useAudioPlayer({
    onPlaybackEnd: handlePlaybackEnd
  });

  // Effect pentru a mute/unmute ambience
  useEffect(() => {
    if (isPlayingSpecialVideoRef.current) {
      return;
    }

    if (voiceRecorder.isRecording) {
      muteAmbience();
    } else {
      unmuteAmbience();
    }
  }, [voiceRecorder.isRecording, muteAmbience, unmuteAmbience]);

  // Salvam referintele
  useEffect(() => {
    voiceRecorderRef.current = voiceRecorder;
    audioPlayerRef.current = audioPlayer;
  }, [voiceRecorder, audioPlayer]);

  // Verificam daca avem o sesiune salvata la mount
  useEffect(() => {
    const savedState = loadStateFromStorage();
    if (savedState && savedState.conversationHistory?.length > 0) {
      console.log('[STORAGE] Found saved session with', savedState.conversationHistory.length, 'messages');
      setHasSavedSession(true);
    }
  }, [loadStateFromStorage]);

  // Functie pentru deblocarea audio/video pe iOS/mobile
  const unlockMediaPlayback = useCallback(async () => {
    console.log('[MOBILE] Unlocking media playback...');

    setAmbienceSrc(ambienceSrc);
    setRingtoneSrc(ringtoneSrc);

    await unlockAudio();

    try {
      console.log('[MOBILE] Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      console.log('[MOBILE] Microphone permission granted');
    } catch (e) {
      console.warn('[MOBILE] Microphone permission denied or failed:', e.message);
    }

    await unlockAudio();

    const tempVideo = document.createElement('video');
    tempVideo.muted = true;
    tempVideo.playsInline = true;
    tempVideo.setAttribute('playsinline', 'true');
    tempVideo.setAttribute('webkit-playsinline', 'true');
    tempVideo.src = getVideoUrl('intro.mp4');
    try {
      const playPromise = tempVideo.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
      tempVideo.pause();
      tempVideo.remove();
      console.log('[MOBILE] Video playback unlocked');
    } catch (e) {
      console.log('[MOBILE] Video unlock not needed or failed:', e.message);
    }

    console.log('[MOBILE] All media unlocked!');
  }, [ambienceSrc, ringtoneSrc]);

  const startCall = useCallback(async () => {
    if (callActive || currentState !== SANTA_STATES.IDLE) {
      return;
    }

    try {
      await unlockMediaPlayback();

      setCallActive(true);
      setConversationHistory([]);
      setError(null);
      clearStateFromStorage();
      setHasSavedSession(false);
      pendingMessagesRef.current = [];
      pendingVideosRef.current = [];
      isPlayingSpecialVideoRef.current = false;
      pendingReadyForNextRef.current = true;
      retryCountRef.current = 0;
      isProcessingConversationRef.current = false;
      speakingVideoFallbackTriedRef.current = false;
      setIsRequestPending(false);

      // Resetam agenda
      agenda.resetAgenda();

      // Starea CALLING
      setCurrentState(SANTA_STATES.CALLING);
      setCurrentVideo(null);

      playRingtoneAudio();
      await new Promise(resolve => setTimeout(resolve, 2000));
      stopRingtoneAudio();

      // Trecem la INTRO - primul pas din agenda
      setCurrentState(SANTA_STATES.INTRO);
      setCurrentVideo('intro');

      // Pornim timer-ul
      startTimer();
    } catch (err) {
      console.error('Error starting call:', err);
      setError(err.message);
      setCallActive(false);
      setCurrentState(SANTA_STATES.IDLE);
      setCurrentVideo(null);
    }
  }, [unlockMediaPlayback, callActive, currentState, clearStateFromStorage, agenda, startTimer]);

  // Functie pentru a relua o sesiune salvata
  const resumeCall = useCallback(async () => {
    if (callActive || currentState !== SANTA_STATES.IDLE) {
      return;
    }

    const savedState = loadStateFromStorage();
    if (!savedState) {
      console.warn('[STORAGE] No saved state found, starting new call');
      startCall();
      return;
    }

    try {
      console.log('[STORAGE] Resuming call from saved state...');

      await unlockMediaPlayback();

      setCallActive(true);
      setConversationHistory(savedState.conversationHistory || []);
      setError(null);
      pendingMessagesRef.current = [];
      pendingVideosRef.current = [];
      isPlayingSpecialVideoRef.current = false;
      pendingReadyForNextRef.current = true;
      retryCountRef.current = 0;
      isProcessingConversationRef.current = false;
      speakingVideoFallbackTriedRef.current = false;
      setIsRequestPending(false);
      setHasSavedSession(false);

      // Restauram starea agendei
      if (savedState.agendaIndex !== undefined) {
        agenda.goToStep(SANTA_AGENDA[savedState.agendaIndex]?.id);
      }
      if (savedState.childState) {
        agenda.updateChildState(savedState.childState);
      }
      if (savedState.conversationSummary) {
        agenda.updateSummary(savedState.conversationSummary);
      }
      if (savedState.playedVideos) {
        agenda.setPlayedVideos(savedState.playedVideos);
      }

      console.log('[STORAGE] Restored:', {
        historyLength: savedState.conversationHistory?.length,
        agendaIndex: savedState.agendaIndex,
        childState: savedState.childState,
        playedVideos: savedState.playedVideos,
        callStartTime: savedState.callStartTime
      });

      setCurrentState(SANTA_STATES.LISTENING);
      setCurrentVideo('listening');

      startAmbience();
      // Pornim timer-ul cu timpul salvat (sau nou daca nu exista)
      startTimer(savedState.callStartTime || null);

      if (voiceRecorderRef.current) {
        console.log('[STORAGE] Starting microphone after resume');
        try {
          await voiceRecorderRef.current.startListening();
          pendingMessagesRef.current.push('Am revenit, continua conversatia te rog');
          scheduleRequestIfNeeded();
        } catch (micErr) {
          console.error('[STORAGE] Failed to start microphone:', micErr);
          setError('Nu am putut porni microfonul. Te rog incearca din nou.');
        }
      }

    } catch (err) {
      console.error('Error resuming call:', err);
      setError(err.message);
      setCallActive(false);
      setCurrentState(SANTA_STATES.IDLE);
      setCurrentVideo(null);
    }
  }, [unlockMediaPlayback, callActive, currentState, loadStateFromStorage, startCall, startAmbience, scheduleRequestIfNeeded, agenda, startTimer]);

  const handleVideoEnd = useCallback(async (videoName) => {
    console.log('[AGENDA] === VIDEO ENDED ===');
    console.log('[AGENDA] Video name:', videoName);
    console.log('[AGENDA] Current step:', agenda.getCurrentStep()?.id);
    console.log('[AGENDA] Is special video:', AGENDA_SPECIAL_VIDEOS.includes(videoName));

    if (videoName === 'intro') {
      console.log('[AGENDA] Intro ended, moving to next step');

      // Obtinem urmatorul pas INAINTE de a apela goToNextStep (pentru ca state update e async)
      const currentStep = agenda.getCurrentStep();
      const nextStep = getNextAgendaStep(currentStep?.id);
      console.log('[AGENDA] Current step:', currentStep?.id, '-> Next step:', nextStep?.id);

      // Trecem la urmatorul pas din agenda
      agenda.goToNextStep();

      // Verificam daca urmatorul pas are audio predefinit (fara prompt GPT)
      if (nextStep?.audio && !nextStep?.prompt) {
        console.log('[AGENDA] Next step has predefined audio, playing it');
        await playPredefinedAudioForStep(nextStep);
        return;
      }

      // Altfel, mergem la listening normal
      setCurrentState(SANTA_STATES.LISTENING);
      setCurrentVideo('listening');
      // Ambience deja pornit din handleVideoPlay

      if (voiceRecorderRef.current) {
        console.log('Starting microphone after intro');
        try {
          await voiceRecorderRef.current.startListening();
        } catch (micErr) {
          console.error('[ERROR] Failed to start microphone after intro:', micErr);
          setError('Nu am putut porni microfonul. Verifica permisiunile si incearca din nou.');
        }
      }
      return; // Prevent further processing
    }

    // Daca s-a terminat un video special
    if (AGENDA_SPECIAL_VIDEOS.includes(videoName)) {
      console.log('[VIDEO] Special video ended:', videoName);
      playNextSpecialVideo();
      return; // Prevent further processing
    }

    // Error recovery pentru speaking video (video-urile speaking au loop:true, deci nu ar trebui sa se termine)
    if (isSpeakingState(videoName) || videoName === 'speaking') {
      console.warn('[VIDEO] Speaking video ended unexpectedly (error?), videoName:', videoName);

      // Daca avem audio pending si nu am incercat inca fallback, incercam speaking_normal
      if (pendingAudioRef.current && !speakingVideoFallbackTriedRef.current) {
        console.log('[VIDEO] Trying fallback to speaking_normal...');
        speakingVideoFallbackTriedRef.current = true;
        setCurrentVideo('speaking_normal');
        return;
      }

      // Daca nici fallback-ul nu a mers sau nu avem audio, renuntam
      console.warn('[VIDEO] Fallback failed or no audio, going back to listening');
      pendingAudioRef.current = null;
      speakingVideoFallbackTriedRef.current = false;
      goBackToListening();
      return;
    }
  }, [playNextSpecialVideo, goBackToListening, agenda, playPredefinedAudioForStep]);

  const handleVideoPlay = useCallback(async (videoName) => {
    console.log('Video started playing:', videoName);

    if (videoName === 'intro') {
      console.log('Intro started, starting ambience');
      startAmbience();
    }

    // Daca e o stare de speaking si avem audio pending
    if ((isSpeakingState(videoName) || videoName === 'speaking') && pendingAudioRef.current) {
      console.log('Speaking video active, playing pending audio');

      stopGlitch();

      const audioToPlay = pendingAudioRef.current;
      pendingAudioRef.current = null;

      if (audioPlayerRef.current) {
        setIsSantaSpeaking(true);
        await audioPlayerRef.current.play(audioToPlay);
      }
    }
  }, [stopGlitch, startAmbience]);

  const handleVideoStop = useCallback((videoName) => {
    console.log('Video stopped:', videoName);
  }, []);

  const handleTestVideoChange = useCallback((videoName) => {
    setCurrentVideo(videoName);
  }, []);

  const endCall = useCallback(() => {
    if (voiceRecorderRef.current) {
      voiceRecorderRef.current.stopListening();
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.stop();
    }
    stopRingtoneAudio();
    stopGlitch();
    clearProcessingTimeout();
    stopAmbience();
    stopTimer(); // Oprim timer-ul
    clearStateFromStorage();
    setCallActive(false);
    setIsProcessing(false);
    setIsSantaSpeaking(false);
    setCurrentState(SANTA_STATES.IDLE);
    setCurrentVideo(null);
    setHasSavedSession(false);
    pendingMessagesRef.current = [];
    pendingAudioRef.current = null;
    pendingVideosRef.current = [];
    isPlayingSpecialVideoRef.current = false;
    pendingReadyForNextRef.current = true;
    retryCountRef.current = 0;
    isProcessingConversationRef.current = false;
    speakingVideoFallbackTriedRef.current = false;
    if (requestTimeoutRef.current) {
      clearTimeout(requestTimeoutRef.current);
    }
    setIsRequestPending(false);

    // Resetam agenda
    agenda.resetAgenda();
  }, [stopGlitch, stopAmbience, clearProcessingTimeout, clearStateFromStorage, agenda, stopTimer]);

  // Actualizam ref-ul pentru endCall
  useEffect(() => {
    endCallRef.current = endCall;
  }, [endCall]);

  // Actualizam ref-ul pentru playPredefinedAudioForStep (evita circular dependency)
  useEffect(() => {
    playPredefinedAudioForStepRef.current = playPredefinedAudioForStep;
  }, [playPredefinedAudioForStep]);

  useEffect(() => {
    return () => {
      if (voiceRecorderRef.current) {
        voiceRecorderRef.current.stopListening();
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.stop();
      }
      if (glitchTimeoutRef.current) {
        clearTimeout(glitchTimeoutRef.current);
      }
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      stopAmbienceAudio();
    };
  }, []);

  return (
    <div className="santa-call">
      {/* Timer - afisat doar cand apelul e activ */}
      {currentState !== SANTA_STATES.IDLE && (
        <div className="call-timer">{formatTime(elapsedTime)}</div>
      )}
      <div className="santa-call-container">
        {currentState === SANTA_STATES.IDLE && (
          <div className="idle-screen">
            <h1 className="app-title">Suna-l pe Mos Craciun!</h1>
            <div className="call-button-wrapper">
              <button className="call-button start" onClick={hasSavedSession ? resumeCall : startCall}>
                <FaPhone />
              </button>
            </div>
            {hasSavedSession && (
              <div className="resume-options">
                <p className="resume-hint">Continua conversatia anterioara</p>
                <button className="new-call-link" onClick={() => {
                  clearStateFromStorage();
                  setHasSavedSession(false);
                }}>
                  sau incepe o conversatie noua
                </button>
              </div>
            )}
          </div>
        )}

        {currentState === SANTA_STATES.CALLING && (
          <>
            <div className="calling-screen">
              <div className="calling-avatar">
                <img src={mosulImage} alt="Mos Craciun" />
              </div>
              <p className="calling-text">Se apeleaza...</p>
              <h2 className="calling-name">Mos Craciun</h2>
            </div>
            <button className="end-call-button" onClick={endCall}>
              <FaPhoneSlash />
            </button>
          </>
        )}

        {currentState === SANTA_STATES.INTRO && (
          <>
            <VideoPlayer
              currentVideo={currentVideo}
              onVideoEnd={handleVideoEnd}
              onPlay={handleVideoPlay}
              onStop={handleVideoStop}
              className="fullscreen-video"
              testMode={DISABLE_GENERATION}
              onTestVideoChange={handleTestVideoChange}
            />
            <button className="end-call-button" onClick={endCall}>
              <FaPhoneSlash />
            </button>
          </>
        )}

        {(currentState === SANTA_STATES.LISTENING || currentState === SANTA_STATES.SPEAKING ||
          isSpeakingState(currentState)) && (
          <>
            <VideoPlayer
              currentVideo={currentVideo}
              onVideoEnd={handleVideoEnd}
              onPlay={handleVideoPlay}
              onStop={handleVideoStop}
              className="fullscreen-video"
              testMode={DISABLE_GENERATION}
              onTestVideoChange={handleTestVideoChange}
            />

            {showGlitch && (
              <div className="glitch-overlay">
                <video
                  ref={glitchVideoRef}
                  src={getVideoUrl('glitch.mp4')}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  className="glitch-video"
                />
              </div>
            )}

            <div className="conversation-screen">
              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <div className="call-status">
                {voiceRecorder.isListening && !isSantaSpeaking && !isRequestPending && (
                  <div className="listening-indicator">
                    <p>{voiceRecorder.isRecording ? 'Vorbesti...' : 'Te ascult'}</p>
                  </div>
                )}
                {isSantaSpeaking && (
                  <div className="speaking-indicator">
                    <p>Mos Craciun vorbeste</p>
                  </div>
                )}
                {isRequestPending && !isSantaSpeaking && (
                  <div className="processing-indicator">
                    <p>Se proceseaza...</p>
                  </div>
                )}
              </div>

            </div>

            <button className="end-call-button" onClick={endCall}>
              <FaPhoneSlash />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
