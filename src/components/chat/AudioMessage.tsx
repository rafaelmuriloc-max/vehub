import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Mic, User } from 'lucide-react';

interface AudioMessageProps {
  mediaUrl: string;
  avatarUrl?: string;
  tint?: 'green' | 'white';
}

const BAR_COUNT = 40;

function seededBars(seed: string): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const bars: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    h = (h * 1664525 + 1013904223) | 0;
    const v = ((h >>> 0) % 100) / 100; // 0-1
    bars.push(0.2 + v * 0.8);
  }
  return bars;
}

function fmt(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function AudioMessage({ mediaUrl, avatarUrl, tint = 'white' }: AudioMessageProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const bars = seededBars(mediaUrl);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrent(a.currentTime);
    const onMeta = () => setDuration(isFinite(a.duration) ? a.duration : 0);
    const onEnd = () => { setPlaying(false); setCurrent(0); };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('durationchange', onMeta);
    a.addEventListener('ended', onEnd);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('durationchange', onMeta);
      a.removeEventListener('ended', onEnd);
    };
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.currentTime = ratio * duration;
    setCurrent(a.currentTime);
  };

  const progress = duration ? current / duration : 0;
  const playedBars = Math.floor(progress * BAR_COUNT);
  const dotLeft = `${progress * 100}%`;
  const isGreen = tint === 'green';
  const playedColor = isGreen ? 'bg-emerald-700' : 'bg-sky-500';
  const dotColor = isGreen ? 'bg-emerald-700' : 'bg-sky-500';
  const baseBar = 'bg-zinc-400/60';

  return (
    <div className="flex items-center gap-3 py-1 min-w-[240px] sm:min-w-[260px]">
      {/* Avatar with mic badge */}
      <div className="relative shrink-0">
        <div className="h-10 w-10 rounded-full overflow-hidden bg-muted flex items-center justify-center">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <User className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center shadow">
          <Mic className="h-2.5 w-2.5 text-[#E8710A]" fill="currentColor" />
        </div>
      </div>

      {/* Play/Pause */}
      <button
        onClick={toggle}
        className="shrink-0 h-7 w-7 flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:opacity-80"
        aria-label={playing ? 'Pausar' : 'Reproduzir'}
      >
        {playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5" fill="currentColor" />}
      </button>

      {/* Waveform + time */}
      <div className="flex-1 min-w-0">
        <div
          className="relative h-8 flex items-center gap-[2px] cursor-pointer"
          onClick={seekTo}
        >
          {bars.map((h, i) => (
            <div
              key={i}
              className={`flex-1 rounded-full ${i < playedBars ? playedColor : baseBar}`}
              style={{ height: `${Math.round(h * 100)}%`, minWidth: 2 }}
            />
          ))}
          {/* moving dot */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full ${dotColor} shadow`}
            style={{ left: dotLeft }}
          />
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {fmt(playing || current > 0 ? current : duration)}
        </div>
      </div>

      <audio ref={audioRef} src={mediaUrl} preload="metadata" className="hidden" />
    </div>
  );
}
