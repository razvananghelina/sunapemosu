// Configurație pentru video-urile Moșului
export const VIDEO_CONFIG = {
  intro: {
    src: '/videos/intro.mp4',
    loop: false,
    description: 'Video de introducere când începe apelul'
  },
  listening: {
    src: '/videos/listening.mp4',
    loop: true,
    description: 'Moșul ascultă - se repetă continuu'
  },
  listening2: {
    src: '/videos/listening2.mp4',
    loop: true,
    description: 'Moșul ascultă - varianta 2'
  },
  speaking: {
    src: '/videos/speaks.mp4',
    loop: true,
    description: 'Moșul vorbește normal'
  },
  kids_list: {
    src: '/videos/kids_list.mp4',
    loop: true,
    description: 'Moșul vorbește despre lista copiilor - varianta 1'
  },
  kids_list2: {
    src: '/videos/kids_list2.mp4',
    loop: true,
    description: 'Moșul vorbește despre lista copiilor - varianta 2'
  },
  kids_list3: {
    src: '/videos/kids_list3.mp4',
    loop: true,
    description: 'Moșul vorbește despre lista copiilor - varianta 3'
  },
  laughing: {
    src: '/videos/laughing.mp4',
    loop: true,
    description: 'Moșul râde'
  },
  amazed: {
    src: '/videos/amazed.mp4',
    loop: true,
    description: 'Moșul este uimit/surprins'
  },
  elfs_working: {
    src: '/videos/elfs_working.mp4',
    loop: true,
    description: 'Moșul vorbește despre elfii care lucrează'
  }
};

// Mapare între stările Santa și video-urile corespunzătoare
export const STATE_TO_VIDEO = {
  intro: 'intro',
  greeting: 'speaking',
  listening: 'listening',
  speaking: 'speaking',
  laughing: 'laughing',
  surprised: 'amazed',
  happy: 'laughing',
  thinking: 'speaking',
  sad: 'speaking',
  excited: 'laughing',
  curious: 'amazed',
};
