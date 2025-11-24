import { useState, useCallback, useEffect, useRef } from 'react';
import { FaMicrophone, FaPhone, FaPhoneSlash } from 'react-icons/fa';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { api } from '../services/api';
import { SANTA_STATES } from '../constants/santaStates';
import './SantaCall.css';

// Informatii despre copil (hardcoded pentru moment)
const CHILD_INFO = {
  name: 'Razvan',
  info: 'ii place sa faca muzica si are o prietena Livia'
};

export const SantaCall = () => {
  const [callActive, setCallActive] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [currentState, setCurrentState] = useState(SANTA_STATES.LISTENING);
  const [isSantaSpeaking, setIsSantaSpeaking] = useState(false);
  const [isRequestPending, setIsRequestPending] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  const pendingMessagesRef = useRef([]);
  const requestTimeoutRef = useRef(null);
  const voiceRecorderRef = useRef(null);
  const audioPlayerRef = useRef(null);

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
      setCurrentState(SANTA_STATES.GREETING);

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
    } catch (err) {
      console.error('Error starting call:', err);
      setError(err.message);
      setCallActive(false);
      setIsSantaSpeaking(false);
      setCurrentState(SANTA_STATES.LISTENING);
    }
  }, []);

  const endCall = useCallback(() => {
    if (voiceRecorderRef.current) {
      voiceRecorderRef.current.stopListening();
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.stop();
    }
    setCallActive(false);
    setIsProcessing(false);
    setIsSantaSpeaking(false);
    setCurrentMessage('');
    setCurrentState(SANTA_STATES.LISTENING);
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
        <div className="santa-avatar">
          <div className={`avatar-circle ${callActive ? 'active' : ''}`}>
            {callActive && audioPlayer.isPlaying && (
              <div className="pulse-animation" />
            )}
            <div className="avatar-emoji">🎅</div>
          </div>
          <h2>Mos Craciun</h2>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="call-status">
          {!callActive ? (
            <p>Apasa butonul pentru a suna Mosul</p>
          ) : isSantaSpeaking && audioPlayer.isPlaying ? (
            <p>{getStateText(currentState)}...</p>
          ) : isGeneratingAudio ? (
            <p>{getStateText(currentState)}...</p>
          ) : isRequestPending ? (
            <p>Mosul se gandeste...</p>
          ) : voiceRecorder.isListening ? (
            <div className="listening-indicator">
              <FaMicrophone className="mic-icon" />
              {voiceRecorder.isRecording ? (
                <p>Vorbeste...</p>
              ) : (
                <p>Te ascult...</p>
              )}
            </div>
          ) : null}
        </div>

        <div className="call-controls">
          {!callActive ? (
            <button
              className="call-button start"
              onClick={startCall}
            >
              <FaPhone />
              <span>Suna Mosul</span>
            </button>
          ) : (
            <button
              className="call-button end"
              onClick={endCall}
            >
              <FaPhoneSlash />
              <span>Inchide</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
