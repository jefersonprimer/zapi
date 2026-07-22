"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Pause, Play, BadgeCheck } from "lucide-react";
import Image from "next/image";
import type { Story } from "@/lib/updates-api";
import { getImageUrl } from "@/lib/utils";

interface StoryViewerModalProps {
  stories: Story[];
  initialIndex?: number;
  onClose: () => void;
  onStoryViewed: (storyId: string) => void;
}

export default function StoryViewerModal({
  stories,
  initialIndex = 0,
  onClose,
  onStoryViewed,
}: StoryViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentStory = stories[currentIndex];
  const attachment = currentStory?.attachments?.[0];
  const mediaUrl = attachment?.url ? getImageUrl(attachment.url) : null;
  const isVideo =
    attachment?.type === "video" ||
    attachment?.mime_type?.startsWith("video/") === true;

  const storyDurationMs = isVideo
    ? Math.max((attachment?.duration ?? 15) * 1000, 5000)
    : 5000;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const goNext = useCallback(() => {
    clearTimer();
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((i) => i + 1);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentIndex, stories.length, clearTimer, onClose]);

  const goPrev = useCallback(() => {
    clearTimer();
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setProgress(0);
    }
  }, [currentIndex, clearTimer]);

  useEffect(() => {
    if (!currentStory) return;

    if (!currentStory.viewed) {
      onStoryViewed(currentStory.id);
    }

    clearTimer();
    if (isPaused) return;

    const startTime = Date.now();
    const interval = 50;

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(elapsed / storyDurationMs, 1);
      setProgress(pct);

      if (pct >= 1) {
        clearTimer();
        goNext();
      }
    }, interval);

    return () => clearTimer();
  }, [currentIndex, currentStory, isPaused, storyDurationMs, goNext, onStoryViewed, clearTimer]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === " ") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev, onClose]);

  if (!currentStory) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
      {/* Container Card */}
      <div 
        className="relative w-full max-w-md h-[90vh] max-h-[800px] bg-black rounded-2xl overflow-hidden shadow-2xl flex flex-col justify-between select-none"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Top Progress Bars */}
        <div className="absolute top-0 inset-x-0 z-20 p-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          <div className="flex gap-1.5 mb-3">
            {stories.map((s, idx) => (
              <div key={s.id} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-75"
                  style={{
                    width:
                      idx < currentIndex
                        ? "100%"
                        : idx === currentIndex
                        ? `${progress * 100}%`
                        : "0%",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 rounded-full overflow-hidden border border-white/40">
                {currentStory.publisher_avatar ? (
                  <Image
                    src={getImageUrl(currentStory.publisher_avatar)}
                    alt={currentStory.publisher_name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-xs">
                    {currentStory.publisher_name.charAt(0)}
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <h4 className="text-white text-sm font-bold truncate max-w-[180px]">
                    {currentStory.publisher_name}
                  </h4>
                  {currentStory.is_verified && (
                    <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                </div>
                <span className="text-[11px] text-white/70">
                  {new Date(currentStory.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="text-white/80 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
                title={isPaused ? "Continuar" : "Pausar"}
              >
                {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
              </button>
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
                title="Fechar"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Media / Content Area */}
        <div className="relative w-full h-full flex items-center justify-center">
          {mediaUrl ? (
            isVideo ? (
              <video
                src={mediaUrl}
                autoPlay
                playsInline
                controls={false}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="relative w-full h-full">
                <Image
                  src={mediaUrl}
                  alt="Story Content"
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            )
          ) : (
            <div
              className="w-full h-full flex items-center justify-center p-8 text-center"
              style={{
                backgroundColor: currentStory.background_color || "#111827",
                color: currentStory.font_color || "#FFFFFF",
              }}
            >
              <p className="text-2xl md:text-3xl font-extrabold leading-relaxed tracking-wide">
                {currentStory.content}
              </p>
            </div>
          )}

          {/* Left / Right Click Nav Touch Zones */}
          <div
            onClick={goPrev}
            className="absolute left-0 top-16 bottom-16 w-1/3 cursor-pointer group flex items-center justify-start pl-4"
          >
            {currentIndex > 0 && (
              <div className="p-2 rounded-full bg-black/40 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronLeft className="w-6 h-6" />
              </div>
            )}
          </div>

          <div
            onClick={goNext}
            className="absolute right-0 top-16 bottom-16 w-1/3 cursor-pointer group flex items-center justify-end pr-4"
          >
            <div className="p-2 rounded-full bg-black/40 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronRight className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Footer Caption */}
        {mediaUrl && currentStory.content && (
          <div className="absolute bottom-0 inset-x-0 z-20 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent text-center">
            <p className="text-white text-sm font-medium leading-normal drop-shadow">
              {currentStory.content}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
