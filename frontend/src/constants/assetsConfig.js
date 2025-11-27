// Cloudflare R2 URL pentru assets (videos, audio)
// In development, foloseste local assets; in production, foloseste R2
export const ASSETS_URL = import.meta.env.VITE_ASSETS_URL || 'https://pub-280ba5b3e86e4d6682d7859cd5f13463.r2.dev';

// Helper pentru a genera URL-uri complete
export const getVideoUrl = (filename) => `${ASSETS_URL}/videos/${filename}`;
export const getAudioUrl = (filename) => `${ASSETS_URL}/audio/${filename}`;
