const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const api = {
  async speechToText(audioBlob) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    const response = await fetch(`${API_BASE_URL}/speech-to-text.php`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to transcribe audio');
    }

    return response.json();
  },

  async chat(message, history = [], childInfo = null) {
    const response = await fetch(`${API_BASE_URL}/chat.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        history,
        childInfo,
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

    const response = await fetch(`${API_BASE_URL}/text-to-speech.php`, {
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
    const response = await fetch(`${API_BASE_URL}/settings.php`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get settings');
    }

    return response.json();
  },

  async updateSettings(settings) {
    const response = await fetch(`${API_BASE_URL}/settings.php`, {
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
