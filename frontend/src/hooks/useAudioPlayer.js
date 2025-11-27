import { useState, useRef, useCallback } from 'react';
import { playBase64Audio } from '../utils/audioManager';

export const useAudioPlayer = ({ onPlaybackEnd }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const currentPlaybackRef = useRef(null);

  const play = useCallback(async (base64Audio) => {
    console.log('[USE AUDIO PLAYER] Play called');

    // Oprim playback-ul anterior
    if (currentPlaybackRef.current) {
      currentPlaybackRef.current.stop();
      currentPlaybackRef.current = null;
    }

    setIsPlaying(true);

    try {
      const playback = await playBase64Audio(base64Audio, () => {
        console.log('[USE AUDIO PLAYER] Playback ended callback');
        setIsPlaying(false);
        currentPlaybackRef.current = null;
        if (onPlaybackEnd) {
          onPlaybackEnd();
        }
      });

      currentPlaybackRef.current = playback;
    } catch (error) {
      console.error('[USE AUDIO PLAYER] Error:', error);
      setIsPlaying(false);
      if (onPlaybackEnd) {
        onPlaybackEnd();
      }
    }
  }, [onPlaybackEnd]);

  const stop = useCallback(() => {
    if (currentPlaybackRef.current) {
      currentPlaybackRef.current.stop();
      currentPlaybackRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  return {
    isPlaying,
    play,
    stop,
  };
};
