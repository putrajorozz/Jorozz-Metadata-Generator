import { useState, useRef, useCallback } from 'react';

export interface UseBatchGeneratorOptions {
  onToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

/**
 * Manages batch queue control state:
 * - Pause / Resume / Cancel synchronization refs
 * - Session timing & progress tracking
 * - Model & API Key rotation indices
 * - Active model/key status displays
 */
export function useBatchGenerator({ onToast }: UseBatchGeneratorOptions) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsedBeforePause, setElapsedBeforePause] = useState<number>(0);

  const isPausedRef = useRef(false);
  const isCancelledRef = useRef(false);
  const pausePromiseResolveRef = useRef<(() => void) | null>(null);
  const sessionStartTimeRef = useRef<number | null>(null);

  // Persistent indices for successful model/key rotation
  const lastSuccessKeyIndex = useRef<number>(0);
  const lastSuccessModelIndex = useRef<number>(0);
  const lastSuccessGroqModelIndex = useRef<number>(0);

  const [autoRotateModel, setAutoRotateModel] = useState<boolean>(() => {
    const saved = localStorage.getItem('auto_rotate_model');
    return saved !== 'false';
  });

  const toggleAutoRotateModel = useCallback(() => {
    setAutoRotateModel(prev => {
      const next = !prev;
      localStorage.setItem('auto_rotate_model', JSON.stringify(next));
      onToast(
        next ? 'Auto-Rotate Gemini Model: AKTIF' : 'Auto-Rotate Gemini Model: NONAKTIF',
        next ? 'success' : 'info'
      );
      return next;
    });
  }, [onToast]);

  const [autoRotateGroqModel, setAutoRotateGroqModel] = useState<boolean>(() => {
    const saved = localStorage.getItem('auto_rotate_groq_model');
    return saved !== 'false';
  });

  const toggleAutoRotateGroqModel = useCallback(() => {
    setAutoRotateGroqModel(prev => {
      const next = !prev;
      localStorage.setItem('auto_rotate_groq_model', JSON.stringify(next));
      onToast(
        next ? 'Auto-Rotate Groq Model: AKTIF' : 'Auto-Rotate Groq Model: NONAKTIF',
        next ? 'success' : 'info'
      );
      return next;
    });
  }, [onToast]);

  const [autoRetryFailed, setAutoRetryFailed] = useState<boolean>(() => {
    const saved = localStorage.getItem('auto_retry_failed');
    return saved !== 'false';
  });

  const toggleAutoRetryFailed = useCallback(() => {
    setAutoRetryFailed(prev => {
      const next = !prev;
      localStorage.setItem('auto_retry_failed', JSON.stringify(next));
      onToast(
        next ? 'Auto-Retry Gambar Gagal: AKTIF' : 'Auto-Retry Gambar Gagal: NONAKTIF',
        next ? 'success' : 'info'
      );
      return next;
    });
  }, [onToast]);

  const waitIfPaused = useCallback(async () => {
    if (isPausedRef.current) {
      await new Promise<void>(resolve => {
        pausePromiseResolveRef.current = resolve;
      });
    }
  }, []);

  return {
    isGenerating,
    setIsGenerating,
    isPaused,
    setIsPaused,
    progress,
    setProgress,
    elapsedBeforePause,
    setElapsedBeforePause,
    isPausedRef,
    isCancelledRef,
    pausePromiseResolveRef,
    sessionStartTimeRef,
    lastSuccessKeyIndex,
    lastSuccessModelIndex,
    lastSuccessGroqModelIndex,
    autoRotateModel,
    toggleAutoRotateModel,
    autoRotateGroqModel,
    toggleAutoRotateGroqModel,
    autoRetryFailed,
    toggleAutoRetryFailed,
    waitIfPaused
  };
}
