const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sunapemosu-api.sunapemosu.workers.dev/api';

export const api = {
  async speechToText(audioBlob) {
    const formData = new FormData();
    // Determina extensia corecta bazata pe mime type
    // Suport pentru: webm, mp4, ogg, aac, mpeg (mp3)
    let filename = 'recording.webm';
    const mimeType = audioBlob.type.toLowerCase();

    if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
      filename = 'recording.mp4';
    } else if (mimeType.includes('ogg')) {
      filename = 'recording.ogg';
    } else if (mimeType.includes('aac')) {
      filename = 'recording.aac';
    } else if (mimeType.includes('mpeg') || mimeType.includes('mp3')) {
      filename = 'recording.mp3';
    } else if (mimeType.includes('wav')) {
      filename = 'recording.wav';
    }

    console.log('[STT] Sending audio:', filename, 'size:', audioBlob.size, 'type:', audioBlob.type);
    formData.append('audio', audioBlob, filename);

    const response = await fetch(`${API_BASE_URL}/speech-to-text`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to transcribe audio');
    }

    return response.json();
  },

  async chat(message, history = [], childInfo = null, conversationSummary = null, agendaStep = null, agendaPrompt = null, childState = null, mode = 'normal') {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        history,
        childInfo,
        conversationSummary,
        agendaStep,
        agendaPrompt,
        childState,
        mode, // 'normal' sau 'marketing'
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get response from Santa');
    }

    return response.json();
  },

  async textToSpeech(text, voiceId = null, voiceSettings = null) {
    const body = { text };
    if (voiceId) body.voice_id = voiceId;
    if (voiceSettings) body.voice_settings = voiceSettings;

    const response = await fetch(`${API_BASE_URL}/text-to-speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to convert text to speech');
    }

    return response.json();
  },

  async getSettings() {
    const response = await fetch(`${API_BASE_URL}/settings`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get settings');
    }

    return response.json();
  },

  async updateSettings(settings) {
    const response = await fetch(`${API_BASE_URL}/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update settings');
    }

    return response.json();
  },
};
