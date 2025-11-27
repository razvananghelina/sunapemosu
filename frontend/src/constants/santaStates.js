export const SANTA_STATES = {
  IDLE: 'idle',
  CALLING: 'calling',
  INTRO: 'intro',
  GREETING: 'greeting',
  LISTENING: 'listening',
  LAUGHING: 'laughing',
  SURPRISED: 'surprised',
  HAPPY: 'happy',
  THINKING: 'thinking',
  SPEAKING: 'speaking',
  // Stari multiple de speaking - definite de utilizator
  SPEAKING_NORMAL: 'speaking_normal',
  SPEAKING_AMUSED: 'speaking_amused',
  SPEAKING_AMAZED: 'speaking_amazed',
  SAD: 'sad',
  EXCITED: 'excited',
  CURIOUS: 'curious',
};

// Lista de stari de speaking disponibile
export const SPEAKING_STATES_LIST = [
  SANTA_STATES.SPEAKING,
  SANTA_STATES.SPEAKING_NORMAL,
  SANTA_STATES.SPEAKING_AMUSED,
  SANTA_STATES.SPEAKING_AMAZED,
];

// Helper pentru a verifica daca o stare e de tip speaking
export const isSpeakingState = (state) => {
  return SPEAKING_STATES_LIST.includes(state);
};

export const SANTA_STATES_LIST = Object.values(SANTA_STATES);
