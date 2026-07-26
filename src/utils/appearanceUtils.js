export const TEXT_SIZE_OPTIONS = ['small', 'normal', 'large'];
export const TEXT_SIZE_STORAGE_KEY = 'swm:text-size';

export function normalizeTextSize(value) {
  return TEXT_SIZE_OPTIONS.includes(value) ? value : 'normal';
}

export function applyTextSize(value) {
  const textSize = normalizeTextSize(value);
  if (typeof document !== 'undefined') document.documentElement.dataset.textSize = textSize;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(TEXT_SIZE_STORAGE_KEY, textSize);
    } catch {
      // The preference still applies for the current page when storage is unavailable.
    }
  }
  return textSize;
}

export function initializeTextSize() {
  if (typeof localStorage === 'undefined') return applyTextSize('normal');
  try {
    return applyTextSize(localStorage.getItem(TEXT_SIZE_STORAGE_KEY));
  } catch {
    return applyTextSize('normal');
  }
}
