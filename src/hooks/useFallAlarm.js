import { useCallback, useEffect, useRef, useState } from 'react';

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

export function useFallAlarm({ active, alarmKey }) {
  const contextRef = useRef(null);
  const oscillatorRef = useRef(null);
  const gainRef = useRef(null);
  const cadenceRef = useRef(null);
  const previewTimeoutRef = useRef(null);
  const activeRef = useRef(active);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSilenced, setIsSilenced] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const stopAlarm = useCallback(() => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }

    if (cadenceRef.current) {
      clearInterval(cadenceRef.current);
      cadenceRef.current = null;
    }

    const context = contextRef.current;

    if (gainRef.current && context) {
      const now = context.currentTime;
      gainRef.current.gain.cancelScheduledValues(now);
      gainRef.current.gain.setValueAtTime(gainRef.current.gain.value, now);
      gainRef.current.gain.linearRampToValueAtTime(0.0001, now + 0.08);
    }

    if (oscillatorRef.current && context) {
      try {
        oscillatorRef.current.stop(context.currentTime + 0.1);
      } catch (error) {
        // Oscillator may already be stopped.
      }
    }

    oscillatorRef.current = null;
    gainRef.current = null;
    setIsTesting(false);
    setIsPlaying(false);
  }, []);

  const ensureContext = useCallback(async () => {
    const AudioContextCtor = getAudioContext();
    if (!AudioContextCtor) return null;

    if (!contextRef.current) {
      contextRef.current = new AudioContextCtor();
    }

    if (contextRef.current.state === 'suspended') {
      await contextRef.current.resume();
    }

    return contextRef.current;
  }, []);

  const startAlarm = useCallback(async ({ allowWhenInactive = false, previewMs = 0 } = {}) => {
    if (!allowWhenInactive && (!activeRef.current || isSilenced)) return false;

    const context = await ensureContext();
    if (!context) return false;

    if (context.state !== 'running') {
      setNeedsInteraction(true);
      return false;
    }

    if (oscillatorRef.current) {
      setIsPlaying(true);
      return true;
    }

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(900, context.currentTime);
    gainNode.gain.setValueAtTime(0.0001, context.currentTime);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start();

    let highTone = true;
    const pulse = () => {
      const now = context.currentTime;
      oscillator.frequency.cancelScheduledValues(now);
      gainNode.gain.cancelScheduledValues(now);
      oscillator.frequency.setValueAtTime(highTone ? 980 : 660, now);
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.linearRampToValueAtTime(0.09, now + 0.04);
      gainNode.gain.linearRampToValueAtTime(0.03, now + 0.22);
      gainNode.gain.linearRampToValueAtTime(0.0001, now + 0.55);
      highTone = !highTone;
    };

    pulse();
    cadenceRef.current = setInterval(pulse, 600);
    oscillatorRef.current = oscillator;
    gainRef.current = gainNode;
    setNeedsInteraction(false);
    setIsTesting(previewMs > 0);
    setIsPlaying(true);

    if (previewMs > 0) {
      previewTimeoutRef.current = setTimeout(() => {
        stopAlarm();
      }, previewMs);
    }

    return true;
  }, [ensureContext, isSilenced, stopAlarm]);

  const enableAlarmAudio = useCallback(async () => {
    try {
      const context = await ensureContext();
      if (!context || context.state !== 'running') {
        setNeedsInteraction(true);
        return false;
      }

      setNeedsInteraction(false);
      if (activeRef.current && !isSilenced) {
        await startAlarm();
      }
      return true;
    } catch (error) {
      setNeedsInteraction(true);
      return false;
    }
  }, [ensureContext, isSilenced, startAlarm]);

  const silenceAlarm = useCallback(() => {
    setIsSilenced(true);
    stopAlarm();
  }, [stopAlarm]);

  const playTestAlarm = useCallback(async () => {
    setIsSilenced(false);
    return startAlarm({ allowWhenInactive: true, previewMs: 2400 });
  }, [startAlarm]);

  useEffect(() => {
    setIsSilenced(false);
    setNeedsInteraction(false);
  }, [alarmKey]);

  useEffect(() => {
    if (!active || isSilenced) {
      stopAlarm();
      return;
    }

    startAlarm();
  }, [active, isSilenced, startAlarm, stopAlarm]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const unlockAudio = () => {
      enableAlarmAudio();
    };

    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    window.addEventListener('touchstart', unlockAudio, { once: true });

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, [enableAlarmAudio]);

  useEffect(() => () => stopAlarm(), [stopAlarm]);

  return {
    enableAlarmAudio,
    isPlaying,
    isSilenced,
    isTesting,
    needsInteraction,
    playTestAlarm,
    silenceAlarm,
  };
}
