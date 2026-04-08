import { useEffect, useRef, useState } from 'react';

function createBeep(audioContext) {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(880, audioContext.currentTime);

  gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.15, audioContext.currentTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.28);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.3);
}

export function useFallAlarm(triggerKey, shouldAlarm) {
  const audioContextRef = useRef(null);
  const intervalRef = useRef(null);
  const [alarmActive, setAlarmActive] = useState(false);
  const [audioReady, setAudioReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return undefined;

    audioContextRef.current = new AudioContextCtor();

    const unlockAudio = async () => {
      try {
        if (audioContextRef.current?.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        setAudioReady(audioContextRef.current?.state === 'running');
      } catch {
        setAudioReady(false);
      }
    };

    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    unlockAudio();

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
      audioContextRef.current?.close?.();
    };
  }, []);

  useEffect(() => {
    if (!shouldAlarm || !triggerKey) return undefined;

    setAlarmActive(true);

    const playNow = async () => {
      const context = audioContextRef.current;
      if (!context) return;

      if (context.state === 'suspended') {
        try {
          await context.resume();
          setAudioReady(context.state === 'running');
        } catch {
          setAudioReady(false);
          return;
        }
      }

      createBeep(context);
    };

    playNow();
    intervalRef.current = window.setInterval(playNow, 900);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [triggerKey, shouldAlarm]);

  const stopAlarm = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setAlarmActive(false);
  };

  return {
    alarmActive,
    audioReady,
    stopAlarm,
  };
}
