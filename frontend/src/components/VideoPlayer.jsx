import { useEffect, useRef, useState, useCallback } from 'react';
import { VIDEO_CONFIG } from '../constants/videoConfig';
import './VideoPlayer.css';

// Preload video-uri importante pentru tranzitii mai rapide
const preloadedVideos = {};
const preloadVideo = (videoName) => {
  if (preloadedVideos[videoName] || !VIDEO_CONFIG[videoName]) return;

  const video = document.createElement('video');
  video.preload = 'auto';
  video.src = VIDEO_CONFIG[videoName].src;
  video.load();
  preloadedVideos[videoName] = video;
  console.log('[PRELOAD] Preloading video:', videoName);
};

// Preload video-uri principale la incarcarea modulului
// Nota: speaking_amused si speaking_amazed folosesc speaks.mp4 (fallback), deci nu le preincarcam separat
['listening', 'speaking', 'speaking_normal', 'laughing', 'amazed'].forEach(preloadVideo);

export const VideoPlayer = ({ currentVideo, onVideoEnd, onPlay, onStop, className = '', testMode = false, onTestVideoChange }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const previousVideoRef = useRef(null);

  // Refs pentru callbacks ca sa evitam re-atasarea event listeners
  const onVideoEndRef = useRef(onVideoEnd);
  const onPlayRef = useRef(onPlay);
  const onStopRef = useRef(onStop);

  // Update refs cand callbacks se schimba
  useEffect(() => {
    onVideoEndRef.current = onVideoEnd;
    onPlayRef.current = onPlay;
    onStopRef.current = onStop;
  }, [onVideoEnd, onPlay, onStop]);

  // Preload urmatoarele video-uri probabile bazat pe cel curent
  useEffect(() => {
    if (currentVideo === 'intro') {
      preloadVideo('listening');
      preloadVideo('speaking');
      preloadVideo('speaking_normal');
    } else if (currentVideo === 'listening') {
      preloadVideo('speaking');
      preloadVideo('speaking_normal');
      // speaking_amused si speaking_amazed folosesc speaks.mp4 (deja preincarcat ca speaking)
      preloadVideo('kids_list');
      preloadVideo('elfs_working');
    } else if (currentVideo === 'speaking' || currentVideo.startsWith('speaking_')) {
      preloadVideo('listening');
      preloadVideo('flight');
    }
  }, [currentVideo]);

  // Effect pentru schimbarea video-ului
  useEffect(() => {
    if (!currentVideo || !VIDEO_CONFIG[currentVideo]) {
      console.warn(`Video config not found for: ${currentVideo}`);
      return;
    }

    const videoElement = videoRef.current;
    if (!videoElement) return;

    const config = VIDEO_CONFIG[currentVideo];
    const isChangingVideo = previousVideoRef.current !== currentVideo;

    if (!isChangingVideo) {
      console.log('[VIDEO] Same video, skipping:', currentVideo);
      return;
    }

    console.log('[VIDEO] Loading video:', currentVideo, config.src);

    // Notificăm că video-ul anterior s-a oprit
    if (previousVideoRef.current && onStopRef.current) {
      onStopRef.current(previousVideoRef.current);
    }

    // Configurăm video-ul
    videoElement.src = config.src;
    videoElement.loop = config.loop;
    // Video-urile loop (speaking, listening) sunt muted pentru ca TTS-ul e redat separat
    // Video-urile non-loop (intro, elfs_working, kids_list, flight, polulnord) au sunet propriu
    videoElement.muted = config.loop;

    // Handler pentru metadata (pentru debug)
    const handleLoadedMetadata = () => {
      console.log('[VIDEO] Metadata loaded:', currentVideo, 'duration:', videoElement.duration, 'loop:', config.loop);
    };

    // Handler pentru când video-ul este gata
    const handleCanPlay = () => {
      console.log('[VIDEO] Ready to play:', currentVideo, 'duration:', videoElement.duration);

      videoElement.play()
        .then(() => {
          console.log('[VIDEO] Playing:', currentVideo);
          setIsPlaying(true);
          previousVideoRef.current = currentVideo;

          if (onPlayRef.current) {
            onPlayRef.current(currentVideo);
          }
        })
        .catch(err => {
          console.error('[VIDEO] Error playing:', currentVideo, err);
          // Daca play() esueaza (blocked by browser, etc), notificam ca s-a terminat
          if (onVideoEndRef.current) {
            onVideoEndRef.current(currentVideo);
          }
        });
    };

    // Handler pentru când video-ul se termină
    const handleEnded = () => {
      console.log('[VIDEO] Ended:', currentVideo, 'loop:', config.loop);

      if (!config.loop && onVideoEndRef.current) {
        onVideoEndRef.current(currentVideo);
      }
    };

    // Handler pentru erori video (fisier lipsa, format invalid, etc)
    const handleError = (e) => {
      console.error('[VIDEO] Error:', currentVideo, e);
      // Daca video-ul nu se poate incarca, notificam ca s-a terminat
      // pentru a nu bloca aplicatia
      if (onVideoEndRef.current) {
        onVideoEndRef.current(currentVideo);
      }
    };

    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
    videoElement.addEventListener('canplay', handleCanPlay, { once: true });
    videoElement.addEventListener('ended', handleEnded);
    videoElement.addEventListener('error', handleError, { once: true });

    // Încărcăm video-ul
    videoElement.load();

    return () => {
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.removeEventListener('canplay', handleCanPlay);
      videoElement.removeEventListener('ended', handleEnded);
      videoElement.removeEventListener('error', handleError);
    };
  }, [currentVideo]); // Doar currentVideo in dependencies - callbacks sunt in refs

  if (!currentVideo) {
    return null;
  }

  const availableVideos = Object.keys(VIDEO_CONFIG);

  return (
    <div className={`video-player-container ${className}`}>
      <video
        ref={videoRef}
        className="santa-video active"
        playsInline
        webkit-playsinline="true"
        controlsList="nodownload nofullscreen"
        disablePictureInPicture
      />

      {/* Test Mode Overlay */}
      {testMode && onTestVideoChange && (
        <div className="test-overlay">
          <div className="test-status">
            <span className="current-video-label">Current: {currentVideo}</span>
          </div>
          <div className="test-buttons">
            {availableVideos.map((videoName) => (
              <button
                key={videoName}
                className={`test-button ${currentVideo === videoName ? 'active' : ''}`}
                onClick={() => onTestVideoChange(videoName)}
                title={VIDEO_CONFIG[videoName].description}
              >
                {videoName}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
