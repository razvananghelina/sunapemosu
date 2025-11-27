import { useState, useRef, useCallback, useEffect } from 'react';

export const useVoiceRecorder = ({
  onRecordingComplete,
  silenceThreshold = 1500, // 1.5 seconds
  volumeThreshold = 0.01
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentVolume, setCurrentVolume] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const silenceTimerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const recordingStartTimeRef = useRef(null);
  const hasSpokenRef = useRef(false); // Track daca user-ul a vorbit ceva

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    recordingStartTimeRef.current = null;
    hasSpokenRef.current = false;
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    // Guard impotriva pornirii multiple
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log('[AUDIO] Already recording, skipping startRecording');
      return;
    }

    chunksRef.current = [];
    recordingStartTimeRef.current = Date.now();
    hasSpokenRef.current = false;

    // Determina cel mai bun mimeType suportat pentru Whisper
    // iOS Safari: mp4/aac, Chrome/Firefox: webm/opus
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4;codecs=aac',
      'audio/mp4',
      'audio/aac',
      'audio/mpeg',
      'audio/ogg;codecs=opus',
    ];

    let mimeType = '';
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        break;
      }
    }

    // Fallback - lasa browserul sa aleaga
    if (!mimeType) {
      console.warn('No preferred mimeType supported, using browser default');
      mimeType = '';
    }

    console.log('[AUDIO] Using mimeType:', mimeType || 'browser default');

    // Configuram MediaRecorder - nu includem mimeType daca e gol
    const recorderOptions = {
      audioBitsPerSecond: 128000, // 128kbps pentru calitate buna
    };
    if (mimeType) {
      recorderOptions.mimeType = mimeType;
    }

    const mediaRecorder = new MediaRecorder(streamRef.current, recorderOptions);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      // Folosim mimeType-ul efectiv al recorder-ului
      const actualMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';
      const audioBlob = new Blob(chunksRef.current, { type: actualMimeType });
      console.log('[AUDIO] Recording stopped, blob size:', audioBlob.size, 'type:', actualMimeType);
      onRecordingComplete(audioBlob);
      chunksRef.current = [];
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setIsRecording(true);
  }, [onRecordingComplete]);

  // Ref pentru a evita pornirea multipla a checkAudioLevel
  const isCheckingRef = useRef(false);
  const lastVolumeUpdateRef = useRef(0);

  const checkAudioLevel = useCallback(() => {
    if (!analyserRef.current || !isListening) {
      isCheckingRef.current = false;
      return;
    }

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const normalizedVolume = average / 255;

    // Update volume state doar la fiecare 100ms pentru a reduce re-renders
    const now = Date.now();
    if (now - lastVolumeUpdateRef.current > 100) {
      setCurrentVolume(normalizedVolume);
      lastVolumeUpdateRef.current = now;
    }

    const isSpeaking = normalizedVolume > volumeThreshold;

    // Durata minima de vorbire pentru a considera ca user-ul a vorbit (500ms)
    const MIN_SPEECH_DURATION = 500;

    if (isSpeaking) {
      if (!isRecording) {
        console.log('[VOICE] Starting recording, volume:', normalizedVolume.toFixed(3));
        startRecording();
      }

      // Daca user-ul vorbeste si a trecut timpul minim, marcam ca a vorbit
      if (isRecording && recordingStartTimeRef.current) {
        const recordingDuration = Date.now() - recordingStartTimeRef.current;
        if (recordingDuration >= MIN_SPEECH_DURATION && !hasSpokenRef.current) {
          hasSpokenRef.current = true;
          console.log('[VOICE] User has spoken for', recordingDuration, 'ms, marking as spoken');
        }
      }

      // Resetam timer-ul de tacere cand user-ul vorbeste
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    } else {
      // Pornim timer-ul de tacere DOAR daca user-ul a vorbit deja ceva
      if (isRecording && hasSpokenRef.current && !silenceTimerRef.current) {
        console.log('[VOICE] Silence detected, starting timer for', silenceThreshold, 'ms');
        silenceTimerRef.current = setTimeout(() => {
          console.log('[VOICE] Silence timer completed, stopping recording');
          stopRecording();
        }, silenceThreshold);
      }
    }

    animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
  }, [isListening, isRecording, startRecording, stopRecording, silenceThreshold, volumeThreshold]);

  const startListening = useCallback(async () => {
    try {
      // Constrangeri audio pentru calitate mai buna si reducere zgomot
      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000, // 16kHz e ideal pentru speech recognition
        channelCount: 1,   // Mono e suficient pentru voce
      };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // iOS Safari: AudioContext poate porni in starea "suspended"
      // Trebuie sa apelam resume() pentru a-l activa
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
        console.log('[VOICE] AudioContext resumed from suspended state');
      }

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      setIsListening(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  }, []);

  const stopListening = useCallback(() => {
    setIsListening(false);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    stopRecording();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {
        console.warn('[VOICE] AudioContext close failed:', e.message);
      }
      audioContextRef.current = null;
    }

    analyserRef.current = null;
  }, [stopRecording]);

  useEffect(() => {
    if (isListening && !isCheckingRef.current) {
      isCheckingRef.current = true;
      checkAudioLevel();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      // NU anulam silenceTimerRef aici - el trebuie sa persiste intre re-render-uri
      // Timer-ul va fi anulat in stopListening sau stopRecording
      isCheckingRef.current = false;
    };
  }, [isListening, checkAudioLevel]);

  return {
    isListening,
    isRecording,
    currentVolume,
    startListening,
    stopListening,
  };
};
