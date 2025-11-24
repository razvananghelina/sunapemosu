import { useState, useRef, useCallback } from 'react';

export const useAudioPlayer = ({ onPlaybackEnd }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  const play = useCallback(async (base64Audio) => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audioBlob = base64ToBlob(base64Audio, 'audio/mpeg');
      const audioUrl = URL.createObjectURL(audioBlob);

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        if (onPlaybackEnd) {
          onPlaybackEnd();
        }
      };

      audio.onerror = (error) => {
        console.error('Audio playback error:', error);
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        if (onPlaybackEnd) {
          onPlaybackEnd();
        }
      };

      setIsPlaying(true);
      await audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsPlaying(false);
      if (onPlaybackEnd) {
        onPlaybackEnd();
      }
    }
  }, [onPlaybackEnd]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  return {
    isPlaying,
    play,
    stop,
  };
};

function base64ToBlob(base64, mimeType) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}
