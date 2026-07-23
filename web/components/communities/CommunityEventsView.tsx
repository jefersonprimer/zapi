"use client";

import React from "react";
import { Calendar, MapPin, Users, Plus, Clock } from "lucide-react";
import { CommunityEvent, EventRsvpStatus } from "@/lib/community-types";

interface CommunityEventsViewProps {
  events: CommunityEvent[];
  onRsvp: (eventId: string, status: EventRsvpStatus) => void;
  onOpenCreateEventModal: () => void;
}

export const CommunityEventsView: React.FC<CommunityEventsViewProps> = ({
  events,
  onRsvp,
  onOpenCreateEventModal,
}) => {
  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Banner */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-zinc-100 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-zinc-300" />
            Eventos da Comunidade
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Workshops, meetups, transmissões de voz e encontros agendados.
          </p>
        </div>

        <button
          onClick={onOpenCreateEventModal}
          className="flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-black px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Evento</span>
        </button>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {events.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-zinc-800 rounded-2xl">
            <Calendar className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-zinc-400">
              Nenhum evento agendado
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Agende um novo evento para reunir os membros da comunidade!
            </p>
          </div>
        ) : (
          events.map((event) => {
            const startDate = new Date(event.start_time);
            const dayNum = startDate.getDate();
            const monthStr = startDate.toLocaleDateString("pt-BR", { month: "short" }).toUpperCase();
            const timeStr = startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

            return (
              <div
                key={event.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 transition-all duration-200 hover:border-zinc-700 flex flex-col md:flex-row gap-6 shadow-sm"
              >
                {/* Date Badge */}
                <div className="w-20 h-20 bg-zinc-950 border border-zinc-800 rounded-xl flex flex-col items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold tracking-wider text-zinc-400">
                    {monthStr}
                  </span>
                  <span className="text-2xl font-black text-zinc-100">
                    {dayNum}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-medium">
                    {timeStr}
                  </span>
                </div>

                {/* Event Details */}
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="text-lg font-extrabold text-zinc-100">
                      {event.title}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      {event.description || "Sem descrição detalhada."}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-zinc-300" />
                      <span>{event.location || "Online"}</span>
                    </span>

                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-zinc-300" />
                      <span>
                        {event.attendee_count}{" "}
                        {event.max_attendees ? `/ ${event.max_attendees}` : ""}{" "}
                        participantes
                      </span>
                    </span>

                    <span className="flex items-center gap-1.5 text-zinc-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Por {event.creator_username || "Organizador"}</span>
                    </span>
                  </div>

                  {/* RSVP Buttons */}
                  <div className="pt-3 border-t border-zinc-800/80 flex items-center gap-2">
                    <button
                      onClick={() => onRsvp(event.id, "going")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        event.user_rsvp === "going"
                          ? "bg-zinc-100 text-black shadow-sm"
                          : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      }`}
                    >
                      ✓ Vou
                    </button>

                    <button
                      onClick={() => onRsvp(event.id, "interested")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        event.user_rsvp === "interested"
                          ? "bg-zinc-100 text-black shadow-sm"
                          : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      }`}
                    >
                      ★ Tenho Interesse
                    </button>

                    <button
                      onClick={() => onRsvp(event.id, "not_going")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        event.user_rsvp === "not_going"
                          ? "bg-zinc-800 text-zinc-400 border border-zinc-700"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      Não vou
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
