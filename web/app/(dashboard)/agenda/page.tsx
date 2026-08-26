"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getVendorStore,
  listVendorAppointments,
  updateAppointmentStatus,
  cancelAppointment,
  Appointment,
} from "@/lib/api";
import {
  Calendar as CalendarIcon,
  Check,
  X,
  Clock,
  User,
  Phone,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Loader2,
  ListFilter,
  RefreshCw,
} from "lucide-react";

export default function AgendaPage() {
  const { token } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadAppointments = useCallback(async () => {
    if (!token || !storeId) return;
    try {
      setLoading(true);
      const data = await listVendorAppointments(token, storeId, selectedDate);
      setAppointments(data);
    } catch (err: any) {
      showToast(err.message || "Erro ao carregar agendamentos", "error");
    } finally {
      setLoading(false);
    }
  }, [token, storeId, selectedDate, showToast]);

  // Load store ID on mount
  useEffect(() => {
    if (!token) return;
    getVendorStore(token)
      .then((res) => {
        if (res && res.store) {
          setStoreId(res.store.id);
        }
      })
      .catch((err) => showToast("Erro ao carregar dados da loja", "error"));
  }, [token, showToast]);

  // Reload appointments when storeId or selectedDate changes
  useEffect(() => {
    if (storeId) {
      loadAppointments();
    }
  }, [storeId, selectedDate, loadAppointments]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    if (!token) return;
    try {
      await updateAppointmentStatus(token, id, newStatus);
      showToast(`Status atualizado para: ${newStatus === "confirmed" ? "Confirmado" : "Concluído"}`);
      loadAppointments();
    } catch (err: any) {
      showToast(err.message || "Erro ao atualizar status", "error");
    }
  };

  const handleCancel = async (id: string) => {
    if (!token) return;
    if (!confirm("Tem certeza que deseja cancelar este agendamento? Os clientes serão notificados por chat.")) return;

    try {
      await cancelAppointment(token, id);
      showToast("Agendamento cancelado!");
      loadAppointments();
    } catch (err: any) {
      showToast(err.message || "Erro ao cancelar", "error");
    }
  };

  const filteredAppointments = appointments.filter((app) => {
    if (filterStatus === "all") return true;
    return app.status === filterStatus;
  });

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
      case "confirmed":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
      case "cancelled":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20";
      case "completed":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "Aguardando Confirmação";
      case "confirmed":
        return "Confirmado";
      case "cancelled":
        return "Cancelado";
      case "completed":
        return "Concluído";
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-white shadow-lg transition-all duration-300 ${
            toast.type === "success" ? "bg-emerald-500" : "bg-rose-500"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-emerald-500" />
            Agenda do Dia
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Acompanhe os horários marcados, confirme ou conclua atendimentos dos seus profissionais.
          </p>
        </div>
        
        {/* Date Selector input */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3.5 py-2.5 border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1a2e] text-gray-800 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          />
          <button
            onClick={loadAppointments}
            className="p-2.5 bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10 rounded-lg text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-800 transition-colors"
            title="Atualizar Agenda"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex items-center gap-3 bg-white dark:bg-[#1a1a2e] p-4 rounded-xl border border-gray-150 dark:border-gray-800">
        <ListFilter className="h-4.5 w-4.5 text-gray-400" />
        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Filtrar status:</span>
        <div className="flex gap-2">
          {[
            { value: "all", label: "Todos" },
            { value: "pending", label: "Pendentes" },
            { value: "confirmed", label: "Confirmados" },
            { value: "completed", label: "Concluídos" },
            { value: "cancelled", label: "Cancelados" },
          ].map((btn) => (
            <button
              key={btn.value}
              onClick={() => setFilterStatus(btn.value)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                filterStatus === btn.value
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-gray-800 dark:hover:bg-white/10"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Appointments List / Agenda grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#1a1a2e] rounded-xl border border-gray-150 dark:border-gray-800">
          <p className="text-gray-500 dark:text-gray-400">Nenhum agendamento registrado para este dia.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAppointments.map((app) => (
            <div
              key={app.id}
              className="bg-white dark:bg-[#1a1a2e] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              {/* Main Info */}
              <div className="space-y-3 flex-1">
                {/* Header info (Time range and Status badge) */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-lg">
                    <Clock className="h-4.5 w-4.5" />
                    <span>{app.start_time} - {app.end_time}</span>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getStatusBadgeClass(app.status)}`}>
                    {getStatusLabel(app.status)}
                  </span>
                </div>

                {/* Details */}
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 text-sm text-gray-700 dark:text-gray-300">
                  <div className="flex items-center gap-2 font-medium">
                    <User className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <span>{app.client_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <span>{app.client_phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-emerald-500">Serviço:</span>
                    <span>{app.service_name} (R$ {app.service_price?.toFixed(2)})</span>
                  </div>
                </div>

                {/* Professional Name */}
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Profissional encarregado: <span className="font-bold text-gray-700 dark:text-gray-200">{app.professional_name || "Não selecionado"}</span>
                </div>

                {/* Notes if any */}
                {app.notes && (
                  <div className="bg-gray-50 dark:bg-[#15152a] border border-gray-100 dark:border-gray-800 rounded-lg p-3 text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <p>{app.notes}</p>
                  </div>
                )}
              </div>

              {/* Status Action Buttons */}
              <div className="flex flex-row md:flex-col gap-2 flex-wrap items-center md:items-end justify-start md:justify-center border-t md:border-t-0 pt-4 md:pt-0 border-gray-100 dark:border-gray-800">
                {app.status === "pending" && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus(app.id, "confirmed")}
                      className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-sm transition-all"
                    >
                      <Check className="h-4 w-4" />
                      Confirmar
                    </button>
                    <button
                      onClick={() => handleCancel(app.id)}
                      className="flex items-center gap-1.5 border border-gray-200 dark:border-gray-750 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20 text-gray-500 dark:text-gray-400 font-semibold text-xs px-4 py-2.5 rounded-lg transition-all"
                    >
                      <X className="h-4 w-4" />
                      Recusar
                    </button>
                  </>
                )}
                {app.status === "confirmed" && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus(app.id, "completed")}
                      className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-sm transition-all"
                    >
                      <Check className="h-4 w-4" />
                      Finalizar Atendimento
                    </button>
                    <button
                      onClick={() => handleCancel(app.id)}
                      className="flex items-center gap-1.5 border border-transparent hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20 text-gray-500 dark:text-gray-400 font-semibold text-xs px-4 py-2.5 rounded-lg transition-all"
                    >
                      <X className="h-4 w-4" />
                      Cancelar
                    </button>
                  </>
                )}
                {(app.status === "completed" || app.status === "cancelled") && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 italic">Sem ações pendentes</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
