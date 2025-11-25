import { useState, useCallback, useEffect, useRef } from 'react';
import { FaMicrophone, FaPhone, FaPhoneSlash } from 'react-icons/fa';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { api } from '../services/api';
import { SANTA_STATES } from '../constants/santaStates';
import { STATE_TO_VIDEO } from '../constants/videoConfig';
import { VideoPlayer } from './VideoPlayer';
import mosulImage from '../assets/mosul.png';
import './SantaCall.css';

// Informatii despre copil (hardcoded pentru moment)
const CHILD_INFO = {
  name: 'Razvan',
  info: 'ii place sa faca muzica si are o prietena Livia'
};

// Mod de testare - disable API calls pentru testarea video-urilor
const DISABLE_GENERATION = true;

// Sunete de replici pentru listening
const REPLICI_SOUNDS = [
  '/audio/replici/aha.mp3',
  '/audio/replici/aah.mp3',
  '/audio/replici/ooh.mp3',
  '/audio/replici/asa.mp3'
];

export const SantaCall = () => {
  const [callActive, setCallActive] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [currentState, setCurrentState] = useState(SANTA_STATES.IDLE);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [isSantaSpeaking, setIsSantaSpeaking] = useState(false);
  const [isRequestPending, setIsRequestPending] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  const pendingMessagesRef = useRef([]);
  const requestTimeoutRef = useRef(null);
  const voiceRecorderRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const ringToneRef = useRef(null);
  const replicaTimeoutRef = useRef(null);
  const replicaAudioRef = useRef(null);

  const processConversation = useCallback(async () => {
    if (pendingMessagesRef.current.length === 0 || isRequestPending || isGeneratingAudio || isSantaSpeaking) {
      return;
    }

    const concatenatedMessage = pendingMessagesRef.current.join(' ');
    pendingMessagesRef.current = [];
    setIsRequestPending(true);

    // Oprim microfonul complet cand incepem procesarea
    if (voiceRecorderRef.current) {
      voiceRecorderRef.current.stopListening();
    }

    try {
      const { state, message: santaResponse } = await api.chat(concatenatedMessage, conversationHistory, CHILD_INFO);

      setConversationHistory(prev => [
        ...prev,
        { role: 'user', content: concatenatedMessage },
        { role: 'assistant', content: santaResponse }
      ]);

      setCurrentState(state || SANTA_STATES.SPEAKING);

      setIsGeneratingAudio(true);

      const { audio } = await api.textToSpeech(santaResponse);

      setIsRequestPending(false);
      setIsGeneratingAudio(false);

      if (audioPlayerRef.current) {
        setIsSantaSpeaking(true);
        await audioPlayerRef.current.play(audio);
      } else {
        throw new Error('Audio player not initialized');
      }
    } catch (err) {
      console.error('Error processing conversation:', err);
      setError(err.message);
      setIsRequestPending(false);
      setIsGeneratingAudio(false);
      setCurrentState(SANTA_STATES.LISTENING);
      setIsSantaSpeaking(false);

      if (callActive && voiceRecorderRef.current) {
        await voiceRecorderRef.current.startListening();
      }
    }
  }, [conversationHistory, callActive, isSantaSpeaking, isRequestPending, isGeneratingAudio]);

  const scheduleRequestIfNeeded = useCallback(() => {
    if (requestTimeoutRef.current) {
      clearTimeout(requestTimeoutRef.current);
    }

    if (isSantaSpeaking || isRequestPending || isGeneratingAudio) {
      return;
    }

    if (pendingMessagesRef.current.length > 0) {
      requestTimeoutRef.current = setTimeout(() => {
        processConversation();
      }, 600);
    }
  }, [isSantaSpeaking, isRequestPending, isGeneratingAudio, processConversation]);

  const handleRecordingComplete = useCallback(async (audioBlob) => {
    // Daca Mosul vorbeste, nu procesam inregistrarea
    if (isSantaSpeaking) {
      return;
    }

    // Daca disableGeneration este true, nu facem nimic
    if (DISABLE_GENERATION) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const { text } = await api.speechToText(audioBlob);

      if (!text || text.trim().length === 0) {
        setIsProcessing(false);
        return;
      }

      // Adaugam textul in coada
      pendingMessagesRef.current.push(text);

      // Anulam timeout-ul vechi (daca userul vorbeste din nou)
      if (requestTimeoutRef.current) {
        clearTimeout(requestTimeoutRef.current);
        requestTimeoutRef.current = null;
      }

      // Programam un nou request DOAR daca nu este deja unul activ
      if (!isRequestPending && !isGeneratingAudio && !isSantaSpeaking) {
        scheduleRequestIfNeeded();
      }

      setIsProcessing(false);
    } catch (err) {
      console.error('Error transcribing audio:', err);
      setError(err.message);
      setIsProcessing(false);
    }
  }, [scheduleRequestIfNeeded, isSantaSpeaking, isRequestPending, isGeneratingAudio]);

  const handlePlaybackEnd = useCallback(async () => {
    setIsProcessing(false);
    setIsSantaSpeaking(false);
    setCurrentState(SANTA_STATES.LISTENING);

    // DOAR dupa ce Mosul a terminat de vorbit, repornim microfonul
    if (callActive && voiceRecorderRef.current) {
      await voiceRecorderRef.current.startListening();
      // Verificam daca sunt mesaje in asteptare
      scheduleRequestIfNeeded();
    }
  }, [callActive, scheduleRequestIfNeeded]);

  const voiceRecorder = useVoiceRecorder({
    onRecordingComplete: handleRecordingComplete,
    silenceThreshold: 1000,
    volumeThreshold: 0.05
  });

  const audioPlayer = useAudioPlayer({
    onPlaybackEnd: handlePlaybackEnd
  });

  // Salvam referintele pentru a le folosi in callbacks
  useEffect(() => {
    voiceRecorderRef.current = voiceRecorder;
    audioPlayerRef.current = audioPlayer;
  }, [voiceRecorder, audioPlayer]);

  const startCall = useCallback(async () => {
    try {
      setCallActive(true);
      setConversationHistory([]);
      setCurrentMessage('');
      setError(null);
      pendingMessagesRef.current = [];
      setIsRequestPending(false);
      setIsGeneratingAudio(false);

      // Starea CALLING - afișăm poza și textul
      setCurrentState(SANTA_STATES.CALLING);
      setCurrentVideo(null);

      // Playăm sunetul de apel
      if (!ringToneRef.current) {
        ringToneRef.current = new Audio('/audio/suna.mp3');
      }
      ringToneRef.current.currentTime = 0;
      ringToneRef.current.play().catch(err => {
        console.error('Error playing ringtone:', err);
      });

      // Așteptăm 2 secunde pentru starea CALLING
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Oprim sunetul de apel
      if (ringToneRef.current) {
        ringToneRef.current.pause();
        ringToneRef.current.currentTime = 0;
      }

      // Trecem la starea INTRO și setăm video-ul
      setCurrentState(SANTA_STATES.INTRO);
      setCurrentVideo('intro');
    } catch (err) {
      console.error('Error starting call:', err);
      setError(err.message);
      setCallActive(false);
      setCurrentState(SANTA_STATES.IDLE);
      setCurrentVideo(null);
    }
  }, []);

  const handleVideoEnd = useCallback(async (videoName) => {
    try {
      console.log('Video ended:', videoName);

      // Când intro se termină
      if (videoName === 'intro') {
        if (DISABLE_GENERATION) {
          // Mod testare - trecem direct la listening
          setCurrentState(SANTA_STATES.LISTENING);
          setCurrentVideo('listening');
          return;
        }

        setCurrentState(SANTA_STATES.GREETING);
        setCurrentVideo('speaking');

        // NU pornim microfonul inca - Mosul trebuie sa salute mai intai
        const greeting = "Ho ho ho! Salut! Eu sunt Mos Craciun! Nu vad prea bine... cu cine vorbesc?";
        const { audio } = await api.textToSpeech(greeting);

        setConversationHistory([{ role: 'assistant', content: greeting }]);

        // Playam greeting-ul, iar dupa terminare (onPlaybackEnd) se va porni microfonul
        if (audioPlayerRef.current) {
          setIsSantaSpeaking(true);
          await audioPlayerRef.current.play(audio);
        } else {
          throw new Error('Audio player not initialized');
        }
      }
    } catch (err) {
      console.error('Error after video end:', err);
      setError(err.message);
      setCallActive(false);
      setIsSantaSpeaking(false);
      setCurrentState(SANTA_STATES.IDLE);
      setCurrentVideo(null);
    }
  }, []);

  const handleTestVideoChange = useCallback((videoName) => {
    console.log('Test video change requested:', videoName);
    setCurrentVideo(videoName);
  }, []);

  const handleVideoPlay = useCallback((videoName) => {
    console.log('Video started playing:', videoName);

    // Verificăm dacă video-ul este "listening"
    const isListening = videoName === 'listening' || videoName === 'listening2';

    if (!isListening) {
      return;
    }

    // Funcție pentru a reda replici random
    const playRandomReplica = () => {
      // Selectăm un sunet random
      const randomSound = REPLICI_SOUNDS[Math.floor(Math.random() * REPLICI_SOUNDS.length)];

      // Creăm sau reutilizăm audio element
      if (!replicaAudioRef.current) {
        replicaAudioRef.current = new Audio();
      }

      replicaAudioRef.current.src = randomSound;
      replicaAudioRef.current.volume = 0.7;
      replicaAudioRef.current.play().catch(err => {
        console.error('Error playing replica sound:', err);
      });

      // Programăm următoarea replică la 2-3 secunde
      const nextDelay = 2000 + Math.random() * 1000; // 2-3 secunde
      replicaTimeoutRef.current = setTimeout(playRandomReplica, nextDelay);
    };

    // Așteptăm 2-3 secunde înainte de prima replică
    const initialDelay = 2000 + Math.random() * 1000;
    replicaTimeoutRef.current = setTimeout(playRandomReplica, initialDelay);
  }, []);

  const handleVideoStop = useCallback((videoName) => {
    console.log('Video stopped:', videoName);

    // Oprim replicile
    if (replicaTimeoutRef.current) {
      clearTimeout(replicaTimeoutRef.current);
      replicaTimeoutRef.current = null;
    }

    // Oprim audio-ul de replică dacă se redă
    if (replicaAudioRef.current) {
      replicaAudioRef.current.pause();
      replicaAudioRef.current.currentTime = 0;
    }
  }, []);

  const endCall = useCallback(() => {
    if (voiceRecorderRef.current) {
      voiceRecorderRef.current.stopListening();
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.stop();
    }
    if (ringToneRef.current) {
      ringToneRef.current.pause();
      ringToneRef.current.currentTime = 0;
    }
    if (replicaTimeoutRef.current) {
      clearTimeout(replicaTimeoutRef.current);
      replicaTimeoutRef.current = null;
    }
    setCallActive(false);
    setIsProcessing(false);
    setIsSantaSpeaking(false);
    setCurrentMessage('');
    setCurrentState(SANTA_STATES.IDLE);
    setCurrentVideo(null);
    pendingMessagesRef.current = [];
    if (requestTimeoutRef.current) {
      clearTimeout(requestTimeoutRef.current);
    }
    setIsRequestPending(false);
    setIsGeneratingAudio(false);
  }, []);

  useEffect(() => {
    return () => {
      if (voiceRecorderRef.current) {
        voiceRecorderRef.current.stopListening();
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.stop();
      }
      if (replicaTimeoutRef.current) {
        clearTimeout(replicaTimeoutRef.current);
      }
    };
  }, []);

  const getStateText = (state) => {
    const stateTexts = {
      [SANTA_STATES.GREETING]: 'Mosul te saluta',
      [SANTA_STATES.LISTENING]: 'Te ascult',
      [SANTA_STATES.LAUGHING]: 'Mosul rade',
      [SANTA_STATES.SURPRISED]: 'Mosul este mirat',
      [SANTA_STATES.HAPPY]: 'Mosul este fericit',
      [SANTA_STATES.THINKING]: 'Mosul se gandeste',
      [SANTA_STATES.SPEAKING]: 'Mosul vorbeste',
      [SANTA_STATES.SAD]: 'Mosul este trist',
      [SANTA_STATES.EXCITED]: 'Mosul este entuziasmat',
      [SANTA_STATES.CURIOUS]: 'Mosul este curios',
    };
    return stateTexts[state] || 'Mosul vorbeste';
  };

  return (
    <div className="santa-call">
      <div className="santa-call-container">
        {currentState === SANTA_STATES.IDLE && (
          <>
            <div className="idle-screen">
              <h1 className="app-title">Sună pe Moșul</h1>
              <div className="call-button-wrapper">
                <button
                  className="call-button start"
                  onClick={startCall}
                >
                  <FaPhone />
                </button>
              </div>
            </div>
          </>
        )}

        {currentState === SANTA_STATES.CALLING && (
          <>
            <div className="calling-screen">
              <div className="calling-avatar">
                <img src={mosulImage} alt="Moș Crăciun" />
              </div>
              <p className="calling-text">Se apelează...</p>
              <h2 className="calling-name">Moș Crăciun</h2>
            </div>
            <button
              className="end-call-button"
              onClick={endCall}
            >
              <FaPhoneSlash />
            </button>
          </>
        )}

        {(currentState === SANTA_STATES.INTRO ||
          (currentState === SANTA_STATES.LISTENING && DISABLE_GENERATION)) && (
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
            <button
              className="end-call-button"
              onClick={endCall}
            >
              <FaPhoneSlash />
            </button>
          </>
        )}

        {currentState !== SANTA_STATES.IDLE &&
         currentState !== SANTA_STATES.CALLING &&
         currentState !== SANTA_STATES.INTRO &&
         !(currentState === SANTA_STATES.LISTENING && DISABLE_GENERATION) && (
          <>
            <div className="conversation-screen">
              <div className="santa-avatar">
                <div className={`avatar-circle ${callActive ? 'active' : ''}`}>
                  {callActive && audioPlayer.isPlaying && (
                    <div className="pulse-animation" />
                  )}
                  <div className="avatar-emoji">🎅</div>
                </div>
                <h2>Moș Crăciun</h2>
              </div>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <div className="call-status">
                {isSantaSpeaking && audioPlayer.isPlaying ? (
                  <p>{getStateText(currentState)}...</p>
                ) : isGeneratingAudio ? (
                  <p>{getStateText(currentState)}...</p>
                ) : isRequestPending ? (
                  <p>Moșul se gândește...</p>
                ) : voiceRecorder.isListening ? (
                  <div className="listening-indicator">
                    <FaMicrophone className="mic-icon" />
                    {voiceRecorder.isRecording ? (
                      <p>Vorbește...</p>
                    ) : (
                      <p>Te ascult...</p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <button
              className="end-call-button"
              onClick={endCall}
            >
              <FaPhoneSlash />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
