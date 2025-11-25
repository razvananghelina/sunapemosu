import { useEffect, useRef, useState } from 'react';
import { VIDEO_CONFIG } from '../constants/videoConfig';
import './VideoPlayer.css';

export const VideoPlayer = ({ currentVideo, onVideoEnd, onPlay, onStop, className = '', testMode = false, onTestVideoChange }) => {
  const videoARef = useRef(null);
  const videoBRef = useRef(null);
  const [activeVideo, setActiveVideo] = useState(null); // null, 'A' sau 'B'
  const [videoAReady, setVideoAReady] = useState(false);
  const [videoBReady, setVideoBReady] = useState(false);
  const [isNearEnd, setIsNearEnd] = useState(false); // true când suntem aproape de ultimul frame
  const previousVideoRef = useRef(null);
  const isTransitioningRef = useRef(false);
  const queuedVideoRef = useRef(null); // video-ul în așteptare

  useEffect(() => {
    if (!currentVideo || !VIDEO_CONFIG[currentVideo]) {
      console.warn(`Video config not found for: ${currentVideo}`);
      return;
    }

    const config = VIDEO_CONFIG[currentVideo];
    const isChangingVideo = previousVideoRef.current !== currentVideo;

    if (!isChangingVideo) {
      console.log('Same video, skipping');
      return;
    }

    // Notificăm că video-ul anterior s-a oprit
    if (previousVideoRef.current && onStop) {
      console.log('Video stopping:', previousVideoRef.current);
      onStop(previousVideoRef.current);
    }

    console.log('Loading new video:', currentVideo, config.src, 'activeVideo:', activeVideo);

    // Prevenim tranziții multiple simultane
    if (isTransitioningRef.current) {
      console.log('Transition already in progress, skipping...');
      return;
    }

    isTransitioningRef.current = true;

    // La prima încărcare, folosim Video A
    // După aceea, alternam între A și B
    const nextVideoElement = !activeVideo || activeVideo === 'B' ? videoARef.current : videoBRef.current;
    const nextVideoId = !activeVideo || activeVideo === 'B' ? 'A' : 'B';

    if (!nextVideoElement) {
      isTransitioningRef.current = false;
      return;
    }

    // Resetăm starea de ready pentru video-ul următor
    if (nextVideoId === 'A') {
      setVideoAReady(false);
    } else {
      setVideoBReady(false);
    }

    // Configurăm video-ul următor
    nextVideoElement.src = config.src;
    nextVideoElement.loop = config.loop;

    // Handler pentru când video-ul este gata
    const handleCanPlay = () => {
      console.log('Video ready to play:', currentVideo);

      // Prevenim fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }

      // Playăm video-ul nou
      const playPromise = nextVideoElement.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('Video playing:', currentVideo);

            // Facem swap - video-ul nou devine activ
            setActiveVideo(nextVideoId);

            // Marcăm video-ul ca ready
            if (nextVideoId === 'A') {
              setVideoAReady(true);
            } else {
              setVideoBReady(true);
            }

            // Actualizăm referința
            previousVideoRef.current = currentVideo;

            // Tranziția s-a terminat
            isTransitioningRef.current = false;

            // Notificăm că video-ul a început să ruleze
            if (onPlay) {
              onPlay(currentVideo);
            }
          })
          .catch(err => {
            console.error('Error playing video:', err);
            isTransitioningRef.current = false;
          });
      } else {
        isTransitioningRef.current = false;
      }
    };

    // Adăugăm event listener pentru canplay
    nextVideoElement.addEventListener('canplay', handleCanPlay, { once: true });

    // Încărcăm video-ul
    nextVideoElement.load();

    // Cleanup
    return () => {
      nextVideoElement.removeEventListener('canplay', handleCanPlay);
      isTransitioningRef.current = false;
    };
  }, [currentVideo]);

  const handleVideoEnd = (videoId) => {
    const config = VIDEO_CONFIG[currentVideo];
    if (!config) return;

    console.log('Video ended:', currentVideo, 'loop:', config.loop);

    // Dacă video-ul nu ar trebui să loopeze, anunțăm părinte
    if (!config.loop && onVideoEnd) {
      onVideoEnd(currentVideo);

      // Notificăm și că video-ul s-a oprit
      if (onStop) {
        onStop(currentVideo);
      }
    }
  };

  // Monitorizare pentru ultimul frame (ultimele 1.5 secunde)
  useEffect(() => {
    const activeVideoElement = activeVideo === 'A' ? videoARef.current : videoBRef.current;
    if (!activeVideoElement || !testMode) return;

    const handleTimeUpdate = () => {
      const { currentTime, duration } = activeVideoElement;
      if (duration && !isNaN(duration)) {
        // Considerăm că suntem aproape de final în ultimele 1.5 secunde
        const timeFromEnd = duration - currentTime;
        const nearEnd = timeFromEnd <= 1.5 && timeFromEnd > 0;
        setIsNearEnd(nearEnd);

        // Dacă suntem la ultimul frame și avem un video în queue, îl activăm
        if (nearEnd && queuedVideoRef.current && onTestVideoChange) {
          const videoToPlay = queuedVideoRef.current;
          queuedVideoRef.current = null;
          console.log('Executing queued video change:', videoToPlay);
          onTestVideoChange(videoToPlay);
        }
      }
    };

    activeVideoElement.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      activeVideoElement.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [activeVideo, testMode, onTestVideoChange]);

  const handleTestVideoChange = (videoName) => {
    if (!onTestVideoChange) return;

    if (isNearEnd) {
      // Suntem la ultimul frame, schimbăm imediat
      console.log('Immediate video change:', videoName);
      queuedVideoRef.current = null;
      onTestVideoChange(videoName);
    } else {
      // Nu suntem la ultimul frame, punem în queue
      console.log('Queueing video change:', videoName);
      queuedVideoRef.current = videoName;
    }
  };

  if (!currentVideo) {
    return null;
  }

  const availableVideos = Object.keys(VIDEO_CONFIG);

  return (
    <div className={`video-player-container ${className}`}>
      {/* Video A */}
      <video
        ref={videoARef}
        className={`santa-video ${activeVideo === 'A' ? 'active' : 'hidden'}`}
        playsInline
        webkit-playsinline="true"
        controlsList="nodownload nofullscreen"
        disablePictureInPicture
        onEnded={() => handleVideoEnd('A')}
      />

      {/* Video B */}
      <video
        ref={videoBRef}
        className={`santa-video ${activeVideo === 'B' ? 'active' : 'hidden'}`}
        playsInline
        webkit-playsinline="true"
        controlsList="nodownload nofullscreen"
        disablePictureInPicture
        onEnded={() => handleVideoEnd('B')}
      />

      {/* Test Mode Overlay */}
      {testMode && (
        <div className="test-overlay">
          <div className="test-status">
            <span className={`status-indicator ${isNearEnd ? 'ready' : 'waiting'}`}>
              {isNearEnd ? '✓ Gata pentru schimbare' : '⏳ Așteaptă ultimul frame'}
            </span>
            <span className="current-video-label">Current: {currentVideo}</span>
            {queuedVideoRef.current && (
              <span className="queued-video-label">Queued: {queuedVideoRef.current}</span>
            )}
          </div>
          <div className="test-buttons">
            {availableVideos.map((videoName) => (
              <button
                key={videoName}
                className={`test-button ${currentVideo === videoName ? 'active' : ''} ${queuedVideoRef.current === videoName ? 'queued' : ''}`}
                onClick={() => handleTestVideoChange(videoName)}
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
