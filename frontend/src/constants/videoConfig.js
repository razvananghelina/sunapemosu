import { getVideoUrl } from './assetsConfig';

// Configurație pentru video-urile Moșului
export const VIDEO_CONFIG = {
  intro: {
    src: getVideoUrl('intro.mp4'),
    loop: false,
    description: 'Video de introducere când începe apelul'
  },
  listening: {
    src: getVideoUrl('listening.mp4'),
    loop: true,
    description: 'Moșul ascultă - se repetă continuu'
  },
  speaking: {
    src: getVideoUrl('speaks.mp4'),
    loop: true,
    description: 'Moșul vorbește normal'
  },
  // Stari multiple de speaking - pentru varietate in conversatie
  speaking_normal: {
    src: getVideoUrl('speaks.mp4'),
    loop: true,
    description: 'Moșul vorbește normal'
  },
  speaking_amused: {
    src: getVideoUrl('speaks_amused.mp4'),
    loop: true,
    description: 'Moșul vorbește amuzat'
  },
  speaking_amazed: {
    src: getVideoUrl('speaks_amazed.mp4'),
    loop: true,
    description: 'Moșul vorbește uimit'
  },
  kids_list: {
    src: getVideoUrl('kids_list.mp4'),
    loop: false,
    description: 'Moșul caută pe lista de copii cuminți'
  },
  laughing: {
    src: getVideoUrl('laughing.mp4'),
    loop: false,
    description: 'Moșul râde'
  },
  amazed: {
    src: getVideoUrl('amazed.mp4'),
    loop: false,
    description: 'Moșul este uimit/surprins'
  },
  elfs_working: {
    src: getVideoUrl('elfs_working.mp4'),
    loop: false,
    description: 'Elfii lucrează la cadouri'
  },
  flight: {
    src: getVideoUrl('flight.mp4'),
    loop: false,
    description: 'Zbor magic cu sania si renii'
  },
  glitch: {
    src: getVideoUrl('glitch.mp4'),
    loop: true,
    description: 'Efect de glitch - se afiseaza cand asteptam raspunsul'
  },
  polulnord: {
    src: getVideoUrl('polulnord.mp4'),
    loop: false,
    description: 'Imagini cu Polul Nord'
  }
};

// Mapare între stările Santa și video-urile corespunzătoare
export const STATE_TO_VIDEO = {
  intro: 'intro',
  greeting: 'speaking',
  listening: 'listening',
  speaking: 'speaking',
  // Stari multiple de speaking
  speaking_normal: 'speaking_normal',
  speaking_amused: 'speaking_amused',
  speaking_amazed: 'speaking_amazed',
  laughing: 'laughing',
  surprised: 'amazed',
  happy: 'laughing',
  thinking: 'speaking',
  sad: 'speaking',
  excited: 'laughing',
  curious: 'amazed',
};
