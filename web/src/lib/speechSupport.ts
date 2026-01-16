/**
 * Browser detection utilities for Web Speech API
 *
 * Browser Support:
 * - Chrome (desktop & Android): Full support
 * - Edge: Full support
 * - Safari (iOS & macOS): Supported with webkitSpeechRecognition prefix
 * - Firefox: NOT supported
 */

// Get the SpeechRecognition constructor (with vendor prefix fallback)
export function getSpeechRecognition(): typeof SpeechRecognition | null {
  if (typeof window === 'undefined') return null;

  const SpeechRecognitionAPI =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  return SpeechRecognitionAPI || null;
}

// Check if speech recognition is supported in the current browser
export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognition() !== null;
}

// Type augmentation for webkit prefix
declare global {
  interface Window {
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }
}
