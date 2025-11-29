import { useState, useCallback, useRef, useMemo } from 'react';
import { SANTA_AGENDA, SANTA_AGENDA_MARKETING, AGENDA_SPECIAL_VIDEOS } from '../constants/santaAgenda';

// Modurile disponibile
export const APP_MODES = {
  NORMAL: 'normal',
  MARKETING: 'marketing',
};

/**
 * State Machine pentru conversatia cu Mos Craciun
 *
 * Flow-ul e controlat de un singur loc - nu mai avem logica imprastiata
 *
 * STARI:
 * - IDLE: Asteptam sa inceapa apelul
 * - CALLING: Suna telefonul
 * - INTRO: Ruleaza video-ul intro
 * - PLAYING_PREDEFINED_AUDIO: Reda audio predefinit (cu speaking video)
 * - PLAYING_SPECIAL_VIDEO: Reda video special (elfs, kids_list, flight, polulnord)
 * - LISTENING: Ascultam copilul
 * - PROCESSING: Procesam (STT -> GPT -> TTS)
 * - SPEAKING: Mosul vorbeste (TTS audio + speaking video)
 * - ENDED: Apelul s-a terminat
 *
 * EVENIMENTE:
 * - START_CALL: Utilizatorul apasa butonul
 * - RINGTONE_ENDED: S-a terminat sunetul de apel
 * - VIDEO_ENDED: S-a terminat un video
 * - AUDIO_ENDED: S-a terminat un audio (TTS sau predefinit)
 * - USER_SPOKE: Utilizatorul a vorbit (avem text de la STT)
 * - GPT_RESPONDED: GPT a raspuns (avem raspuns + audio TTS)
 * - TIMEOUT: S-a depasit timpul limita
 * - END_CALL: Utilizatorul inchide sau auto-end
 */

// Starile posibile
export const FLOW_STATES = {
  IDLE: 'IDLE',
  CALLING: 'CALLING',
  INTRO: 'INTRO',
  PLAYING_PREDEFINED_AUDIO: 'PLAYING_PREDEFINED_AUDIO',
  PLAYING_SPECIAL_VIDEO: 'PLAYING_SPECIAL_VIDEO',
  LISTENING: 'LISTENING',
  PROCESSING: 'PROCESSING',
  SPEAKING: 'SPEAKING',
  ENDED: 'ENDED',
};

// Evenimentele posibile
export const FLOW_EVENTS = {
  START_CALL: 'START_CALL',
  RINGTONE_ENDED: 'RINGTONE_ENDED',
  VIDEO_ENDED: 'VIDEO_ENDED',
  AUDIO_ENDED: 'AUDIO_ENDED',
  USER_SPOKE: 'USER_SPOKE',
  GPT_RESPONDED: 'GPT_RESPONDED',
  TIMEOUT: 'TIMEOUT',
  END_CALL: 'END_CALL',
  GO_TO_LISTENING: 'GO_TO_LISTENING', // Return to listening without side effects
};

export const useConversationFlow = (mode = APP_MODES.NORMAL) => {
  // Agenda activa bazata pe mod
  const activeAgenda = useMemo(() => {
    return mode === APP_MODES.MARKETING ? SANTA_AGENDA_MARKETING : SANTA_AGENDA;
  }, [mode]);

  // Starea curenta a flow-ului
  const [flowState, setFlowState] = useState(FLOW_STATES.IDLE);

  // Index-ul pasului curent in agenda
  const [agendaIndex, setAgendaIndex] = useState(0);

  // Informatii despre copil (de la GPT)
  const [childState, setChildState] = useState({
    childGender: null,
    childCount: null,
    childNames: [],
    childAges: [],
  });

  // Video-uri speciale in asteptare
  const pendingVideosRef = useRef([]);

  // Video-uri deja redate
  const playedVideosRef = useRef([]);

  // Sumar conversatie
  const summaryRef = useRef(null);

  // Timpul cand a inceput apelul
  const callStartTimeRef = useRef(null);

  // Flag pentru readyForNext de la GPT
  const readyForNextRef = useRef(true);

  // Mesajul user-ului in asteptare (pentru cand trebuie sa playam content predefinit inainte de GPT)
  const pendingUserMessageRef = useRef(null);

  // Starea speaking curenta (speaking_normal, speaking_amazed, etc)
  const [speakingState, setSpeakingState] = useState('speaking_normal');

  // Video-ul curent care trebuie redat
  const [currentVideo, setCurrentVideo] = useState(null);

  // Audio-ul curent care trebuie redat (base64 sau URL)
  const [currentAudio, setCurrentAudio] = useState(null);
  const [currentAudioType, setCurrentAudioType] = useState(null); // 'tts' sau 'predefined'

  // Flag pentru auto-initiate (Mosul vorbeste primul, fara sa astepte user-ul)
  const [needsAutoInitiate, setNeedsAutoInitiate] = useState(false);

  // Obtine pasul curent din agenda
  const getCurrentStep = useCallback(() => {
    if (agendaIndex >= 0 && agendaIndex < activeAgenda.length) {
      return activeAgenda[agendaIndex];
    }
    return null;
  }, [agendaIndex, activeAgenda]);

  // Obtine urmatorul pas din agenda (fara a modifica state-ul)
  const getNextStep = useCallback(() => {
    const currentIndex = agendaIndex;
    if (currentIndex >= 0 && currentIndex < activeAgenda.length - 1) {
      return activeAgenda[currentIndex + 1];
    }
    return null;
  }, [agendaIndex, activeAgenda]);

  // Avanseaza la urmatorul pas din agenda
  const advanceAgenda = useCallback(() => {
    setAgendaIndex(prev => {
      const next = prev + 1;
      if (next < activeAgenda.length) {
        console.log('[FLOW] Advancing agenda to step', next, ':', activeAgenda[next].id);
        return next;
      }
      console.log('[FLOW] Already at last step');
      return prev;
    });
  }, [activeAgenda]);

  // Sare la un pas specific
  const goToStep = useCallback((stepId) => {
    const index = activeAgenda.findIndex(step => step.id === stepId);
    if (index !== -1) {
      console.log('[FLOW] Jumping to step', index, ':', stepId);
      setAgendaIndex(index);
    }
  }, [activeAgenda]);

  // Verifica daca un video a fost redat
  const isVideoPlayed = useCallback((videoName) => {
    return playedVideosRef.current.includes(videoName);
  }, []);

  // Marcheaza un video ca redat
  const markVideoPlayed = useCallback((videoName) => {
    if (!playedVideosRef.current.includes(videoName)) {
      playedVideosRef.current.push(videoName);
    }
  }, []);

  // Adauga video la coada de pending
  const queueVideo = useCallback((videoName) => {
    if (!pendingVideosRef.current.includes(videoName)) {
      pendingVideosRef.current.push(videoName);
      console.log('[FLOW] Queued video:', videoName);
    }
  }, []);

  // Scoate urmatorul video din coada
  const dequeueVideo = useCallback(() => {
    if (pendingVideosRef.current.length > 0) {
      const video = pendingVideosRef.current.shift();
      markVideoPlayed(video);
      return video;
    }
    return null;
  }, [markVideoPlayed]);

  // Verifica daca mai sunt video-uri in coada
  const hasQueuedVideos = useCallback(() => {
    return pendingVideosRef.current.length > 0;
  }, []);

  // Actualizeaza sumarul
  const updateSummary = useCallback((summary) => {
    summaryRef.current = summary;
  }, []);

  // Obtine sumarul
  const getSummary = useCallback(() => {
    return summaryRef.current;
  }, []);

  // Actualizeaza child state
  const updateChildState = useCallback((newState) => {
    if (newState) {
      setChildState(prev => ({ ...prev, ...newState }));
    }
  }, []);

  // Calculeaza timpul scurs
  const getElapsedTime = useCallback(() => {
    if (!callStartTimeRef.current) return 0;
    return Math.floor((Date.now() - callStartTimeRef.current) / 1000);
  }, []);

  /**
   * FUNCTIA PRINCIPALA DE TRANZITIE
   *
   * Primeste un eveniment si decide ce stare urmeaza
   * Toata logica de flow e AICI - nu mai e imprastiata
   */
  const transition = useCallback((event, payload = {}) => {
    console.log('[FLOW] Event:', event, 'Current state:', flowState, 'Payload:', payload);

    const currentStep = getCurrentStep();
    const nextStep = getNextStep();

    switch (event) {
      case FLOW_EVENTS.START_CALL:
        callStartTimeRef.current = Date.now();
        pendingVideosRef.current = [];
        playedVideosRef.current = [];
        summaryRef.current = null;
        readyForNextRef.current = true;
        setAgendaIndex(0);
        setChildState({ childGender: null, childCount: null, childNames: [], childAges: [] });
        setFlowState(FLOW_STATES.CALLING);
        setCurrentVideo(null);
        setCurrentAudio(null);
        setCurrentAudioType(null);
        break;

      case FLOW_EVENTS.RINGTONE_ENDED:
        setFlowState(FLOW_STATES.INTRO);
        setCurrentVideo('intro');
        break;

      case FLOW_EVENTS.VIDEO_ENDED: {
        const videoName = payload.videoName;
        console.log('[FLOW] Video ended:', videoName);

        // Daca e intro
        if (videoName === 'intro') {
          // Verificam shouldListenOnComplete al pasului CURENT (intro)
          // IMPORTANT: NU avansam daca trebuie sa ascultam - USER_SPOKE va avansa
          const shouldListen = currentStep?.shouldListenOnComplete !== false;

          if (shouldListen) {
            // Ascultam user-ul - NU avansam inca, USER_SPOKE va face asta
            console.log('[FLOW] Intro ended, waiting for user to speak');
            setCurrentVideo('listening');
            setFlowState(FLOW_STATES.LISTENING);
          } else {
            // Nu ascultam, avanseaza si verifica urmatorul pas
            advanceAgenda();

            if (nextStep?.audio && !nextStep?.prompt) {
              // Urmatorul pas are audio predefinit
              console.log('[FLOW] Next step has predefined audio:', nextStep.id);
              setSpeakingState(nextStep.speakingState || 'speaking_normal');
              setCurrentVideo(nextStep.speakingState || 'speaking_normal');
              setCurrentAudio(nextStep.audio);
              setCurrentAudioType('predefined');
              setFlowState(FLOW_STATES.PLAYING_PREDEFINED_AUDIO);
            } else if (nextStep?.prompt) {
              // Urmatorul pas are prompt - auto-initiate GPT
              console.log('[FLOW] Auto-initiating GPT for:', nextStep.id);
              setCurrentVideo('listening');
              setNeedsAutoInitiate(true);
              setFlowState(FLOW_STATES.PROCESSING);
            } else {
              // Default - ascultam
              setCurrentVideo('listening');
              setFlowState(FLOW_STATES.LISTENING);
            }
          }
          break;
        }

        // Daca e video special
        if (AGENDA_SPECIAL_VIDEOS.includes(videoName)) {
          // Mai sunt video-uri in coada?
          if (hasQueuedVideos()) {
            const nextVideo = dequeueVideo();
            console.log('[FLOW] Playing next queued video:', nextVideo);
            setCurrentVideo(nextVideo);
            setFlowState(FLOW_STATES.PLAYING_SPECIAL_VIDEO);
          } else {
            // Nu mai sunt - verificam shouldListenOnComplete al pasului CURENT
            const shouldListen = currentStep?.shouldListenOnComplete !== false;

            if (shouldListen) {
              // Ascultam user-ul pe pasul curent
              setCurrentVideo('listening');
              setFlowState(FLOW_STATES.LISTENING);
            } else {
              // Nu ascultam - avanseaza si auto-initiate
              advanceAgenda();
              const stepAfterVideo = nextStep;

              if (stepAfterVideo?.audio && !stepAfterVideo?.prompt) {
                console.log('[FLOW] Next step has predefined audio:', stepAfterVideo.id);
                setSpeakingState(stepAfterVideo.speakingState || 'speaking_normal');
                setCurrentVideo(stepAfterVideo.speakingState || 'speaking_normal');
                setCurrentAudio(stepAfterVideo.audio);
                setCurrentAudioType('predefined');
                setFlowState(FLOW_STATES.PLAYING_PREDEFINED_AUDIO);
              } else if (stepAfterVideo?.prompt) {
                // Auto-initiate GPT
                console.log('[FLOW] Auto-initiating GPT for:', stepAfterVideo.id);
                setCurrentVideo('listening');
                setNeedsAutoInitiate(true);
                setFlowState(FLOW_STATES.PROCESSING);
              } else {
                setCurrentVideo('listening');
                setFlowState(FLOW_STATES.LISTENING);
              }
            }
          }
          break;
        }

        // Video speaking nu ar trebui sa se termine (e loop)
        // Daca totusi se termina, e o eroare - revenim la listening
        console.warn('[FLOW] Unexpected video end:', videoName);
        setCurrentVideo('listening');
        setFlowState(FLOW_STATES.LISTENING);
        break;
      }

      case FLOW_EVENTS.AUDIO_ENDED: {
        const audioType = payload.audioType || currentAudioType;
        console.log('[FLOW] Audio ended, type:', audioType);

        // IMPORTANT: currentStep e pasul CURENT (inainte de advance)
        // nextStep e pasul URMATOR (calculat la inceputul transition)

        if (audioType === 'predefined') {
          // Audio predefinit s-a terminat
          // Verificam daca pasul curent are video special
          if (currentStep?.video && AGENDA_SPECIAL_VIDEOS.includes(currentStep.video)) {
            if (!isVideoPlayed(currentStep.video)) {
              queueVideo(currentStep.video);
            }
          }

          // Mai sunt video-uri in coada?
          if (hasQueuedVideos()) {
            const video = dequeueVideo();
            console.log('[FLOW] Playing queued video after predefined audio:', video);
            setCurrentVideo(video);
            setCurrentAudio(null);
            setCurrentAudioType(null);
            setFlowState(FLOW_STATES.PLAYING_SPECIAL_VIDEO);
          } else {
            // Verificam shouldListenOnComplete al pasului CURENT
            const shouldListen = currentStep?.shouldListenOnComplete !== false;

            // Auto-end call daca e configurat
            if (currentStep?.autoEndCall) {
              setCurrentAudio(null);
              setCurrentAudioType(null);
              setFlowState(FLOW_STATES.ENDED);
              break;
            }

            if (shouldListen) {
              // Ascultam user-ul pe pasul curent
              setCurrentVideo('listening');
              setCurrentAudio(null);
              setCurrentAudioType(null);
              setFlowState(FLOW_STATES.LISTENING);
            } else {
              // Nu ascultam - avanseaza si auto-initiate
              advanceAgenda();

              if (nextStep?.audio && !nextStep?.prompt) {
                console.log('[FLOW] Next step has predefined audio:', nextStep.id);
                setSpeakingState(nextStep.speakingState || 'speaking_normal');
                setCurrentVideo(nextStep.speakingState || 'speaking_normal');
                setCurrentAudio(nextStep.audio);
                setCurrentAudioType('predefined');
                setFlowState(FLOW_STATES.PLAYING_PREDEFINED_AUDIO);
              } else if (nextStep?.prompt) {
                console.log('[FLOW] Auto-initiating GPT for:', nextStep.id);
                setCurrentVideo('listening');
                setCurrentAudio(null);
                setCurrentAudioType(null);
                setNeedsAutoInitiate(true);
                setFlowState(FLOW_STATES.PROCESSING);
              } else {
                setCurrentVideo('listening');
                setCurrentAudio(null);
                setCurrentAudioType(null);
                setFlowState(FLOW_STATES.LISTENING);
              }
            }
          }
        } else {
          // TTS audio s-a terminat
          // NOTE: Video-ul special a fost deja adaugat la coada in GPT_RESPONDED
          // folosind originalStep (bazat pe stepId), NU currentStep care poate fi avansat

          // Mai sunt video-uri in coada?
          if (hasQueuedVideos()) {
            const video = dequeueVideo();
            console.log('[FLOW] Playing queued video after TTS:', video);
            setCurrentVideo(video);
            setCurrentAudio(null);
            setCurrentAudioType(null);
            setFlowState(FLOW_STATES.PLAYING_SPECIAL_VIDEO);
          } else {
            // Verificam auto-end
            if (currentStep?.autoEndCall) {
              setCurrentAudio(null);
              setCurrentAudioType(null);
              setFlowState(FLOW_STATES.ENDED);
              break;
            }

            // Verificam timeout (5 minute)
            const MAX_DURATION = 5 * 60;
            if (getElapsedTime() >= MAX_DURATION && currentStep?.isLooping) {
              goToStep('incheiere');
              setCurrentVideo('listening');
              setCurrentAudio(null);
              setCurrentAudioType(null);
              setFlowState(FLOW_STATES.LISTENING);
              break;
            }

            // Verificam daca GPT a zis ca putem avansa
            const canAdvance = readyForNextRef.current;

            // Pentru pasi multiTurn, verificam readyForNext pentru a decide daca avansam
            if (currentStep?.multiTurn) {
              if (canAdvance) {
                // GPT a zis ca putem trece la urmatorul pas
                console.log('[FLOW] MultiTurn step complete, advancing from:', currentStep.id);
                advanceAgenda();

                if (nextStep?.audio && !nextStep?.prompt) {
                  console.log('[FLOW] Next step has predefined audio:', nextStep.id);
                  setSpeakingState(nextStep.speakingState || 'speaking_normal');
                  setCurrentVideo(nextStep.speakingState || 'speaking_normal');
                  setCurrentAudio(nextStep.audio);
                  setCurrentAudioType('predefined');
                  setFlowState(FLOW_STATES.PLAYING_PREDEFINED_AUDIO);
                } else if (nextStep?.prompt) {
                  console.log('[FLOW] Auto-initiating GPT for:', nextStep.id);
                  setCurrentVideo('listening');
                  setCurrentAudio(null);
                  setCurrentAudioType(null);
                  setNeedsAutoInitiate(true);
                  setFlowState(FLOW_STATES.PROCESSING);
                } else {
                  setCurrentVideo('listening');
                  setCurrentAudio(null);
                  setCurrentAudioType(null);
                  setFlowState(FLOW_STATES.LISTENING);
                }
              } else {
                // GPT a zis sa mai stam - ascultam din nou pe acelasi pas
                console.log('[FLOW] MultiTurn step continuing, waiting for user on:', currentStep.id);
                readyForNextRef.current = true; // Reset pentru urmatorul ciclu
                setCurrentVideo('listening');
                setCurrentAudio(null);
                setCurrentAudioType(null);
                setFlowState(FLOW_STATES.LISTENING);
              }
              break;
            }

            // Verificam shouldListenOnComplete al pasului CURENT
            const shouldListen = currentStep?.shouldListenOnComplete !== false;

            if (shouldListen || currentStep?.isLooping) {
              // Ascultam user-ul pe pasul curent
              readyForNextRef.current = true; // Reset pentru urmatorul ciclu
              setCurrentVideo('listening');
              setCurrentAudio(null);
              setCurrentAudioType(null);
              setFlowState(FLOW_STATES.LISTENING);
            } else if (canAdvance) {
              // Nu ascultam - avanseaza si auto-initiate
              advanceAgenda();

              if (nextStep?.audio && !nextStep?.prompt) {
                console.log('[FLOW] Next step has predefined audio:', nextStep.id);
                setSpeakingState(nextStep.speakingState || 'speaking_normal');
                setCurrentVideo(nextStep.speakingState || 'speaking_normal');
                setCurrentAudio(nextStep.audio);
                setCurrentAudioType('predefined');
                setFlowState(FLOW_STATES.PLAYING_PREDEFINED_AUDIO);
              } else if (nextStep?.prompt) {
                console.log('[FLOW] Auto-initiating GPT for:', nextStep.id);
                setCurrentVideo('listening');
                setCurrentAudio(null);
                setCurrentAudioType(null);
                setNeedsAutoInitiate(true);
                setFlowState(FLOW_STATES.PROCESSING);
              } else {
                setCurrentVideo('listening');
                setCurrentAudio(null);
                setCurrentAudioType(null);
                setFlowState(FLOW_STATES.LISTENING);
              }
            } else {
              // canAdvance e false, ramanem pe pasul curent
              readyForNextRef.current = true; // Reset pentru urmatorul ciclu
              setCurrentVideo('listening');
              setCurrentAudio(null);
              setCurrentAudioType(null);
              setFlowState(FLOW_STATES.LISTENING);
            }
          }
        }
        break;
      }

      case FLOW_EVENTS.USER_SPOKE: {
        // Utilizatorul a vorbit - salvam mesajul si verificam ce urmeaza
        const userMessage = payload.message;
        pendingUserMessageRef.current = userMessage;

        // Daca pasul curent e multiTurn, NU avansam - ramanem pe acelasi pas
        // GPT va decide cand e readyForNext
        if (currentStep?.multiTurn) {
          console.log('[FLOW] MultiTurn step, staying on:', currentStep.id);
          setNeedsAutoInitiate(true);
          setFlowState(FLOW_STATES.PROCESSING);
          break;
        }

        // Avanseaza la urmatorul pas
        advanceAgenda();

        // Verificam ce are urmatorul pas (nextStep e calculat inainte de advance)
        if (nextStep?.audio && !nextStep?.prompt) {
          // Pasul urmator are audio predefinit - il redam
          console.log('[FLOW] Next step has predefined audio, playing:', nextStep.id);
          setSpeakingState(nextStep.speakingState || 'speaking_normal');
          setCurrentVideo(nextStep.speakingState || 'speaking_normal');
          setCurrentAudio(nextStep.audio);
          setCurrentAudioType('predefined');
          setFlowState(FLOW_STATES.PLAYING_PREDEFINED_AUDIO);
        } else if (nextStep?.prompt) {
          // Pasul urmator are prompt - apelam GPT
          console.log('[FLOW] Next step has prompt, processing:', nextStep.id);
          setNeedsAutoInitiate(true);
          setFlowState(FLOW_STATES.PROCESSING);
        } else {
          // Nimic special - mergem la processing normal cu mesajul user-ului
          console.log('[FLOW] No special step, processing user message');
          setNeedsAutoInitiate(true); // Trebuie sa procesam mesajul user-ului!
          setFlowState(FLOW_STATES.PROCESSING);
        }
        break;
      }

      case FLOW_EVENTS.GPT_RESPONDED: {
        const { audio, speakingState: newSpeakingState, readyForNext, skipVideo, summary, childState: newChildState, stepId } = payload;

        // Clear auto-initiate flag
        setNeedsAutoInitiate(false);

        // Salvam informatiile
        if (summary) updateSummary(summary);
        if (newChildState) updateChildState(newChildState);
        readyForNextRef.current = readyForNext !== false;

        // IMPORTANT: Folosim stepId din payload pentru a gasi pasul ORIGINAL
        // (agenda poate fi avansata intre timp)
        const originalStep = stepId ? activeAgenda.find(s => s.id === stepId) : currentStep;
        console.log('[FLOW] GPT_RESPONDED for step:', stepId, 'currentStep:', currentStep?.id);

        // Verificam skipVideo
        if (skipVideo && originalStep?.video) {
          markVideoPlayed(originalStep.video);
        } else if (originalStep?.video && AGENDA_SPECIAL_VIDEOS.includes(originalStep.video)) {
          if (!isVideoPlayed(originalStep.video)) {
            queueVideo(originalStep.video);
          }
        }

        // Trecem la speaking
        const speakState = newSpeakingState || originalStep?.speakingState || 'speaking_normal';
        setSpeakingState(speakState);
        setCurrentVideo(speakState);
        setCurrentAudio(audio);
        setCurrentAudioType('tts');
        setFlowState(FLOW_STATES.SPEAKING);
        break;
      }

      case FLOW_EVENTS.TIMEOUT:
        goToStep('incheiere');
        setCurrentVideo('listening');
        setFlowState(FLOW_STATES.LISTENING);
        break;

      case FLOW_EVENTS.GO_TO_LISTENING:
        // Simple transition to listening without side effects
        // Use this when STT fails or returns empty text
        setCurrentVideo('listening');
        setCurrentAudio(null);
        setCurrentAudioType(null);
        setFlowState(FLOW_STATES.LISTENING);
        break;

      case FLOW_EVENTS.END_CALL:
        setFlowState(FLOW_STATES.ENDED);
        setCurrentVideo(null);
        setCurrentAudio(null);
        setCurrentAudioType(null);
        callStartTimeRef.current = null;
        break;

      default:
        console.warn('[FLOW] Unknown event:', event);
    }
  }, [flowState, getCurrentStep, getNextStep, advanceAgenda, goToStep, hasQueuedVideos, dequeueVideo, queueVideo, isVideoPlayed, markVideoPlayed, getElapsedTime, updateSummary, updateChildState, currentAudioType, activeAgenda]);

  // Reset complet
  const reset = useCallback(() => {
    setFlowState(FLOW_STATES.IDLE);
    setAgendaIndex(0);
    setChildState({ childGender: null, childCount: null, childNames: [], childAges: [] });
    pendingVideosRef.current = [];
    playedVideosRef.current = [];
    summaryRef.current = null;
    callStartTimeRef.current = null;
    readyForNextRef.current = true;
    setCurrentVideo(null);
    setCurrentAudio(null);
    setCurrentAudioType(null);
    setNeedsAutoInitiate(false);
  }, []);

  // Getter pentru pending user message
  const getPendingUserMessage = useCallback(() => {
    return pendingUserMessageRef.current;
  }, []);

  // Clear pending user message
  const clearPendingUserMessage = useCallback(() => {
    pendingUserMessageRef.current = null;
  }, []);

  return {
    // State
    flowState,
    agendaIndex,
    childState,
    speakingState,
    currentVideo,
    currentAudio,
    currentAudioType,
    needsAutoInitiate,
    mode, // Modul curent (normal sau marketing)

    // Getters
    getCurrentStep,
    getNextStep,
    getSummary,
    getElapsedTime,
    isVideoPlayed,
    getPendingUserMessage,

    // Actions
    transition,
    reset,
    updateSummary,
    updateChildState,
    clearPendingUserMessage,

    // Pentru restore din localStorage
    setAgendaIndex,
    setChildState,
    setPlayedVideos: (videos) => { playedVideosRef.current = videos || []; },
    getPlayedVideos: () => [...playedVideosRef.current],
  };
};
