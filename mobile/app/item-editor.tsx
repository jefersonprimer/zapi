import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useItemsStore } from "@/store/useItemsStore";
import { ItemRepository } from "@/services/ItemRepository";
import { ItemType, Priority, RepeatPattern } from "@/types/item";

export default function ItemEditorScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{
    id?: string;
    type?: ItemType;
    initialTitle?: string;
    initialContent?: string;
    initialDueDate?: string;
    initialStart?: string;
    initialEnd?: string;
    initialLocation?: string;
  }>();

  const itemId = params.id;

  const {
    createNote,
    createReminder,
    createEvent,
    deleteItem,
    fetchItems,
  } = useItemsStore();

  const [type, setType] = useState<ItemType>(params.type || "note");
  const [title, setTitle] = useState(params.initialTitle || "");
  const [content, setContent] = useState(params.initialContent || "");

  // Lembretes & Eventos
  const [dueDate, setDueDate] = useState(params.initialDueDate || "");
  const [start, setStart] = useState(params.initialStart || "");
  const [end, setEnd] = useState(params.initialEnd || "");
  const [location, setLocation] = useState(params.initialLocation || "");
  const [priority, setPriority] = useState<Priority>("none");
  const [repeat, setRepeat] = useState<RepeatPattern>("none");
  const [allDay, setAllDay] = useState(false);

  const [loading, setLoading] = useState(!!itemId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!itemId) return;
    (async () => {
      try {
        const item = await ItemRepository.getItemById(itemId);
        if (item) {
          setType(item.type);
          setTitle(item.title);
          setContent(item.content || "");
          if (item.type === "reminder") {
            setDueDate(item.dueDate ? new Date(item.dueDate).toLocaleString("pt-BR") : "");
            setPriority(item.priority || "none");
            setRepeat(item.repeat || "none");
          } else if (item.type === "event") {
            setStart(item.start ? new Date(item.start).toLocaleString("pt-BR") : "");
            setEnd(item.end ? new Date(item.end).toLocaleString("pt-BR") : "");
            setLocation(item.location || "");
            setAllDay(item.allDay || false);
            setRepeat(item.repeat || "none");
          }
        }
      } catch {
        Alert.alert("Erro", "Não foi possível carregar o item.");
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [itemId, router]);

  const handleSave = useCallback(async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert("Atenção", "Por favor, digite um título.");
      return;
    }

    setSaving(true);
    try {
      if (itemId) {
        // Exclui versão antiga para re-criar como o tipo selecionado se tiver mudado
        await deleteItem(itemId);
      }

      if (type === "note") {
        await createNote({ type: "note", title: trimmedTitle, content, noteType: "text" });
      } else if (type === "reminder") {
        await createReminder({
          type: "reminder",
          title: trimmedTitle,
          content,
          dueDate: dueDate ? new Date(dueDate).toISOString() : new Date().toISOString(),
          repeat,
          priority,
        });
      } else if (type === "event") {
        await createEvent({
          type: "event",
          title: trimmedTitle,
          content,
          start: start ? new Date(start).toISOString() : new Date().toISOString(),
          end: end ? new Date(end).toISOString() : new Date(Date.now() + 3600000).toISOString(),
          allDay,
          location,
          participants: [],
          repeat,
        });
      }

      await fetchItems();
      router.back();
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }, [title, content, type, dueDate, start, end, location, priority, repeat, allDay, itemId, createNote, createReminder, createEvent, deleteItem, fetchItems, router]);

  const handleDelete = useCallback(async () => {
    if (!itemId) return;
    Alert.alert("Excluir", `Deseja excluir este(a) ${type === "note" ? "Nota" : type === "reminder" ? "Lembrete" : "Evento"}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteItem(itemId);
            router.back();
          } catch (err: any) {
            Alert.alert("Erro", err.message || "Não foi possível excluir.");
          }
        },
      },
    ]);
  }, [itemId, type, deleteItem, router]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {itemId
            ? `Editar ${type === "note" ? "Nota" : type === "reminder" ? "Lembrete" : "Evento"}`
            : `Novo ${type === "note" ? "Nota" : type === "reminder" ? "Lembrete" : "Evento"}`}
        </Text>

        <View style={styles.headerRight}>
          {itemId && (
            <TouchableOpacity onPress={handleDelete} style={styles.headerBtn}>
              <Ionicons name="trash-outline" size={22} color="#EF4444" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveBtn, { backgroundColor: type === "note" ? "#6366F1" : type === "reminder" ? "#F59E0B" : "#10B981" }]}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Salvar</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Seleção de Tipo em Abas */}
      <View style={styles.typeSelectorRow}>
        {(["note", "reminder", "event"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[
              styles.typeTab,
              type === t && {
                backgroundColor: t === "note" ? "#6366F1" : t === "reminder" ? "#F59E0B" : "#10B981",
              },
            ]}
            onPress={() => setType(t)}
          >
            <Ionicons
              name={t === "note" ? "document-text" : t === "reminder" ? "alarm" : "calendar"}
              size={16}
              color={type === t ? "#FFF" : colors.textSecondary}
            />
            <Text
              style={[
                styles.typeTabText,
                { color: type === t ? "#FFF" : colors.textSecondary },
              ]}
            >
              {t === "note" ? "Nota" : t === "reminder" ? "Lembrete" : "Evento"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#6366F1" size="large" />
      ) : (
        <ScrollView contentContainerStyle={styles.formContainer}>
          <TextInput
            style={[styles.titleInput, { color: colors.text }]}
            placeholder="Título..."
            placeholderTextColor={colors.textSecondary}
            value={title}
            onChangeText={setTitle}
          />

          <TextInput
            style={[styles.contentInput, { color: colors.text }]}
            placeholder="Digite aqui suas anotações ou detalhes..."
            placeholderTextColor={colors.textSecondary}
            value={content}
            onChangeText={setContent}
            multiline
          />

          {type === "reminder" && (
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>⏰ Configurações do Lembrete</Text>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Data e Hora do Vencimento</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={dueDate}
                onChangeText={setDueDate}
                placeholder="Ex: 2026-08-05 18:00"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          )}

          {type === "event" && (
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>📅 Configurações do Evento</Text>

              <View style={styles.switchRow}>
                <Text style={[styles.label, { color: colors.text }]}>Dia inteiro</Text>
                <Switch value={allDay} onValueChange={setAllDay} trackColor={{ false: "#767577", true: "#10B981" }} />
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Início</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={start}
                onChangeText={setStart}
                placeholder="Ex: 2026-08-05 14:00"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Término</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={end}
                onChangeText={setEnd}
                placeholder="Ex: 2026-08-05 15:00"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Localização</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={location}
                onChangeText={setLocation}
                placeholder="Ex: Auditório principal"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "bold" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveBtnText: { color: "#FFF", fontWeight: "bold" },
  typeSelectorRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  typeTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(100, 116, 139, 0.1)",
  },
  typeTabText: { fontSize: 13, fontWeight: "600" },
  formContainer: { padding: 16, gap: 12 },
  titleInput: {
    fontSize: 22,
    fontWeight: "bold",
    paddingVertical: 8,
  },
  contentInput: {
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: "top",
    paddingVertical: 8,
  },
  sectionContainer: {
    marginTop: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 4,
  },
  label: { fontSize: 13, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
});
