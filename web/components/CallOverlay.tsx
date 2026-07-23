"use client";

import React, { useEffect, useRef } from "react";
import { useCall } from "@/lib/call-context";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  AlertCircle,
} from "lucide-react";
import Image from "next/image";
import { getImageUrl } from "@/lib/utils";

export default function CallOverlay() {
  const {
    callState,
    callerUsername,
    calleeUsername,
    remoteAvatarUrl,
    isVideo,
    isMuted,
    isCameraOff,
    localStream,
    remoteStream,
    error,
    callDuration,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Attach local stream to local video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isVideo, callState]);

  // Attach remote stream to remote video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, isVideo, callState]);

  if (callState === "idle") return null;

  const displayName = callerUsername || calleeUsername || "Contato";
  const initials = displayName.slice(0, 2).toUpperCase();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const isIncoming = callState === "ringing" && !!callerUsername;
  const isOutgoing = callState === "calling" || (callState === "ringing" && !callerUsername);
  const isConnected = callState === "connected" || callState === "connecting";
  const isTerminated =
    callState === "ended" ||
    callState === "rejected" ||
    callState === "busy" ||
    callState === "failed";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/95 backdrop-blur-xl text-white animate-in fade-in duration-200">
      {/* 1. INCOMING CALL SCREEN */}
      {isIncoming && (
        <div className="flex flex-col items-center justify-between h-full w-full max-w-md py-16 px-6 text-center">
          <div className="flex flex-col items-center space-y-4">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold text-xs border border-emerald-500/30 animate-pulse">
              {isVideo ? <VideoIcon className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
              {isVideo ? "Chamada de Vídeo Recebida" : "Chamada de Voz Recebida"}
            </span>

            {/* Avatar Pulse */}
            <div className="relative mt-8">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" style={{ animationDuration: "2s" }} />
              <div className="relative h-32 w-32 rounded-full overflow-hidden border-4 border-emerald-500/50 shadow-2xl bg-neutral-800 flex items-center justify-center">
                {remoteAvatarUrl ? (
                  <Image
                    src={getImageUrl(remoteAvatarUrl)}
                    alt={displayName}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="text-3xl font-bold text-neutral-300">{initials}</span>
                )}
              </div>
            </div>

            <div className="pt-4">
              <h2 className="text-2xl font-bold text-white tracking-tight">{displayName}</h2>
              <p className="text-sm text-neutral-400 mt-1">está te ligando...</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-12 w-full">
            {/* Decline Button */}
            <button
              onClick={rejectCall}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/40 transition-transform active:scale-95 group-hover:scale-105">
                <PhoneOff className="h-7 w-7" />
              </div>
              <span className="text-xs text-neutral-400 font-medium group-hover:text-white">Recusar</span>
            </button>

            {/* Accept Button */}
            <button
              onClick={acceptCall}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="h-16 w-16 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/40 transition-transform active:scale-95 group-hover:scale-105 animate-bounce">
                {isVideo ? <VideoIcon className="h-7 w-7" /> : <Phone className="h-7 w-7" />}
              </div>
              <span className="text-xs text-emerald-400 font-medium group-hover:text-white">Atender</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. OUTGOING CALL SCREEN */}
      {isOutgoing && (
        <div className="flex flex-col items-center justify-between h-full w-full max-w-md py-16 px-6 text-center">
          <div className="flex flex-col items-center space-y-4">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-neutral-800 text-neutral-300 font-semibold text-xs border border-neutral-700">
              {isVideo ? <VideoIcon className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
              {callState === "calling" ? "Chamando..." : "Tocando..."}
            </span>

            {/* Avatar Pulse */}
            <div className="relative mt-8">
              <div className="absolute -inset-4 rounded-full bg-white/5 animate-pulse" />
              <div className="relative h-32 w-32 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl bg-neutral-800 flex items-center justify-center">
                {remoteAvatarUrl ? (
                  <Image
                    src={getImageUrl(remoteAvatarUrl)}
                    alt={displayName}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="text-3xl font-bold text-neutral-300">{initials}</span>
                )}
              </div>
            </div>

            <div className="pt-4">
              <h2 className="text-2xl font-bold text-white tracking-tight">{displayName}</h2>
              <p className="text-sm text-neutral-400 mt-1">Aguardando resposta...</p>
            </div>
          </div>

          {/* Cancel Call Button */}
          <button
            onClick={endCall}
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/40 transition-transform active:scale-95 group-hover:scale-105">
              <PhoneOff className="h-7 w-7" />
            </div>
            <span className="text-xs text-neutral-400 font-medium group-hover:text-white">Cancelar</span>
          </button>
        </div>
      )}

      {/* 3. ACTIVE CONNECTED CALL SCREEN */}
      {isConnected && (
        <div className="relative h-full w-full flex flex-col justify-between overflow-hidden">
          {/* VIDEO CALL LAYOUT */}
          {isVideo ? (
            <div className="absolute inset-0 bg-black flex items-center justify-center">
              {/* Remote Video */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="h-full w-full object-cover"
              />

              {/* Local Video Picture-in-Picture */}
              <div className="absolute top-6 right-6 h-44 w-32 md:h-56 md:w-40 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-neutral-900 z-20">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`h-full w-full object-cover ${isCameraOff ? "hidden" : ""}`}
                />
                {isCameraOff && (
                  <div className="h-full w-full flex items-center justify-center bg-neutral-800 text-neutral-400 text-xs">
                    Câmera desligada
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* VOICE CALL LAYOUT */
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              {/* Animated Waveform Avatar container */}
              <div className="relative">
                <div className="absolute -inset-8 rounded-full bg-emerald-500/10 animate-pulse" style={{ animationDuration: "3s" }} />
                <div className="relative h-36 w-36 rounded-full overflow-hidden border-4 border-emerald-500/40 shadow-2xl bg-neutral-800 flex items-center justify-center">
                  {remoteAvatarUrl ? (
                    <Image
                      src={getImageUrl(remoteAvatarUrl)}
                      alt={displayName}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="text-4xl font-bold text-neutral-200">{initials}</span>
                  )}
                </div>
              </div>

              <h2 className="text-3xl font-extrabold text-white mt-8 tracking-tight">{displayName}</h2>
              <div className="flex items-center gap-2 mt-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <p className="text-sm font-semibold text-emerald-400">
                  {callState === "connecting" ? "Conectando..." : formatTime(callDuration)}
                </p>
              </div>
            </div>
          )}

          {/* Top Bar for Video Call */}
          {isVideo && (
            <div className="relative z-20 p-6 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
              <div>
                <h3 className="text-lg font-bold text-white">{displayName}</h3>
                <p className="text-xs text-neutral-300 font-medium">
                  {callState === "connecting" ? "Conectando..." : formatTime(callDuration)}
                </p>
              </div>
            </div>
          )}

          {/* Bottom Controls Bar */}
          <div className="relative z-20 p-8 flex items-center justify-center gap-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
            {/* Toggle Mute */}
            <button
              onClick={toggleMute}
              className={`h-14 w-14 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                isMuted
                  ? "bg-red-600/80 hover:bg-red-600 text-white"
                  : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
              }`}
              title={isMuted ? "Ativar microfone" : "Silenciar microfone"}
            >
              {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </button>

            {/* Toggle Camera (if Video Call) */}
            {isVideo && (
              <button
                onClick={toggleCamera}
                className={`h-14 w-14 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isCameraOff
                    ? "bg-red-600/80 hover:bg-red-600 text-white"
                    : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                }`}
                title={isCameraOff ? "Ligar câmera" : "Desligar câmera"}
              >
                {isCameraOff ? <VideoOff className="h-6 w-6" /> : <VideoIcon className="h-6 w-6" />}
              </button>
            )}

            {/* End Call Button */}
            <button
              onClick={endCall}
              className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-xl shadow-red-600/50 transition-transform active:scale-95 hover:scale-105 cursor-pointer"
              title="Encerrar chamada"
            >
              <PhoneOff className="h-7 w-7" />
            </button>
          </div>
        </div>
      )}

      {/* 4. TERMINATED / REJECTED / BUSY / FAILED SCREEN */}
      {isTerminated && (
        <div className="flex flex-col items-center justify-center h-full w-full px-6 text-center space-y-4 animate-in fade-in duration-300">
          <div className="h-20 w-20 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-400 shadow-xl">
            {callState === "failed" ? (
              <AlertCircle className="h-10 w-10 text-red-500" />
            ) : (
              <PhoneOff className="h-10 w-10 text-neutral-400" />
            )}
          </div>

          <div>
            <h2 className="text-xl font-bold text-white">{displayName}</h2>
            <p className="text-sm font-medium text-neutral-400 mt-1">
              {callState === "ended" && "Chamada encerrada"}
              {callState === "rejected" && "Chamada recusada"}
              {callState === "busy" && "Linha ocupada"}
              {callState === "failed" && (error || "Falha na chamada")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
