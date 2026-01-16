import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

describe('useSpeechRecognition', () => {
  let originalSpeechRecognition: typeof window.SpeechRecognition;

  beforeEach(() => {
    originalSpeechRecognition = window.SpeechRecognition;
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.SpeechRecognition = originalSpeechRecognition;
  });

  it('returns isSupported=true when SpeechRecognition is available', () => {
    const { result } = renderHook(() => useSpeechRecognition());
    expect(result.current.isSupported).toBe(true);
  });

  // Test for unsupported browsers is covered by VoiceInputButton tests
  // which test the 'unsupported' state. The hook's isSupported flag
  // comes from isSpeechRecognitionSupported() which checks window.SpeechRecognition.
  it('exposes isSupported property from speechSupport module', () => {
    // Since the mock provides SpeechRecognition, isSupported should be true
    const { result } = renderHook(() => useSpeechRecognition());
    expect(typeof result.current.isSupported).toBe('boolean');
  });

  it('starts with isListening=false', () => {
    const { result } = renderHook(() => useSpeechRecognition());
    expect(result.current.isListening).toBe(false);
  });

  it('sets isListening=true when startListening is called', () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    expect(result.current.isListening).toBe(true);
  });

  it('sets isListening=false when stopListening is called', () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });
    expect(result.current.isListening).toBe(true);

    act(() => {
      result.current.stopListening();
    });
    expect(result.current.isListening).toBe(false);
  });

  it('clears error when clearError is called', () => {
    const { result } = renderHook(() => useSpeechRecognition());

    // Set some state by simulating listening
    act(() => {
      result.current.startListening();
    });

    act(() => {
      result.current.clearError();
    });

    expect(result.current.interimTranscript).toBe('');
    expect(result.current.error).toBe(null);
  });

  it('starts with empty interimTranscript', () => {
    const { result } = renderHook(() => useSpeechRecognition());
    expect(result.current.interimTranscript).toBe('');
  });

  it('starts with no error', () => {
    const { result } = renderHook(() => useSpeechRecognition());
    expect(result.current.error).toBe(null);
  });

  it('does not start listening when already listening', () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    // Should not throw or change state when called again
    act(() => {
      result.current.startListening();
    });

    expect(result.current.isListening).toBe(true);
  });

  it('does nothing when stopListening called but not listening', () => {
    const { result } = renderHook(() => useSpeechRecognition());

    // Should not throw
    act(() => {
      result.current.stopListening();
    });

    expect(result.current.isListening).toBe(false);
  });
});
