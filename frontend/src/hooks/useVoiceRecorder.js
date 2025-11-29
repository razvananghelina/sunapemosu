import { useState, useRef, useCallback, useEffect } from 'react';
import { MicVAD } from '@ricky0123/vad-web';

/**
 * Hook pentru inregistrare vocala cu detectie inteligenta a vorbirii (VAD)
 * Foloseste Silero VAD direct (nu React hook) pentru control mai bun al lifecycle-ului
 */
export const useVoiceRecorder = ({
  onRecordingComplete,
  // Parametrii VAD
  positiveSpeechThreshold = 0.5,
  negativeSpeechThreshold = 0.35,
  minSpeechFrames = 3,
  preSpeechPadFrames = 5,
  redemptionFrames = 8,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentVolume, setCurrentVolume] = useState(0);

  const vadRef = useRef(null);
  const isInitializingRef = useRef(false);
  const onRecordingCompleteRef = useRef(onRecordingComplete);

  // Keep callback ref updated
  useEffect(() => {
    onRecordingCompleteRef.current = onRecordingComplete;
  }, [onRecordingComplete]);

  /**
   * Converteste Float32Array in WAV Blob pentru Whisper API
   */
  const float32ArrayToWavBlob = useCallback((float32Array, sampleRate = 16000) => {
    const numChannels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = float32Array.length * bytesPerSample;
    const bufferSize = 44 + dataSize;

    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);

    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < float32Array.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      const int16Sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, int16Sample, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }, []);

  const startListening = useCallback(async () => {
    if (isInitializingRef.current) {
      console.log('[VAD] Already initializing, skipping');
      return;
    }

    if (vadRef.current) {
      console.log('[VAD] VAD already exists, starting...');
      vadRef.current.start();
      setIsListening(true);
      return;
    }

    isInitializingRef.current = true;
    console.log('[VAD] Creating new MicVAD instance...');

    try {
      const baseUrl = import.meta.env.BASE_URL || '/';

      const vad = await MicVAD.new({
        baseAssetPath: baseUrl,
        onnxWASMBasePath: baseUrl,
        positiveSpeechThreshold,
        negativeSpeechThreshold,
        minSpeechFrames,
        preSpeechPadFrames,
        redemptionFrames,

        onSpeechStart: () => {
          console.log('[VAD] Speech started');
          setIsRecording(true);
        },

        onSpeechEnd: (audio) => {
          console.log('[VAD] Speech ended, samples:', audio.length);
          setIsRecording(false);

          const wavBlob = float32ArrayToWavBlob(audio);
          console.log('[VAD] WAV blob size:', wavBlob.size);

          if (wavBlob.size > 1000 && onRecordingCompleteRef.current) {
            onRecordingCompleteRef.current(wavBlob);
          } else {
            console.log('[VAD] Audio too short, ignoring');
          }
        },

        onVADMisfire: () => {
          console.log('[VAD] Misfire - speech was too short');
          setIsRecording(false);
        },
      });

      vadRef.current = vad;
      vad.start();
      setIsListening(true);
      console.log('[VAD] Started successfully');

    } catch (error) {
      console.error('[VAD] Error creating MicVAD:', error);
      throw error;
    } finally {
      isInitializingRef.current = false;
    }
  }, [float32ArrayToWavBlob, positiveSpeechThreshold, negativeSpeechThreshold, minSpeechFrames, preSpeechPadFrames, redemptionFrames]);

  const stopListening = useCallback(() => {
    console.log('[VAD] Stopping...');

    if (vadRef.current) {
      vadRef.current.pause();
    }

    setIsListening(false);
    setIsRecording(false);
    setCurrentVolume(0);
  }, []);

  // Cleanup on unmount - destroy VAD completely
  useEffect(() => {
    return () => {
      console.log('[VAD] Cleanup - destroying VAD');
      if (vadRef.current) {
        vadRef.current.pause();
        vadRef.current.destroy();
        vadRef.current = null;
      }
    };
  }, []);

  return {
    isListening,
    isRecording,
    currentVolume,
    startListening,
    stopListening,
  };
};
