import { useState, useEffect, useRef, useCallback } from 'react';
import { getSpeechRecognition, isSpeechRecognitionSupported } from '@/lib/speechSupport';

/**
 * Speech recognition error types with user-friendly messages
 */
export type SpeechErrorType =
  | 'not-allowed'
  | 'no-speech'
  | 'audio-capture'
  | 'network'
  | 'aborted'
  | 'service-not-allowed'
  | 'unknown';

export interface SpeechError {
  type: SpeechErrorType;
  message: string;
}

export interface UseSpeechRecognitionOptions {
  /** Callback when final transcript is ready */
  onFinalTranscript?: (transcript: string) => void;
}

export interface UseSpeechRecognitionState {
  /** Whether speech recognition is currently active */
  isListening: boolean;
  /** Interim (partial) transcribed text while speaking */
  interimTranscript: string;
  /** Current error state, if any */
  error: SpeechError | null;
  /** Whether the browser supports speech recognition */
  isSupported: boolean;
  /** Start listening for speech */
  startListening: () => void;
  /** Stop listening for speech */
  stopListening: () => void;
  /** Clear the error state */
  clearError: () => void;
}

/**
 * Map speech recognition error codes to user-friendly messages
 */
function mapErrorToMessage(errorType: string): SpeechError {
  switch (errorType) {
    case 'not-allowed':
      return {
        type: 'not-allowed',
        message: 'Microphone access denied. Please enable in browser settings.',
      };
    case 'no-speech':
      return {
        type: 'no-speech',
        message: 'No speech detected. Please try again.',
      };
    case 'audio-capture':
      return {
        type: 'audio-capture',
        message: 'No microphone found. Please check your device.',
      };
    case 'network':
      return {
        type: 'network',
        message: 'Network error. Voice input requires an internet connection.',
      };
    case 'aborted':
      return {
        type: 'aborted',
        message: '', // Silent - user cancelled
      };
    case 'service-not-allowed':
      return {
        type: 'service-not-allowed',
        message: 'Speech recognition service not allowed. Please use text input.',
      };
    default:
      return {
        type: 'unknown',
        message: 'Voice input failed. Please try typing instead.',
      };
  }
}

/**
 * Hook for browser-native speech recognition using Web Speech API
 *
 * @example
 * ```tsx
 * const { isListening, interimTranscript, error, isSupported, startListening, stopListening } = useSpeechRecognition({
 *   onFinalTranscript: (text) => setInputValue(text),
 * });
 *
 * if (!isSupported) return <p>Voice input not supported</p>;
 *
 * return (
 *   <button onClick={isListening ? stopListening : startListening}>
 *     {isListening ? 'Stop' : 'Start'}
 *   </button>
 * );
 * ```
 */
export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionState {
  const { onFinalTranscript } = options;

  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<SpeechError | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  const isSupported = isSpeechRecognitionSupported();

  // Keep callback ref up to date
  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  // Initialize recognition instance
  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognitionAPI = getSpeechRecognition();
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();

    // Configuration per story requirements
    recognition.continuous = false; // Stop after one phrase
    recognition.interimResults = true; // Show partial results
    recognition.lang = 'en-GB'; // British English for UK boxing market

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let currentInterim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          currentInterim += result[0].transcript;
        }
      }

      if (finalTranscript) {
        setInterimTranscript('');
        // Call the callback with the final transcript
        onFinalTranscriptRef.current?.(finalTranscript);
      } else {
        setInterimTranscript(currentInterim);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const speechError = mapErrorToMessage(event.error);
      // Don't set error for aborted (user cancelled)
      if (event.error !== 'aborted') {
        setError(speechError);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;

    // Cleanup on unmount
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, [isSupported]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;

    // Clear previous state
    setInterimTranscript('');
    setError(null);

    try {
      recognitionRef.current.start();
    } catch (err) {
      // Handle case where recognition is already started
      console.error('Speech recognition start error:', err);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) return;

    try {
      recognitionRef.current.stop();
    } catch (err) {
      // Handle case where recognition is already stopped
      console.error('Speech recognition stop error:', err);
    }
  }, [isListening]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isListening,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    clearError,
  };
}
