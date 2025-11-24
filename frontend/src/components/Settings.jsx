import { useState, useEffect } from 'react';
import { FaSave, FaArrowLeft } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './Settings.css';

export const Settings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [settings, setSettings] = useState({
    voice_id: '',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: true
    }
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await api.getSettings();
      setSettings(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      await api.updateSettings(settings);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleVoiceIdChange = (e) => {
    setSettings(prev => ({
      ...prev,
      voice_id: e.target.value
    }));
  };

  const handleVoiceSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      voice_settings: {
        ...prev.voice_settings,
        [key]: value
      }
    }));
  };

  if (loading) {
    return (
      <div className="settings">
        <div className="settings-container">
          <p>Se incarca...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings">
      <div className="settings-container">
        <div className="settings-header">
          <button className="back-button" onClick={() => navigate('/')}>
            <FaArrowLeft />
          </button>
          <h1>Setari Eleven Labs</h1>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            Setarile au fost salvate cu succes!
          </div>
        )}

        <div className="settings-form">
          <div className="form-group">
            <label htmlFor="voice_id">Voice ID</label>
            <input
              type="text"
              id="voice_id"
              value={settings.voice_id}
              onChange={handleVoiceIdChange}
              placeholder="Introdu Voice ID de la Eleven Labs"
            />
            <small>Gaseste Voice ID in contul tau Eleven Labs</small>
          </div>

          <div className="form-section">
            <h2>Voice Settings</h2>

            <div className="form-group">
              <label htmlFor="stability">
                Stability: {settings.voice_settings.stability.toFixed(2)}
              </label>
              <input
                type="range"
                id="stability"
                min="0"
                max="1"
                step="0.01"
                value={settings.voice_settings.stability}
                onChange={(e) => handleVoiceSettingChange('stability', parseFloat(e.target.value))}
              />
              <small>Controleaza consistenta vocii (0 = mai variata, 1 = mai stabila)</small>
            </div>

            <div className="form-group">
              <label htmlFor="similarity_boost">
                Similarity Boost: {settings.voice_settings.similarity_boost.toFixed(2)}
              </label>
              <input
                type="range"
                id="similarity_boost"
                min="0"
                max="1"
                step="0.01"
                value={settings.voice_settings.similarity_boost}
                onChange={(e) => handleVoiceSettingChange('similarity_boost', parseFloat(e.target.value))}
              />
              <small>Creste similaritatea cu vocea originala</small>
            </div>

            <div className="form-group">
              <label htmlFor="style">
                Style: {settings.voice_settings.style.toFixed(2)}
              </label>
              <input
                type="range"
                id="style"
                min="0"
                max="1"
                step="0.01"
                value={settings.voice_settings.style}
                onChange={(e) => handleVoiceSettingChange('style', parseFloat(e.target.value))}
              />
              <small>Exagerarea stilului (0 = normal, 1 = mai exagerat)</small>
            </div>

            <div className="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={settings.voice_settings.use_speaker_boost}
                  onChange={(e) => handleVoiceSettingChange('use_speaker_boost', e.target.checked)}
                />
                <span>Use Speaker Boost</span>
              </label>
              <small>Imbunatateste claritatea vocii</small>
            </div>
          </div>

          <button
            className="save-button"
            onClick={handleSave}
            disabled={saving}
          >
            <FaSave />
            <span>{saving ? 'Se salveaza...' : 'Salveaza Setarile'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
