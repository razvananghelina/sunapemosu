import { useState, useCallback, useRef } from 'react';
import { SANTA_AGENDA, getNextAgendaStep, AGENDA_SPECIAL_VIDEOS } from '../constants/santaAgenda';

/**
 * Hook pentru gestionarea agendei conversatiei cu Mos Craciun
 * Parcurge array-ul de agenda si gestioneaza tranzitiile intre pasi
 */
export const useAgenda = () => {
  // Index-ul pasului curent in agenda (0 = intro)
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Starea copilului/copiilor - completata de GPT in pasul de cunoastere
  const [childState, setChildState] = useState({
    childGender: null,      // 'baiat', 'fata', sau 'mixed'
    childCount: null,       // numarul de copii
    childNames: [],         // array cu numele copiilor
    childAges: [],          // array cu varstele
  });

  // Video-uri speciale pending (de rulat dupa TTS)
  const pendingSpecialVideosRef = useRef([]);

  // Video-uri deja redate (pentru a nu le repeta)
  const playedVideosRef = useRef([]);

  // Sumar conversatie pentru GPT
  const conversationSummaryRef = useRef(null);

  // Obtine pasul curent
  const getCurrentStep = useCallback(() => {
    if (currentStepIndex >= 0 && currentStepIndex < SANTA_AGENDA.length) {
      return SANTA_AGENDA[currentStepIndex];
    }
    return null;
  }, [currentStepIndex]);

  // Trece la urmatorul pas din agenda
  const goToNextStep = useCallback(() => {
    setCurrentStepIndex(prev => {
      const nextIndex = prev + 1;
      if (nextIndex < SANTA_AGENDA.length) {
        console.log('[AGENDA] Moving to step', nextIndex, ':', SANTA_AGENDA[nextIndex].id);
        return nextIndex;
      }
      console.log('[AGENDA] Already at last step');
      return prev;
    });
  }, []);

  // Sare la un pas specific
  const goToStep = useCallback((stepId) => {
    const index = SANTA_AGENDA.findIndex(step => step.id === stepId);
    if (index !== -1) {
      console.log('[AGENDA] Jumping to step', index, ':', stepId);
      setCurrentStepIndex(index);
    } else {
      console.warn('[AGENDA] Step not found:', stepId);
    }
  }, []);

  // Reseteaza agenda la inceput
  const resetAgenda = useCallback(() => {
    console.log('[AGENDA] Resetting agenda');
    setCurrentStepIndex(0);
    setChildState({
      childGender: null,
      childCount: null,
      childNames: [],
      childAges: [],
    });
    pendingSpecialVideosRef.current = [];
    playedVideosRef.current = [];
    conversationSummaryRef.current = null;
  }, []);

  // Actualizeaza starea copilului (din raspunsul GPT)
  const updateChildState = useCallback((newChildState) => {
    console.log('[AGENDA] Updating child state:', newChildState);
    setChildState(prev => ({
      ...prev,
      ...newChildState,
    }));
  }, []);

  // Adauga video-uri speciale la pending
  const addPendingVideos = useCallback((videos) => {
    if (!videos || videos.length === 0) return;

    // Filtram video-urile deja redate
    const newVideos = videos.filter(v => !playedVideosRef.current.includes(v));
    if (newVideos.length > 0) {
      console.log('[AGENDA] Adding pending videos:', newVideos);
      pendingSpecialVideosRef.current = [...pendingSpecialVideosRef.current, ...newVideos];
    }
  }, []);

  // Obtine urmatorul video special de rulat
  const getNextPendingVideo = useCallback(() => {
    if (pendingSpecialVideosRef.current.length > 0) {
      const nextVideo = pendingSpecialVideosRef.current.shift();
      // Marcam ca redat
      if (!playedVideosRef.current.includes(nextVideo)) {
        playedVideosRef.current.push(nextVideo);
      }
      console.log('[AGENDA] Getting next pending video:', nextVideo);
      return nextVideo;
    }
    return null;
  }, []);

  // Verifica daca mai sunt video-uri pending
  const hasPendingVideos = useCallback(() => {
    return pendingSpecialVideosRef.current.length > 0;
  }, []);

  // Verifica daca un video a fost deja redat
  const isVideoPlayed = useCallback((videoName) => {
    return playedVideosRef.current.includes(videoName);
  }, []);

  // Marcheaza un video ca redat
  const markVideoAsPlayed = useCallback((videoName) => {
    if (!playedVideosRef.current.includes(videoName)) {
      playedVideosRef.current.push(videoName);
      console.log('[AGENDA] Marked video as played:', videoName);
    }
  }, []);

  // Obtine lista de video-uri redate
  const getPlayedVideos = useCallback(() => {
    return [...playedVideosRef.current];
  }, []);

  // Seteaza lista de video-uri redate (pentru restore din localStorage)
  const setPlayedVideos = useCallback((videos) => {
    if (videos && Array.isArray(videos)) {
      playedVideosRef.current = [...videos];
      console.log('[AGENDA] Set played videos:', videos);
    }
  }, []);

  // Actualizeaza sumarul conversatiei
  const updateSummary = useCallback((summary) => {
    conversationSummaryRef.current = summary;
    console.log('[AGENDA] Updated conversation summary');
  }, []);

  // Obtine sumarul conversatiei
  const getSummary = useCallback(() => {
    return conversationSummaryRef.current;
  }, []);

  // Verifica daca agenda s-a terminat
  const isAgendaComplete = useCallback(() => {
    return currentStepIndex >= SANTA_AGENDA.length - 1;
  }, [currentStepIndex]);

  // Verifica daca pasul curent are video special asociat
  const currentStepHasSpecialVideo = useCallback(() => {
    const step = getCurrentStep();
    if (!step || !step.video) return false;
    return AGENDA_SPECIAL_VIDEOS.includes(step.video);
  }, [getCurrentStep]);

  // Obtine video-ul special al pasului curent (daca exista)
  const getCurrentStepSpecialVideo = useCallback(() => {
    const step = getCurrentStep();
    if (!step || !step.video) return null;
    if (AGENDA_SPECIAL_VIDEOS.includes(step.video)) {
      return step.video;
    }
    return null;
  }, [getCurrentStep]);

  return {
    // State
    currentStepIndex,
    childState,

    // Getters
    getCurrentStep,
    getPlayedVideos,
    getSummary,

    // Actions
    goToNextStep,
    goToStep,
    resetAgenda,
    updateChildState,
    updateSummary,

    // Video management
    addPendingVideos,
    getNextPendingVideo,
    hasPendingVideos,
    isVideoPlayed,
    markVideoAsPlayed,
    setPlayedVideos,
    currentStepHasSpecialVideo,
    getCurrentStepSpecialVideo,

    // Status
    isAgendaComplete,
  };
};
