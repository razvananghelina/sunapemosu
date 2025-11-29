/**
 * Audio Manager pentru iOS/Mobile
 *
 * iOS necesita ca AudioContext sa fie creat SI resumed in timpul unei interactiuni utilizator.
 * Acest modul pastreaza un singur AudioContext deblocat care poate fi refolosit.
 */

let sharedAudioContext = null;
let sharedAudioElement = null;
let ambienceAudioElement = null;
let ringtoneAudioElement = null;
let ambienceSrc = null; // Src-ul pentru ambience, setat din exterior
let ringtoneSrc = null; // Src-ul pentru ringtone, setat din exterior
let isUnlocked = false;

/**
 * Obtine AudioContext-ul partajat (il creeaza daca nu exista)
 */
export const getAudioContext = () => {
  if (!sharedAudioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      sharedAudioContext = new AudioContext();
      console.log('[AUDIO MANAGER] Created shared AudioContext');
    }
  }
  return sharedAudioContext;
};

/**
 * Obtine elementul Audio partajat (il creeaza daca nu exista)
 */
export const getAudioElement = () => {
  if (!sharedAudioElement) {
    sharedAudioElement = new Audio();
    sharedAudioElement.playsInline = true;
    sharedAudioElement.setAttribute('playsinline', 'true');
    sharedAudioElement.setAttribute('webkit-playsinline', 'true');
    console.log('[AUDIO MANAGER] Created shared Audio element');
  }
  return sharedAudioElement;
};

/**
 * Seteaza src-ul pentru ambience (trebuie apelat INAINTE de unlockAudio)
 */
export const setAmbienceSrc = (src) => {
  ambienceSrc = src;
  console.log('[AUDIO MANAGER] Ambience src set to:', src);
};

/**
 * Seteaza src-ul pentru ringtone (trebuie apelat INAINTE de unlockAudio)
 */
export const setRingtoneSrc = (src) => {
  ringtoneSrc = src;
  console.log('[AUDIO MANAGER] Ringtone src set to:', src);
};

/**
 * Deblocheaza audio pentru iOS - TREBUIE apelat in handler de click/touch
 * Poate fi apelat de mai multe ori (ex: dupa dialog microfon)
 */
export const unlockAudio = async () => {
  console.log('[AUDIO MANAGER] Unlocking audio... (isUnlocked:', isUnlocked, ')');

  // Chiar daca e deja unlocked, trebuie sa verificam ca AudioContext e running
  // (iOS poate suspenda dupa dialog de permisiune microfon)
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    try {
      await ctx.resume();
      console.log('[AUDIO MANAGER] AudioContext re-resumed');
    } catch (e) {
      console.warn('[AUDIO MANAGER] AudioContext resume failed:', e.message);
    }
  }

  // Verificam ca ambience inca ruleaza (daca era pornit)
  if (ambienceAudioElement && ambienceAudioElement.paused && ambienceSrc) {
    try {
      ambienceAudioElement.src = ambienceSrc;
      ambienceAudioElement.volume = 0;
      ambienceAudioElement.loop = true;
      await ambienceAudioElement.play();
      console.log('[AUDIO MANAGER] Ambience re-started after suspend');
    } catch (e) {
      console.warn('[AUDIO MANAGER] Ambience re-start failed:', e.message);
    }
  }

  if (isUnlocked) {
    console.log('[AUDIO MANAGER] Already unlocked, just re-verified');
    return true;
  }

  console.log('[AUDIO MANAGER] First time unlock...');

  try {
    // 1. Deblocam AudioContext (ctx deja obtinut mai sus)
    if (ctx) {
      if (ctx.state === 'suspended') {
        await ctx.resume();
        console.log('[AUDIO MANAGER] AudioContext resumed');
      }

      // Cream si redam un sunet silent pentru a "incalzi" context-ul
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0.001; // Aproape silent
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.1);
      console.log('[AUDIO MANAGER] AudioContext warmed up');
    }

    // 2. Deblocam HTML5 Audio elements (main + ambience)
    const silentWav = createSilentWav();
    const blob = new Blob([silentWav], { type: 'audio/wav' });

    // Unlock main audio element
    const audio = getAudioElement();
    const url1 = URL.createObjectURL(blob);
    audio.src = url1;
    audio.volume = 0.001;

    try {
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 1;
      URL.revokeObjectURL(url1);
      console.log('[AUDIO MANAGER] Main audio element unlocked');
    } catch (e) {
      console.warn('[AUDIO MANAGER] Main audio element unlock failed:', e.message);
      URL.revokeObjectURL(url1);
    }

    // Unlock ambience audio element - folosim src-ul real daca e setat
    // IMPORTANT iOS: NU facem pause dupa play, il lasam sa ruleze la volum 0
    // Asta pastreaza "blessing-ul" activ
    const ambience = getAmbienceElement();

    if (ambienceSrc) {
      // Folosim src-ul real pentru ambience - asa iOS il va "blessa"
      ambience.src = ambienceSrc;
      ambience.volume = 0; // Volum 0, nu 0.001 - complet silent
      ambience.loop = true;

      try {
        await ambience.play();
        // NU facem pause! Lasam sa ruleze silent pentru a pastra blessing-ul iOS
        console.log('[AUDIO MANAGER] Ambience audio element unlocked and running silent');
      } catch (e) {
        console.warn('[AUDIO MANAGER] Ambience unlock with real src failed:', e.message);
        // Fallback la blob silent
        const url2 = URL.createObjectURL(blob);
        ambience.src = url2;
        ambience.volume = 0;
        ambience.loop = true;
        try {
          await ambience.play();
          // Din nou, nu facem pause
          URL.revokeObjectURL(url2);
          console.log('[AUDIO MANAGER] Ambience unlocked with fallback blob (running silent)');
        } catch (e2) {
          console.warn('[AUDIO MANAGER] Ambience fallback also failed:', e2.message);
          URL.revokeObjectURL(url2);
        }
      }
    } else {
      // Fallback daca nu avem src setat
      const url2 = URL.createObjectURL(blob);
      ambience.src = url2;
      ambience.volume = 0;
      ambience.loop = true;

      try {
        await ambience.play();
        // Nu facem pause
        URL.revokeObjectURL(url2);
        console.log('[AUDIO MANAGER] Ambience audio element unlocked (no src set, running silent)');
      } catch (e) {
        console.warn('[AUDIO MANAGER] Ambience unlock failed:', e.message);
        URL.revokeObjectURL(url2);
      }
    }

    // Unlock ringtone audio element - folosim src-ul real daca e setat
    const ringtone = getRingtoneElement();

    if (ringtoneSrc) {
      ringtone.src = ringtoneSrc;
      ringtone.volume = 0.001;

      try {
        await ringtone.play();
        await new Promise(resolve => setTimeout(resolve, 100));
        ringtone.pause();
        ringtone.currentTime = 0;
        ringtone.volume = 1;
        console.log('[AUDIO MANAGER] Ringtone audio element unlocked with real src');
      } catch (e) {
        console.warn('[AUDIO MANAGER] Ringtone unlock failed:', e.message);
      }
    }

    isUnlocked = true;
    console.log('[AUDIO MANAGER] Audio fully unlocked!');
    return true;

  } catch (error) {
    console.error('[AUDIO MANAGER] Unlock failed:', error);
    return false;
  }
};

/**
 * Verifica daca audio-ul e deblocat
 */
export const isAudioUnlocked = () => isUnlocked;

/**
 * Detecteaza daca suntem pe iOS
 */
const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

/**
 * Reda audio din base64 folosind resursele deblocate
 */
export const playBase64Audio = async (base64Audio, onEnded) => {
  const isiOS = isIOS();
  console.log('[AUDIO MANAGER] Playing base64 audio... iOS:', isiOS);

  if (!isUnlocked) {
    console.warn('[AUDIO MANAGER] Audio not unlocked! Attempting unlock...');
    await unlockAudio();
  }

  // Pe iOS, asteptam putin dupa ce microfonul s-a oprit pentru a permite sistemului sa elibereze audio session
  if (isiOS) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const audioBlob = base64ToBlob(base64Audio, 'audio/mpeg');

  // IMPORTANT iOS: Verificam si reluam AudioContext INAINTE de fiecare playback
  // iOS suspenda AudioContext dupa interactiuni cu microfonul
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    console.log('[AUDIO MANAGER] AudioContext suspended, resuming...');
    try {
      await ctx.resume();
      console.log('[AUDIO MANAGER] AudioContext resumed, state:', ctx.state);
    } catch (e) {
      console.warn('[AUDIO MANAGER] AudioContext resume failed:', e.message);
    }
  }

  // Pe iOS, folosim HTML5 Audio ca metoda primara (mai fiabil dupa microphone)
  // Pe desktop, folosim Web Audio API
  if (!isiOS && ctx && ctx.state === 'running') {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      let ended = false;
      const handleEnd = () => {
        if (ended) return;
        ended = true;
        console.log('[AUDIO MANAGER] Web Audio playback ended');
        if (onEnded) onEnded();
      };

      source.onended = handleEnd;

      // Timeout safety - daca audio nu se termina in 60 secunde, consideram ca s-a terminat
      const timeout = setTimeout(() => {
        if (!ended) {
          console.warn('[AUDIO MANAGER] Web Audio timeout, forcing end');
          handleEnd();
        }
      }, 60000);

      source.start(0);
      console.log('[AUDIO MANAGER] Playing via Web Audio API');

      return {
        stop: () => {
          clearTimeout(timeout);
          try { source.stop(); } catch (e) {}
          handleEnd();
        }
      };
    } catch (e) {
      console.warn('[AUDIO MANAGER] Web Audio failed:', e.message);
    }
  }

  // iOS sau fallback: HTML5 Audio
  console.log('[AUDIO MANAGER] Using HTML5 Audio, AudioContext state:', ctx?.state);
  const audio = getAudioElement();
  const audioUrl = URL.createObjectURL(audioBlob);

  return new Promise((resolve) => {
    let ended = false;
    let timeoutId = null;
    let stalledHandler = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (stalledHandler) {
        audio.removeEventListener('stalled', stalledHandler);
      }
      URL.revokeObjectURL(audioUrl);
    };

    const handleEnded = () => {
      if (ended) return;
      ended = true;
      console.log('[AUDIO MANAGER] HTML5 Audio playback ended');
      cleanup();
      if (onEnded) onEnded();
    };

    const handleError = (e) => {
      if (ended) return;
      ended = true;
      console.error('[AUDIO MANAGER] HTML5 Audio error:', e);
      cleanup();
      if (onEnded) onEnded();
    };

    stalledHandler = () => {
      console.warn('[AUDIO MANAGER] HTML5 Audio stalled');
    };

    // Seteaza src PRIMUL pe iOS
    audio.src = audioUrl;
    audio.volume = 1;

    // Apoi adauga listeners
    audio.addEventListener('ended', handleEnded, { once: true });
    audio.addEventListener('error', handleError, { once: true });
    audio.addEventListener('stalled', stalledHandler);

    // Timeout safety pentru iOS
    timeoutId = setTimeout(() => {
      if (!ended && audio.paused) {
        console.warn('[AUDIO MANAGER] HTML5 Audio timeout (paused), forcing end');
        handleEnded();
      }
    }, 30000);

    audio.play()
      .then(() => {
        console.log('[AUDIO MANAGER] HTML5 Audio playing, duration:', audio.duration);
        resolve({
          stop: () => {
            ended = true;
            audio.pause();
            cleanup();
          }
        });
      })
      .catch((e) => {
        console.error('[AUDIO MANAGER] HTML5 Audio play failed:', e.message);
        cleanup();
        if (onEnded) onEnded();
        resolve({ stop: () => {} });
      });
  });
};

/**
 * Obtine elementul Audio pentru ambience (il creeaza daca nu exista)
 */
export const getAmbienceElement = () => {
  if (!ambienceAudioElement) {
    ambienceAudioElement = new Audio();
    ambienceAudioElement.playsInline = true;
    ambienceAudioElement.setAttribute('playsinline', 'true');
    ambienceAudioElement.setAttribute('webkit-playsinline', 'true');
    ambienceAudioElement.loop = true;
    ambienceAudioElement.volume = 0.3;
    console.log('[AUDIO MANAGER] Created ambience Audio element');
  }
  return ambienceAudioElement;
};

/**
 * Obtine elementul Audio pentru ringtone (il creeaza daca nu exista)
 */
export const getRingtoneElement = () => {
  if (!ringtoneAudioElement) {
    ringtoneAudioElement = new Audio();
    ringtoneAudioElement.playsInline = true;
    ringtoneAudioElement.setAttribute('playsinline', 'true');
    ringtoneAudioElement.setAttribute('webkit-playsinline', 'true');
    ringtoneAudioElement.loop = false;
    ringtoneAudioElement.volume = 1;
    console.log('[AUDIO MANAGER] Created ringtone Audio element');
  }
  return ringtoneAudioElement;
};

/**
 * Porneste ambience audio (creste volumul - audio deja ruleaza silent dupa unlock)
 */
export const startAmbience = async (src) => {
  console.log('[AUDIO MANAGER] Starting ambience...');
  const audio = getAmbienceElement();

  // Verificam daca audio-ul deja ruleaza (de la unlock)
  if (!audio.paused) {
    // Audio deja ruleaza, doar crestem volumul
    audio.volume = 0.3;
    console.log('[AUDIO MANAGER] Ambience volume increased (was already playing)');
    return true;
  }

  // Daca nu ruleaza, incercam sa pornim (cazul desktop sau daca unlock a esuat)
  if (src && !audio.src.includes('ambience')) {
    console.log('[AUDIO MANAGER] Setting ambience src:', src);
    audio.src = src;
  }

  audio.loop = true;
  audio.volume = 0.3;

  try {
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      await playPromise;
    }
    console.log('[AUDIO MANAGER] Ambience playing');
    return true;
  } catch (e) {
    console.error('[AUDIO MANAGER] Ambience play failed:', e.message);
    // Incercam sa reincarcam si sa redam
    if (src) {
      try {
        audio.src = src;
        audio.load();
        await audio.play();
        console.log('[AUDIO MANAGER] Ambience playing after reload');
        return true;
      } catch (e2) {
        console.error('[AUDIO MANAGER] Ambience reload also failed:', e2.message);
      }
    }
    return false;
  }
};

/**
 * Opreste ambience audio (seteaza volum 0, nu pause - pentru iOS blessing)
 */
export const stopAmbience = () => {
  if (ambienceAudioElement) {
    ambienceAudioElement.volume = 0;
    // Pe iOS NU facem pause pentru a pastra blessing-ul
    // ambienceAudioElement.pause();
    // ambienceAudioElement.currentTime = 0;
    console.log('[AUDIO MANAGER] Ambience stopped (volume 0)');
  }
};

/**
 * Porneste ringtone audio
 */
export const playRingtone = async () => {
  console.log('[AUDIO MANAGER] Playing ringtone...');
  const audio = getRingtoneElement();

  // Daca src e diferit, il setam
  if (ringtoneSrc && !audio.src.includes('suna')) {
    audio.src = ringtoneSrc;
  }

  audio.currentTime = 0;
  audio.volume = 1;

  try {
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      await playPromise;
    }
    console.log('[AUDIO MANAGER] Ringtone playing');
    return true;
  } catch (e) {
    console.error('[AUDIO MANAGER] Ringtone play failed:', e.message);
    return false;
  }
};

/**
 * Opreste ringtone audio
 */
export const stopRingtone = () => {
  if (ringtoneAudioElement) {
    ringtoneAudioElement.pause();
    ringtoneAudioElement.currentTime = 0;
    console.log('[AUDIO MANAGER] Ringtone stopped');
  }
};

/**
 * Mute ambience
 */
export const muteAmbience = () => {
  if (ambienceAudioElement) {
    ambienceAudioElement.volume = 0;
    console.log('[AUDIO MANAGER] Ambience muted');
  }
};

/**
 * Unmute ambience - verifica si restarteaza daca e nevoie
 */
export const unmuteAmbience = async (volume = 0.3) => {
  console.log('[AUDIO MANAGER] Unmuting ambience to volume:', volume);

  if (!ambienceAudioElement) {
    console.warn('[AUDIO MANAGER] No ambience element, cannot unmute');
    return;
  }

  // Daca audio-ul e paused, incercam sa-l repornim
  if (ambienceAudioElement.paused) {
    console.log('[AUDIO MANAGER] Ambience was paused, trying to restart...');
    try {
      // Asiguram ca avem src corect
      if (ambienceSrc && !ambienceAudioElement.src.includes('ambience')) {
        ambienceAudioElement.src = ambienceSrc;
      }
      ambienceAudioElement.loop = true;
      ambienceAudioElement.volume = volume;
      await ambienceAudioElement.play();
      console.log('[AUDIO MANAGER] Ambience restarted successfully');
    } catch (e) {
      console.error('[AUDIO MANAGER] Failed to restart ambience:', e.message);
    }
  } else {
    // Audio ruleaza, doar setam volumul
    ambienceAudioElement.volume = volume;
    console.log('[AUDIO MANAGER] Ambience volume set to:', volume);
  }
};

// Helper: Base64 to Blob
function base64ToBlob(base64, mimeType) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

// Helper: Creeaza un WAV silent minimal
function createSilentWav() {
  const numChannels = 1;
  const sampleRate = 22050;
  const bitsPerSample = 8;
  const numSamples = sampleRate * 0.1; // 100ms
  const blockAlign = numChannels * bitsPerSample / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Silent audio data (128 = silence for 8-bit)
  for (let i = 0; i < numSamples; i++) {
    view.setUint8(44 + i, 128);
  }

  return buffer;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Reda audio predefinit dintr-un fisier (URL sau cale)
 * Folosit pentru audio-uri preinregistrate din agenda
 */
export const playPredefinedAudio = async (audioSrc, onEnded) => {
  console.log('[AUDIO MANAGER] Playing predefined audio:', audioSrc);

  if (!isUnlocked) {
    console.warn('[AUDIO MANAGER] Audio not unlocked! Attempting unlock...');
    await unlockAudio();
  }

  // Folosim elementul audio partajat
  const audio = getAudioElement();

  return new Promise((resolve) => {
    const cleanup = () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };

    const handleEnded = () => {
      console.log('[AUDIO MANAGER] Predefined audio playback ended');
      cleanup();
      if (onEnded) onEnded();
      resolve({ stop: () => {} });
    };

    const handleError = (e) => {
      console.error('[AUDIO MANAGER] Predefined audio error:', e);
      cleanup();
      if (onEnded) onEnded();
      resolve({ stop: () => {} });
    };

    audio.addEventListener('ended', handleEnded, { once: true });
    audio.addEventListener('error', handleError, { once: true });

    audio.src = audioSrc;
    audio.currentTime = 0;
    audio.volume = 1;

    audio.play()
      .then(() => {
        console.log('[AUDIO MANAGER] Predefined audio playing');
        resolve({
          stop: () => {
            audio.pause();
            audio.currentTime = 0;
            cleanup();
          }
        });
      })
      .catch((e) => {
        console.error('[AUDIO MANAGER] Predefined audio play failed:', e);
        cleanup();
        if (onEnded) onEnded();
        resolve({ stop: () => {} });
      });
  });
};
