const authUrl = import.meta.env.VITE_NEON_AUTH_URL?.trim();
const dataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL?.trim();

function isHttpUrl(value) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export const cloudConfigured = isHttpUrl(authUrl) && isHttpUrl(dataApiUrl);
export const cloudUrls = { authUrl, dataApiUrl };
