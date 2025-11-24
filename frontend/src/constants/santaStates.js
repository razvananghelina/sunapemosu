export const SANTA_STATES = {
  GREETING: 'greeting',
  LISTENING: 'listening',
  LAUGHING: 'laughing',
  SURPRISED: 'surprised',
  HAPPY: 'happy',
  THINKING: 'thinking',
  SPEAKING: 'speaking',
  SAD: 'sad',
  EXCITED: 'excited',
  CURIOUS: 'curious',
};

export const SANTA_STATES_LIST = Object.values(SANTA_STATES);

// Mapare video pentru fiecare stare (placeholder pentru viitor)
export const SANTA_VIDEOS = {
  [SANTA_STATES.GREETING]: '/videos/greeting.mp4',
  [SANTA_STATES.LISTENING]: '/videos/listening.mp4',
  [SANTA_STATES.LAUGHING]: '/videos/laughing.mp4',
  [SANTA_STATES.SURPRISED]: '/videos/surprised.mp4',
  [SANTA_STATES.HAPPY]: '/videos/happy.mp4',
  [SANTA_STATES.THINKING]: '/videos/thinking.mp4',
  [SANTA_STATES.SPEAKING]: '/videos/speaking.mp4',
  [SANTA_STATES.SAD]: '/videos/sad.mp4',
  [SANTA_STATES.EXCITED]: '/videos/excited.mp4',
  [SANTA_STATES.CURIOUS]: '/videos/curious.mp4',
};
