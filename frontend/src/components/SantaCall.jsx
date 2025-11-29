import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { FaPhone, FaPhoneSlash } from 'react-icons/fa';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { useConversationFlow, FLOW_STATES, FLOW_EVENTS, APP_MODES } from '../hooks/useConversationFlow';
import { api } from '../services/api';
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
  playBase64Audio,
  playPredefinedAudio
} from '../utils/audioManager';
import { getAudioUrl, getVideoUrl } from '../constants/assetsConfig';
import mosulImage from '../assets/mosul.png';
import './SantaCall.css';

// Informatii despre copil - parintele completeaza aici toate detaliile
const CHILD_INFO = "Razvan, 7 ani, ii place sa faca muzica si are o prietena Livia. Liviei ii placa sa faca designuri de site-uri web si sa calatoreasca, in special in Olanda. De asemenea ii place foarte mult sa se ingrijeasca plantele. Are o cațelușă in curtea vecina numita Melissa. De asemenea si Razvan are o cațelușă portocalie cu care se joaca la scara blocului.";

// LocalStorage key pentru salvarea starii conversatiei
const STORAGE_KEY = 'santaCallState';

export const SantaCall = () => {
  // Detectam modul din URL (?mode=marketing)
  const appMode = useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const modeParam = urlParams.get('mode');
    if (modeParam === 'marketing') {
      console.log('[MODE] Marketing mode activated');
      return APP_MODES.MARKETING;
    }
    return APP_MODES.NORMAL;
  }, []);

  // Flow state machine (cu modul detectat)
  const flow = useConversationFlow(appMode);

  // UI state
  const [conversationHistory, setConversationHistory] = useState([]);
  const [error, setError] = useState(null);
  const [showGlitch, setShowGlitch] = useState(false);
  const [hasSavedSession, setHasSavedSession] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Refs
  const voiceRecorderRef = useRef(null);
  const audioControlRef = useRef(null);
  const glitchTimeoutRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const isProcessingRef = useRef(false);
  const currentPlayingAudioRef = useRef(null); // Track currently playing audio to avoid double playback
  const prevFlowStateRef = useRef(null); // Track previous flow state for logging
  const processConversationRef = useRef(null); // Ref for processConversation to avoid effect re-runs
  const abortControllerRef = useRef(null); // AbortController for cancelling API calls
  const sttInProgressRef = useRef(false); // Prevent double STT calls

  // Audio sources
  const ambienceSrc = getAudioUrl('ambience.mp3');
  const ringtoneSrc = getAudioUrl('suna.mp3');

  // ============================================
  // TIMER
  // ============================================
  const startTimer = useCallback(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setElapsedTime(0);
    timerIntervalRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setElapsedTime(0);
  }, []);

  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // ============================================
  // GLITCH EFFECT
  // ============================================
  const startGlitchTimer = useCallback(() => {
    if (glitchTimeoutRef.current) clearTimeout(glitchTimeoutRef.current);
    glitchTimeoutRef.current = setTimeout(() => {
      setShowGlitch(true);
    }, 4000);
  }, []);

  const stopGlitch = useCallback(() => {
    if (glitchTimeoutRef.current) {
      clearTimeout(glitchTimeoutRef.current);
      glitchTimeoutRef.current = null;
    }
    setShowGlitch(false);
  }, []);

  // ============================================
  // AMBIENCE
  // ============================================
  const startAmbience = useCallback(() => {
    startAmbienceAudio(ambienceSrc);
  }, [ambienceSrc]);

  const stopAmbience = useCallback(() => {
    stopAmbienceAudio();
  }, []);

  // ============================================
  // AUDIO PLAYBACK
  // ============================================
  const audioIdCounterRef = useRef(0);

  const playTTSAudio = useCallback(async (base64Audio) => {
    // Generate unique ID for this audio (avoid comparing long base64 strings)
    const audioId = `tts_${++audioIdCounterRef.current}`;

    // Avoid double playback - check if we're already playing something
    if (currentPlayingAudioRef.current && audioControlRef.current) {
      console.log('[AUDIO] Audio already playing, stopping previous');
      audioControlRef.current.stop();
    }

    console.log('[AUDIO] Playing TTS audio, id:', audioId);
    stopGlitch();
    currentPlayingAudioRef.current = audioId;

    const control = await playBase64Audio(base64Audio, () => {
      // Only trigger ended if this is still the current audio
      if (currentPlayingAudioRef.current === audioId) {
        console.log('[AUDIO] TTS audio ended');
        audioControlRef.current = null;
        currentPlayingAudioRef.current = null;
        flow.transition(FLOW_EVENTS.AUDIO_ENDED, { audioType: 'tts' });
      }
    });

    audioControlRef.current = control;
  }, [stopGlitch, flow]);

  const playPredefinedAudioFile = useCallback(async (audioFileName) => {
    // Generate unique ID for this audio
    const audioId = `predefined_${audioFileName}_${++audioIdCounterRef.current}`;

    // Avoid double playback - check if we're already playing the same file
    if (currentPlayingAudioRef.current?.startsWith(`predefined_${audioFileName}`)) {
      console.log('[AUDIO] Predefined audio already playing, skipping');
      return;
    }

    console.log('[AUDIO] Playing predefined audio:', audioFileName);
    stopGlitch();
    currentPlayingAudioRef.current = audioId;

    const audioUrl = getAudioUrl(audioFileName);
    await playPredefinedAudio(audioUrl, () => {
      // Only trigger ended if this is still the current audio
      if (currentPlayingAudioRef.current === audioId) {
        console.log('[AUDIO] Predefined audio ended');
        currentPlayingAudioRef.current = null;
        flow.transition(FLOW_EVENTS.AUDIO_ENDED, { audioType: 'predefined' });
      }
    });
  }, [stopGlitch, flow]);

  // ============================================
  // STORAGE (moved before processConversation)
  // ============================================
  const saveStateToStorage = useCallback((history, agendaIdx, childSt, summary) => {
    try {
      const state = {
        conversationHistory: history,
        agendaIndex: agendaIdx,
        childState: childSt,
        conversationSummary: summary,
        playedVideos: flow.getPlayedVideos(),
        callStartTime: timerIntervalRef.current ? Date.now() - (elapsedTime * 1000) : null,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[STORAGE] Save failed:', e.message);
    }
  }, [flow, elapsedTime]);

  const loadStateFromStorage = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return null;

      const state = JSON.parse(saved);
      const ONE_HOUR = 60 * 60 * 1000;
      if (Date.now() - state.timestamp > ONE_HOUR) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return state;
    } catch (e) {
      return null;
    }
  }, []);

  const clearStateFromStorage = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // ============================================
  // PROCESS CONVERSATION (STT -> GPT -> TTS)
  // ============================================
  const processConversation = useCallback(async (userText) => {
    if (isProcessingRef.current) {
      console.log('[PROCESS] Already processing, skipping');
      return;
    }

    isProcessingRef.current = true;
    setError(null);
    startGlitchTimer();

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const currentStep = flow.getCurrentStep();
    // IMPORTANT: Store step ID BEFORE API calls - agenda may advance while we wait
    const stepIdAtRequest = currentStep?.id;
    console.log('[PROCESS] Processing for step:', stepIdAtRequest);

    try {
      // Call GPT with timeout
      const chatPromise = api.chat(
        userText,
        conversationHistory,
        appMode === APP_MODES.MARKETING ? null : CHILD_INFO, // Nu trimitem childInfo in marketing mode
        flow.getSummary(),
        currentStep?.id,
        currentStep?.prompt,
        flow.childState,
        appMode // Transmitem modul la API
      );

      // Timeout after 30 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('GPT timeout - raspunsul dureaza prea mult')), 30000);
      });

      const chatResponse = await Promise.race([chatPromise, timeoutPromise]);

      // Check if aborted
      if (signal.aborted) {
        console.log('[PROCESS] Aborted after GPT, stopping');
        return;
      }

      const {
        message: santaResponse,
        summary = '',
        childState: newChildState,
        readyForNext = true,
        skipVideo = false
      } = chatResponse;

      // Validate response
      if (!santaResponse || santaResponse.trim().length === 0) {
        throw new Error('GPT a returnat un raspuns gol');
      }

      console.log('[PROCESS] GPT response:', santaResponse);
      console.log('[PROCESS] readyForNext:', readyForNext, 'skipVideo:', skipVideo);

      // Update conversation history
      const newHistory = [
        ...conversationHistory,
        { role: 'user', content: userText },
        { role: 'assistant', content: santaResponse }
      ].slice(-20);
      setConversationHistory(newHistory);

      // Save to localStorage
      saveStateToStorage(newHistory, flow.agendaIndex, flow.childState, summary);

      // Check if aborted before TTS
      if (signal.aborted) {
        console.log('[PROCESS] Aborted before TTS, stopping');
        return;
      }

      // Call TTS with timeout
      const ttsPromise = api.textToSpeech(santaResponse);
      const ttsTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('TTS timeout - audio-ul dureaza prea mult')), 20000);
      });

      const { audio } = await Promise.race([ttsPromise, ttsTimeoutPromise]);

      // Check if aborted after TTS
      if (signal.aborted) {
        console.log('[PROCESS] Aborted after TTS, stopping');
        return;
      }

      stopGlitch();
      isProcessingRef.current = false;
      abortControllerRef.current = null;

      // Verify call is still active before transitioning
      if (flow.flowState === FLOW_STATES.IDLE || flow.flowState === FLOW_STATES.ENDED) {
        console.log('[PROCESS] Call ended during processing, not transitioning');
        return;
      }

      // Transition to SPEAKING state
      // Pass stepIdAtRequest so video is queued for the ORIGINAL step, not the current one
      flow.transition(FLOW_EVENTS.GPT_RESPONDED, {
        audio,
        speakingState: currentStep?.speakingState,
        readyForNext,
        skipVideo,
        summary,
        childState: newChildState,
        stepId: stepIdAtRequest // Track which step this response is for
      });

    } catch (err) {
      // Ignore abort errors
      if (err.name === 'AbortError' || signal.aborted) {
        console.log('[PROCESS] Request aborted');
        return;
      }

      console.error('[PROCESS] Error:', err);
      setError(err.message);
      stopGlitch();
      isProcessingRef.current = false;
      abortControllerRef.current = null;

      // Only go back to listening if call is still active
      if (flow.flowState !== FLOW_STATES.IDLE && flow.flowState !== FLOW_STATES.ENDED) {
        flow.transition(FLOW_EVENTS.GO_TO_LISTENING);
      }
    }
  }, [conversationHistory, flow, startGlitchTimer, stopGlitch, saveStateToStorage]);

  // Keep ref updated for use in effects (avoids re-running effects when history changes)
  useEffect(() => {
    processConversationRef.current = processConversation;
  }, [processConversation]);

  // ============================================
  // VOICE RECORDER CALLBACK
  // ============================================
  const handleRecordingComplete = useCallback(async (audioBlob) => {
    console.log('[VOICE] Recording complete, blob size:', audioBlob?.size);

    // Prevent double STT calls
    if (sttInProgressRef.current) {
      console.log('[VOICE] STT already in progress, ignoring');
      return;
    }

    if (flow.flowState !== FLOW_STATES.LISTENING) {
      console.log('[VOICE] Not in listening state, ignoring');
      return;
    }

    const MIN_BLOB_SIZE = 5000;
    if (audioBlob?.size < MIN_BLOB_SIZE) {
      console.log('[VOICE] Recording too small, ignoring');
      return;
    }

    sttInProgressRef.current = true;

    try {
      // Call STT with timeout
      const sttPromise = api.speechToText(audioBlob);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('STT timeout')), 15000);
      });

      const { text } = await Promise.race([sttPromise, timeoutPromise]);
      console.log('[VOICE] STT result:', text);

      sttInProgressRef.current = false;

      // Verify we're still in listening state (could have changed during STT)
      if (flow.flowState !== FLOW_STATES.LISTENING) {
        console.log('[VOICE] State changed during STT, ignoring result');
        return;
      }

      if (!text || text.trim().length === 0) {
        // No text - stay in listening
        console.log('[VOICE] No text from STT, staying in listening');
        return;
      }

      // Filter hallucinations
      const lowerText = text.toLowerCase();
      const hallucinations = ['subscribe', 'like and subscribe', 'thanks for watching', 'abonați', 'dați like'];
      if (hallucinations.some(h => lowerText.includes(h))) {
        console.log('[VOICE] Ignoring hallucination:', text);
        return;
      }

      // NOW transition with the message - state machine will handle the rest
      // This stores the message in pendingUserMessageRef and decides next state
      flow.transition(FLOW_EVENTS.USER_SPOKE, { message: text });

      // NOTE: Nu mai apelam processConversation aici!
      // Effect-ul va apela processConversation cand flowState devine PROCESSING
      // si needsAutoInitiate este true, folosind mesajul din pendingUserMessageRef

    } catch (err) {
      sttInProgressRef.current = false;

      // Ignore timeout if call ended
      if (flow.flowState === FLOW_STATES.IDLE || flow.flowState === FLOW_STATES.ENDED) {
        return;
      }

      console.error('[VOICE] STT error:', err);
      setError(err.message);
      // Stay in listening on error (don't transition)
    }
  }, [flow]);

  const voiceRecorder = useVoiceRecorder({
    onRecordingComplete: handleRecordingComplete,
    // VAD parameters - detectie inteligenta a vorbirii
    positiveSpeechThreshold: 0.5, // Cat de sigur trebuie sa fie ca e vorbire
    negativeSpeechThreshold: 0.35, // Sub ce nivel consideram ca nu mai e vorbire
    redemptionFrames: 8, // Cate frame-uri de non-vorbire pana oprim (~480ms)
  });

  // Save ref
  useEffect(() => {
    voiceRecorderRef.current = voiceRecorder;
  }, [voiceRecorder]);

  // ============================================
  // VIDEO HANDLERS
  // ============================================
  const handleVideoEnd = useCallback((videoName) => {
    console.log('[VIDEO] Ended:', videoName);
    flow.transition(FLOW_EVENTS.VIDEO_ENDED, { videoName });
  }, [flow]);

  const handleVideoPlay = useCallback((videoName) => {
    console.log('[VIDEO] Started:', videoName);

    if (videoName === 'intro') {
      startAmbience();
    }
    // Audio playback is now handled by useEffect below to avoid race conditions
  }, [startAmbience]);

  // Check for saved session on mount
  useEffect(() => {
    const saved = loadStateFromStorage();
    if (saved?.conversationHistory?.length > 0) {
      setHasSavedSession(true);
    }
  }, [loadStateFromStorage]);

  // ============================================
  // CALL CONTROLS
  // ============================================
  const unlockMediaPlayback = useCallback(async () => {
    console.log('[MOBILE] Unlocking media playback...');
    setAmbienceSrc(ambienceSrc);
    setRingtoneSrc(ringtoneSrc);
    await unlockAudio();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
    } catch (e) {
      console.warn('[MOBILE] Microphone permission failed:', e.message);
    }

    await unlockAudio();
  }, [ambienceSrc, ringtoneSrc]);

  // Restore session from localStorage
  const restoreSession = useCallback(async () => {
    const saved = loadStateFromStorage();
    if (!saved) return false;

    console.log('[STORAGE] Restoring session:', saved);

    try {
      await unlockMediaPlayback();

      // Restore conversation history
      if (saved.conversationHistory) {
        setConversationHistory(saved.conversationHistory);
      }

      // Restore flow state
      if (saved.agendaIndex !== undefined) {
        flow.setAgendaIndex(saved.agendaIndex);
      }
      if (saved.childState) {
        flow.setChildState(saved.childState);
      }
      if (saved.playedVideos) {
        flow.setPlayedVideos(saved.playedVideos);
      }
      if (saved.conversationSummary) {
        flow.updateSummary(saved.conversationSummary);
      }

      // Restore timer from callStartTime or start fresh
      if (saved.callStartTime) {
        const elapsed = Math.floor((Date.now() - saved.callStartTime) / 1000);
        setElapsedTime(elapsed);
      } else {
        // No callStartTime saved (old session format) - start from 0
        setElapsedTime(0);
      }
      // Always start the timer interval
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);

      // Start ambience and go to listening state
      startAmbience();
      flow.transition(FLOW_EVENTS.GO_TO_LISTENING);

      setHasSavedSession(false);
      setError(null);
      isProcessingRef.current = false;
      currentPlayingAudioRef.current = null;

      console.log('[STORAGE] Session restored successfully');
      return true;
    } catch (err) {
      console.error('[STORAGE] Restore failed:', err);
      clearStateFromStorage();
      setHasSavedSession(false);
      return false;
    }
  }, [loadStateFromStorage, unlockMediaPlayback, flow, startAmbience, clearStateFromStorage]);

  const startCall = useCallback(async () => {
    // Allow starting from IDLE or ENDED states
    if (flow.flowState !== FLOW_STATES.IDLE && flow.flowState !== FLOW_STATES.ENDED) return;

    try {
      await unlockMediaPlayback();

      clearStateFromStorage();
      setHasSavedSession(false);
      setConversationHistory([]);
      setError(null);
      isProcessingRef.current = false;
      currentPlayingAudioRef.current = null;

      // Start flow
      flow.transition(FLOW_EVENTS.START_CALL);

      // Play ringtone
      playRingtoneAudio();
      await new Promise(resolve => setTimeout(resolve, 2000));
      stopRingtoneAudio();

      // Transition to intro
      flow.transition(FLOW_EVENTS.RINGTONE_ENDED);

      // Start timer
      startTimer();

    } catch (err) {
      console.error('[CALL] Start failed:', err);
      setError(err.message);
      flow.reset();
    }
  }, [flow, unlockMediaPlayback, clearStateFromStorage, startTimer]);

  const endCall = useCallback(() => {
    console.log('[CALL] Ending call');

    // Cancel any pending API calls
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (voiceRecorderRef.current) {
      voiceRecorderRef.current.stopListening();
    }
    if (audioControlRef.current) {
      audioControlRef.current.stop();
      audioControlRef.current = null;
    }

    stopRingtoneAudio();
    stopGlitch();
    stopAmbience();
    stopTimer();
    clearStateFromStorage();

    // Transition to ENDED state (shows "Apel incheiat" screen)
    // START_CALL will reset everything when user starts a new call
    flow.transition(FLOW_EVENTS.END_CALL);

    setConversationHistory([]);
    setError(null);
    setHasSavedSession(false);
    isProcessingRef.current = false;
    currentPlayingAudioRef.current = null;
    sttInProgressRef.current = false;
  }, [flow, stopGlitch, stopAmbience, stopTimer, clearStateFromStorage]);

  // ============================================
  // EFFECTS - React to flow state changes
  // ============================================

  // Handle flow state changes
  // IMPORTANT: Only execute actions when state ACTUALLY changes, not on every re-render
  useEffect(() => {
    const stateChanged = prevFlowStateRef.current !== flow.flowState;

    // Only execute actions when state changes
    if (!stateChanged) {
      return;
    }

    console.log('[EFFECT] Flow state changed:', prevFlowStateRef.current, '->', flow.flowState, 'needsAutoInitiate:', flow.needsAutoInitiate);
    prevFlowStateRef.current = flow.flowState;

    switch (flow.flowState) {
      case FLOW_STATES.LISTENING:
        // Start microphone
        if (voiceRecorderRef.current) {
          voiceRecorderRef.current.startListening().catch(err => {
            console.error('[EFFECT] Failed to start microphone:', err);
            setError('Nu am putut porni microfonul.');
          });
        }
        break;

      case FLOW_STATES.PROCESSING:
        // Stop microphone
        if (voiceRecorderRef.current) {
          voiceRecorderRef.current.stopListening();
        }
        // If auto-initiate, call GPT using the pending user message
        if (flow.needsAutoInitiate) {
          const pendingMessage = flow.getPendingUserMessage();
          const messageToSend = pendingMessage || '[Mosul incepe sa vorbeasca]';
          console.log('[EFFECT] Auto-initiating GPT call with message:', messageToSend);
          flow.clearPendingUserMessage(); // Clear after getting
          // Use ref to avoid effect re-runs when conversationHistory changes
          if (processConversationRef.current) {
            processConversationRef.current(messageToSend);
          }
        }
        break;

      case FLOW_STATES.PLAYING_SPECIAL_VIDEO:
        // Stop microphone
        if (voiceRecorderRef.current) {
          voiceRecorderRef.current.stopListening();
        }
        break;

      case FLOW_STATES.SPEAKING:
        // Stop microphone and play TTS audio
        if (voiceRecorderRef.current) {
          voiceRecorderRef.current.stopListening();
        }
        // Play TTS audio when entering SPEAKING state
        if (flow.currentAudio && flow.currentAudioType === 'tts') {
          playTTSAudio(flow.currentAudio);
        }
        break;

      case FLOW_STATES.PLAYING_PREDEFINED_AUDIO:
        // Stop microphone and play predefined audio
        if (voiceRecorderRef.current) {
          voiceRecorderRef.current.stopListening();
        }
        // Play predefined audio when entering this state
        if (flow.currentAudio) {
          playPredefinedAudioFile(flow.currentAudio);
        }
        break;

      case FLOW_STATES.ENDED:
        // Call ended - stop ambience and clear session
        stopAmbience();
        clearStateFromStorage(); // Don't show "resume conversation" after normal end
        break;

      default:
        break;
    }
  }, [flow.flowState, flow.currentAudio, flow.currentAudioType, flow.needsAutoInitiate, playTTSAudio, playPredefinedAudioFile, stopAmbience, clearStateFromStorage]);

  // Mute/unmute ambience based on recording state
  // Ambianta porneste cand incepe INTRO (din handleVideoPlay) si ramane la 0.3
  // Se face mute DOAR cand microfonul inregistreaza
  useEffect(() => {
    // In IDLE, ENDED sau CALLING - ambianta e muted (inca nu a inceput intro)
    const shouldBeMuted =
      flow.flowState === FLOW_STATES.IDLE ||
      flow.flowState === FLOW_STATES.ENDED ||
      flow.flowState === FLOW_STATES.CALLING;

    if (shouldBeMuted) {
      muteAmbienceAudio();
      return;
    }

    // In restul starilor, ambianta e la 0.3, DAR muted cand inregistram
    if (voiceRecorder.isRecording) {
      console.log('[AMBIENCE] Muting - microphone recording');
      muteAmbienceAudio();
    } else {
      console.log('[AMBIENCE] Unmuting to 0.3');
      unmuteAmbienceAudio(0.3);
    }
  }, [voiceRecorder.isRecording, flow.flowState]);

  // Auto-save state periodically during active call (every 30 seconds)
  useEffect(() => {
    const callActive = flow.flowState !== FLOW_STATES.IDLE && flow.flowState !== FLOW_STATES.ENDED;
    if (!callActive) return;

    const autoSaveInterval = setInterval(() => {
      if (conversationHistory.length > 0) {
        console.log('[STORAGE] Auto-saving state...');
        saveStateToStorage(
          conversationHistory,
          flow.agendaIndex,
          flow.childState,
          flow.getSummary()
        );
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [flow.flowState, conversationHistory, flow, saveStateToStorage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (voiceRecorderRef.current) voiceRecorderRef.current.stopListening();
      if (audioControlRef.current) audioControlRef.current.stop();
      if (glitchTimeoutRef.current) clearTimeout(glitchTimeoutRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
      stopAmbienceAudio();
    };
  }, []);

  // ============================================
  // RENDER
  // ============================================
  const isCallActive = flow.flowState !== FLOW_STATES.IDLE && flow.flowState !== FLOW_STATES.ENDED;
  const isSpeaking = flow.flowState === FLOW_STATES.SPEAKING || flow.flowState === FLOW_STATES.PLAYING_PREDEFINED_AUDIO;

  // Determina clasa de glow pentru container
  // Verde: microfonul inregistreaza (utilizatorul vorbeste)
  // Rosu: orice alta actiune in timpul apelului (Mosul vorbeste, procesare, video, etc.)
  // Albastru subtil: LISTENING (asteptam sa vorbeasca utilizatorul)
  const getGlowClass = () => {
    if (voiceRecorder.isRecording) {
      return 'glow-green';
    }
    if (isCallActive && flow.flowState === FLOW_STATES.LISTENING) {
      return 'glow-blue'; // Waiting for user to speak
    }
    if (isCallActive && flow.flowState !== FLOW_STATES.LISTENING) {
      return 'glow-red';
    }
    return '';
  };

  return (
    <div className="santa-call">
      {/* Timer */}
      {isCallActive && (
        <div className="call-timer">{formatTime(elapsedTime)}</div>
      )}

      <div className={`santa-call-container ${getGlowClass()}`}>
        {/* IDLE State */}
        {flow.flowState === FLOW_STATES.IDLE && (
          <div className="idle-screen">
            <h1 className="app-title">Suna-l pe Mos Craciun!</h1>
            <div className="call-button-wrapper">
              <button className="call-button start" onClick={startCall}>
                <FaPhone />
              </button>
            </div>
            {hasSavedSession && (
              <div className="resume-options">
                <p className="resume-hint">Ai o conversatie salvata</p>
                <button className="resume-call-button" onClick={restoreSession}>
                  Reia conversatia
                </button>
                <button className="new-call-link" onClick={() => {
                  clearStateFromStorage();
                  setHasSavedSession(false);
                }}>
                  Incepe conversatie noua
                </button>
              </div>
            )}
          </div>
        )}

        {/* CALLING State */}
        {flow.flowState === FLOW_STATES.CALLING && (
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

        {/* INTRO State */}
        {flow.flowState === FLOW_STATES.INTRO && (
          <>
            <VideoPlayer
              currentVideo={flow.currentVideo}
              onVideoEnd={handleVideoEnd}
              onPlay={handleVideoPlay}
              className="fullscreen-video"
            />
            <button className="end-call-button" onClick={endCall}>
              <FaPhoneSlash />
            </button>
          </>
        )}

        {/* Active conversation states */}
        {(flow.flowState === FLOW_STATES.LISTENING ||
          flow.flowState === FLOW_STATES.PROCESSING ||
          flow.flowState === FLOW_STATES.SPEAKING ||
          flow.flowState === FLOW_STATES.PLAYING_PREDEFINED_AUDIO ||
          flow.flowState === FLOW_STATES.PLAYING_SPECIAL_VIDEO) && (
          <>
            <VideoPlayer
              currentVideo={flow.currentVideo}
              onVideoEnd={handleVideoEnd}
              onPlay={handleVideoPlay}
              className="fullscreen-video"
            />

            {/* Glitch overlay */}
            {showGlitch && (
              <div className="glitch-overlay">
                <video
                  src={getVideoUrl('glitch.mp4')}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="glitch-video"
                />
              </div>
            )}

            {/* Status indicators */}
            <div className="conversation-screen">
              {error && <div className="error-message">{error}</div>}

              <div className="call-status">
                {flow.flowState === FLOW_STATES.LISTENING && voiceRecorder.isListening && (
                  <div className="listening-indicator">
                    <p>{voiceRecorder.isRecording ? 'Vorbesti...' : 'Te ascult'}</p>
                  </div>
                )}
                {isSpeaking && (
                  <div className="speaking-indicator">
                    <p>Mos Craciun vorbeste</p>
                  </div>
                )}
                {flow.flowState === FLOW_STATES.PROCESSING && (
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

        {/* ENDED State */}
        {flow.flowState === FLOW_STATES.ENDED && (
          <div className="idle-screen">
            <h1 className="app-title">Apel incheiat</h1>
            <div className="call-button-wrapper">
              <button className="call-button start" onClick={startCall}>
                <FaPhone />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
