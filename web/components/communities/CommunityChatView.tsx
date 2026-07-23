"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Paperclip, Image as ImageIcon, Hash } from "lucide-react";
import Image from "next/image";
import { getImageUrl } from "@/lib/utils";
import { CommunityChannel, CommunityMessage } from "@/lib/community-types";

interface CommunityChatViewProps {
  channel: CommunityChannel;
  messages: CommunityMessage[];
  onSendMessage: (content: string, imageUrl?: string) => void;
}

export const CommunityChatView: React.FC<CommunityChatViewProps> = ({
  channel,
  messages,
  onSendMessage,
}) => {
  const [inputText, setInputText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [showImageInput, setShowImageInput] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !imageUrl.trim()) return;

    onSendMessage(inputText.trim(), imageUrl.trim() || undefined);
    setInputText("");
    setImageUrl("");
    setShowImageInput(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {/* Welcome Channel Banner */}
        <div className="border-b border-zinc-800/80 pb-6 mb-6">
          <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
            <Hash className="w-8 h-8 text-zinc-300" />
          </div>
          <h2 className="text-2xl font-extrabold text-zinc-100">
            Bem-vindo ao #{channel.name}!
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            {channel.description || `Este é o início do canal #${channel.name}.`}
          </p>
        </div>

        {/* Message Stream */}
        {messages.map((msg, index) => {
          const isSameSenderAsPrevious =
            index > 0 && messages[index - 1].sender_id === msg.sender_id;

          const formattedTime = new Date(msg.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div
              key={msg.id}
              className={`group flex items-start gap-3.5 hover:bg-zinc-900/40 p-1.5 -mx-1.5 rounded-lg transition-colors ${
                isSameSenderAsPrevious ? "mt-1" : "mt-4"
              }`}
            >
              {!isSameSenderAsPrevious ? (
                <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center shrink-0">
                  {msg.sender_avatar_url ? (
                    <Image
                      src={getImageUrl(msg.sender_avatar_url)}
                      alt={msg.sender_username || "User"}
                      width={40}
                      height={40}
                      className="w-full h-full object-cover grayscale brightness-95"
                      unoptimized
                    />
                  ) : (
                    <span className="font-bold text-xs text-zinc-200">
                      {(msg.sender_username || "U")[0].toUpperCase()}
                    </span>
                  )}
                </div>
              ) : (
                <div className="w-10 text-right text-[10px] text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity pt-1 select-none shrink-0">
                  {formattedTime}
                </div>
              )}

              <div className="flex-1 overflow-hidden">
                {!isSameSenderAsPrevious && (
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-xs text-zinc-200 hover:underline cursor-pointer">
                      {msg.sender_username || "Usuário Anon"}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      {formattedTime}
                    </span>
                  </div>
                )}

                {msg.content && (
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed break-words">
                    {msg.content}
                  </p>
                )}

                {msg.image_url && (
                  <div className="mt-2 relative max-w-sm rounded-xl overflow-hidden border border-zinc-800">
                    <Image
                      src={msg.image_url}
                      alt="Attachment"
                      width={400}
                      height={250}
                      className="w-full h-auto object-cover max-h-60"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box Area */}
      <div className="p-4 bg-zinc-950 border-t border-zinc-800/80">
        {showImageInput && (
          <div className="mb-2 p-2 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-zinc-400 shrink-0" />
            <input
              type="text"
              placeholder="Cole a URL da imagem..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="flex-1 bg-transparent text-xs text-zinc-200 focus:outline-none"
            />
            <button
              onClick={() => setShowImageInput(false)}
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              Cancelar
            </button>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 flex items-center gap-2 focus-within:border-zinc-700 transition-colors"
        >
          <button
            type="button"
            onClick={() => setShowImageInput(!showImageInput)}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            title="Anexar imagem"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <input
            type="text"
            placeholder={`Conversar em #${channel.name}...`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 bg-transparent text-xs sm:text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none"
          />

          <button
            type="submit"
            disabled={!inputText.trim() && !imageUrl.trim()}
            className="p-2 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40 disabled:hover:bg-zinc-100 text-black rounded-lg transition-all cursor-pointer shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
