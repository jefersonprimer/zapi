"use client";

import React, { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";

interface AudioPlayerProps {
  uri: string;
  isMine: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ uri, isMine }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<number>(1.0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [uri]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch((err) => console.error("Playback error:", err));
    }
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const timeline = timelineRef.current;
    const audio = audioRef.current;
    if (!timeline || !audio || duration <= 0) return;

    const rect = timeline.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const newTime = (clickX / rect.width) * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const changeSpeed = () => {
    let nextSpeed = 1.0;
    if (speed === 1.0) nextSpeed = 1.5;
    else if (speed === 1.5) nextSpeed = 2.0;
    else nextSpeed = 1.0;
    setSpeed(nextSpeed);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds <= 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-2xl max-w-[280px] sm:max-w-[320px] w-full my-1 transition-all ${
        isMine
          ? "bg-neutral-800/90 text-white dark:bg-white dark:text-neutral-900 shadow-sm"
          : "bg-neutral-200/70 dark:bg-neutral-800/80 text-foreground border border-black/5 dark:border-white/5"
      }`}
    >
      <audio ref={audioRef} src={uri} preload="metadata" />

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlayPause}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-transform active:scale-95 cursor-pointer ${
          isMine
            ? "bg-white text-neutral-900 dark:bg-neutral-900 dark:text-white"
            : "bg-neutral-900 text-white dark:bg-emerald-500 dark:text-white shadow-md"
        }`}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="h-4 w-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Timeline & Metadata */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
        <div
          ref={timelineRef}
          onClick={handleTimelineClick}
          className="relative w-full h-2 bg-black/15 dark:bg-white/20 rounded-full cursor-pointer group flex items-center"
        >
          <div
            className={`h-full rounded-full transition-all ${
              isMine
                ? "bg-white dark:bg-neutral-900"
                : "bg-neutral-900 dark:bg-emerald-500"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full shadow-md transition-transform group-hover:scale-125 ${
              isMine
                ? "bg-white dark:bg-neutral-900"
                : "bg-neutral-900 dark:bg-emerald-500"
            }`}
            style={{ left: `calc(${progressPercent}% - 7px)` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-medium opacity-80 select-none">
          <span>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <button
            type="button"
            onClick={changeSpeed}
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold transition-colors cursor-pointer ${
              isMine
                ? "bg-white/20 hover:bg-white/30 dark:bg-neutral-900/10 dark:hover:bg-neutral-900/20"
                : "bg-black/10 hover:bg-black/15 dark:bg-white/10 dark:hover:bg-white/20"
            }`}
          >
            {speed.toFixed(1)}x
          </button>
        </div>
      </div>
    </div>
  );
};
