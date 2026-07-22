"use client";

import React, { useState, useRef, useEffect } from "react";
import { Trash2, Pause, Play, Send } from "lucide-react";

interface VoiceNoteRecorderBarProps {
  recordingDuration: number;
  isPaused: boolean;
  onPauseResumeRecording: () => void;
  onStopRecording: () => void; // Discards/trashes recording
  recordedUri?: string | null;
  onStopAndPreview?: () => void;
  onSendAudio?: () => void;
}

export const VoiceNoteRecorderBar: React.FC<VoiceNoteRecorderBarProps> = ({
  recordingDuration,
  isPaused,
  onPauseResumeRecording,
  onStopRecording,
  recordedUri,
  onStopAndPreview,
  onSendAudio,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);

  // Auto-play when recordedUri preview becomes available
  useEffect(() => {
    if (recordedUri && audioRef.current) {
      audioRef.current.play().then(() => setIsPlayingPreview(true)).catch(() => {});
    }
  }, [recordedUri]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentPosition(audio.currentTime);
    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setPreviewDuration(audio.duration);
      }
    };
    const handleEnded = () => {
      setIsPlayingPreview(false);
      setCurrentPosition(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [recordedUri]);

  const togglePreviewPlayPause = () => {
    if (!recordedUri) {
      if (onStopAndPreview) onStopAndPreview();
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    if (isPlayingPreview) {
      audio.pause();
      setIsPlayingPreview(false);
    } else {
      audio.play().then(() => setIsPlayingPreview(true)).catch((err) => console.error(err));
    }
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!recordedUri) {
      if (onStopAndPreview) onStopAndPreview();
      return;
    }
    const timeline = timelineRef.current;
    const audio = audioRef.current;
    if (!timeline || !audio || previewDuration <= 0) return;

    const rect = timeline.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const newPos = (clickX / rect.width) * previewDuration;
    audio.currentTime = newPos;
    setCurrentPosition(newPos);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds <= 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const effectiveDuration = previewDuration > 0 ? previewDuration : recordingDuration;
  const progressPercent = effectiveDuration > 0 ? (currentPosition / effectiveDuration) * 100 : 0;

  return (
    <div className="flex flex-col w-full py-1.5 px-2 gap-2 animate-fade-in">
      {recordedUri && <audio ref={audioRef} src={recordedUri} preload="metadata" />}

      {/* 1. Preview Player (Visible when paused or recordedUri is set) */}
      {(isPaused || recordedUri) && (
        <div className="flex items-center gap-3 bg-neutral-200/60 dark:bg-neutral-800/60 border border-card-border p-2 rounded-xl transition-all">
          <button
            type="button"
            onClick={togglePreviewPlayPause}
            className="w-8 h-8 rounded-full bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 transition-transform active:scale-95 cursor-pointer shadow-sm"
          >
            {isPlayingPreview ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="h-4 w-4 fill-current ml-0.5" />
            )}
          </button>

          <div
            ref={timelineRef}
            onClick={handleTimelineClick}
            className="flex-1 relative h-2 bg-black/15 dark:bg-white/20 rounded-full cursor-pointer group flex items-center"
          >
            <div
              className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-emerald-600 dark:bg-emerald-500 rounded-full shadow transition-transform group-hover:scale-125"
              style={{ left: `calc(${progressPercent}% - 7px)` }}
            />
          </div>

          <span className="text-xs font-medium text-muted-text select-none min-w-[70px] text-right">
            {formatTime(currentPosition)} / {formatTime(effectiveDuration)}
          </span>
        </div>
      )}

      {/* 2. Status Row */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isPaused || recordedUri
                ? "bg-neutral-400 dark:bg-neutral-500"
                : "bg-red-500 animate-pulse"
            }`}
          />
          <span
            className={`text-xs font-semibold select-none ${
              isPaused || recordedUri
                ? "text-muted-text"
                : "text-red-500 dark:text-red-400"
            }`}
          >
            {isPaused || recordedUri ? "Gravação pausada" : "Gravando áudio"}
          </span>
        </div>

        <span className="text-xs font-mono font-medium text-foreground select-none">
          {formatDuration(recordingDuration)}
        </span>
      </div>

      {/* 3. Bottom Action Row */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        {/* Left: Trash Button */}
        <button
          type="button"
          onClick={onStopRecording}
          title="Descartar gravação"
          className="w-10 h-10 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center transition-all cursor-pointer active:scale-95"
        >
          <Trash2 className="h-5 w-5" />
        </button>

        {/* Middle: Pause / Resume Button */}
        {!recordedUri && (
          <button
            type="button"
            onClick={onPauseResumeRecording}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-card-border bg-neutral-100 hover:bg-neutral-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-emerald-600 dark:text-emerald-400 text-xs font-semibold transition-all cursor-pointer active:scale-95 shadow-sm"
          >
            {isPaused ? (
              <>
                <Play className="h-4 w-4 fill-current" />
                <span>Continuar</span>
              </>
            ) : (
              <>
                <Pause className="h-4 w-4 fill-current" />
                <span>Pausar</span>
              </>
            )}
          </button>
        )}

        {/* Right: Send Button */}
        <button
          type="button"
          onClick={onSendAudio}
          title="Enviar áudio"
          className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-md"
        >
          <Send className="h-4 w-4 ml-0.5" />
        </button>
      </div>
    </div>
  );
};
