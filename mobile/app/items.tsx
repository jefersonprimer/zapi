import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useItemsStore } from "@/store/useItemsStore";
import { AnyItem, NoteItem, ReminderItem, EventItem, ItemType } from "@/types/item";

export default function ItemsScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const {
    items,
    isLoading,
    filterType,
    syncWithDeviceCalendar,
    fetchItems,
    setFilterType,
    setSyncWithDeviceCalendar,
    toggleReminderCompleted,
    deleteItem,
    createNote,
    createReminder,
    createEvent,
    convertNoteToReminder,
    convertReminderToEvent,
    createNoteFromEvent,
  } = useItemsStore();

  const [selectedItem, setSelectedItem] = useState<AnyItem | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);

  // Form states para criação rápida
  const [createType, setCreateType] = useState<ItemType>("note");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    fetchItems(filterType === "all" ? undefined : filterType);
  }, [filterType]);

  const handleCreateNew = (type: ItemType) => {
    router.push({
      pathname: "/item-editor",
      params: { type },
    });
  };

  const handleEditItem = (item: AnyItem) => {
    setMenuVisible(false);
    router.push({
      pathname: "/item-editor",
      params: { id: item.id, type: item.type },
    });
  };

  const handleConvertNoteToReminder = async (item: NoteItem) => {
    setMenuVisible(false);
    await convertNoteToReminder(item.id);
    Alert.alert("Sucesso", "Nota convertida em Lembrete!");
  };

  const handleConvertReminderToEvent = async (item: ReminderItem) => {
    setMenuVisible(false);
    await convertReminderToEvent(item.id);
    Alert.alert("Sucesso", "Lembrete convertido em Evento!");
  };

  const handleCreateNoteFromEvent = async (item: EventItem) => {
    setMenuVisible(false);
    const newNote = await createNoteFromEvent(item.id);
    if (newNote) {
      Alert.alert("Sucesso", "Nota de reunião criada a partir do Evento!");
    }
  };

  const renderItem = ({ item }: { item: AnyItem }) => {
    const isNote = item.type === "note";
    const isReminder = item.type === "reminder";
    const isEvent = item.type === "event";

    return (
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: isDark ? "#1E293B" : "#FFFFFF", borderColor: colors.border },
        ]}
        onPress={() => {
          setSelectedItem(item);
          setMenuVisible(true);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.typeBadgeContainer}>
            {isNote && <Ionicons name="document-text" size={18} color="#6366F1" />}
            {isReminder && <Ionicons name="alarm" size={18} color="#F59E0B" />}
            {isEvent && <Ionicons name="calendar" size={18} color="#10B981" />}

            <Text
              style={[
                styles.typeText,
                { color: isNote ? "#6366F1" : isReminder ? "#F59E0B" : "#10B981" },
              ]}
            >
              {isNote ? "Nota" : isReminder ? "Lembrete" : "Evento"}
            </Text>
          </View>

          {isReminder && (
            <TouchableOpacity
              onPress={() => toggleReminderCompleted(item.id)}
              style={styles.checkboxTouch}
            >
              <Ionicons
                name={(item as ReminderItem).completed ? "checkbox" : "square-outline"}
                size={22}
                color={(item as ReminderItem).completed ? "#10B981" : colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        <Text
          style={[
            styles.title,
            { color: colors.text },
            isReminder && (item as ReminderItem).completed && styles.completedText,
          ]}
        >
          {item.title}
        </Text>

        {item.content ? (
          <Text style={[styles.content, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.content}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          {isReminder && (item as ReminderItem).dueDate && (
            <Text style={styles.metaText}>
              ⏰ {new Date((item as ReminderItem).dueDate!).toLocaleString("pt-BR")}
            </Text>
          )}
          {isEvent && (
            <Text style={styles.metaText}>
              📅 {new Date((item as EventItem).start).toLocaleString("pt-BR")}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Superapp Items</Text>
        <TouchableOpacity onPress={() => handleCreateNew("note")}>
          <Ionicons name="add-circle" size={30} color="#6366F1" />
        </TouchableOpacity>
      </View>

      {/* Sincronizar com Calendário Nativo Switch */}
      <View style={[styles.syncRow, { borderBottomColor: colors.border }]}>
        <Text style={[styles.syncText, { color: colors.text }]}>
          Sincronizar com calendário do dispositivo
        </Text>
        <Switch
          value={syncWithDeviceCalendar}
          onValueChange={setSyncWithDeviceCalendar}
          trackColor={{ false: "#767577", true: "#6366F1" }}
        />
      </View>

      {/* Segmented Filter */}
      <View style={styles.filterRow}>
        {(["all", "note", "reminder", "event"] as const).map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.filterTab,
              filterType === type && { backgroundColor: "#6366F1" },
            ]}
            onPress={() => setFilterType(type)}
          >
            <Text
              style={[
                styles.filterTabText,
                { color: filterType === type ? "#FFFFFF" : colors.textSecondary },
              ]}
            >
              {type === "all"
                ? "Todos"
                : type === "note"
                ? "Notas"
                : type === "reminder"
                ? "Lembretes"
                : "Eventos"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista de Items */}
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#6366F1" size="large" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Nenhum item encontrado.
            </Text>
          }
        />
      )}

      {/* Modal de Ações no Item */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={[styles.menuContainer, { backgroundColor: isDark ? "#1E293B" : "#FFF" }]}>
            <Text style={[styles.menuTitle, { color: colors.text }]}>
              {selectedItem?.title}
            </Text>

            <TouchableOpacity
              style={styles.menuOption}
              onPress={() => selectedItem && handleEditItem(selectedItem)}
            >
              <Ionicons name="create-outline" size={20} color="#6366F1" />
              <Text style={[styles.menuOptionText, { color: colors.text }]}>
                Editar {selectedItem?.type === "note" ? "Nota" : selectedItem?.type === "reminder" ? "Lembrete" : "Evento"}
              </Text>
            </TouchableOpacity>

            {selectedItem?.type === "note" && (
              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => handleConvertNoteToReminder(selectedItem as NoteItem)}
              >
                <Ionicons name="alarm-outline" size={20} color="#F59E0B" />
                <Text style={[styles.menuOptionText, { color: colors.text }]}>
                  Criar Lembrete desta Nota
                </Text>
              </TouchableOpacity>
            )}

            {selectedItem?.type === "reminder" && (
              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => handleConvertReminderToEvent(selectedItem as ReminderItem)}
              >
                <Ionicons name="calendar-outline" size={20} color="#10B981" />
                <Text style={[styles.menuOptionText, { color: colors.text }]}>
                  Adicionar ao Calendário (Virar Evento)
                </Text>
              </TouchableOpacity>
            )}

            {selectedItem?.type === "event" && (
              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => handleCreateNoteFromEvent(selectedItem as EventItem)}
              >
                <Ionicons name="document-text-outline" size={20} color="#6366F1" />
                <Text style={[styles.menuOptionText, { color: colors.text }]}>
                  Criar Nota deste Evento
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.menuOption}
              onPress={() => {
                if (selectedItem) deleteItem(selectedItem.id);
                setMenuVisible(false);
              }}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text style={[styles.menuOptionText, { color: "#EF4444" }]}>Excluir Item</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: "bold" },
  syncRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  syncText: { fontSize: 14 },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(100, 116, 139, 0.1)",
  },
  filterTabText: { fontSize: 13, fontWeight: "600" },
  listContent: { padding: 16, gap: 12 },
  card: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  typeBadgeContainer: { flexDirection: "row", alignItems: "center", gap: 4 },
  typeText: { fontSize: 12, fontWeight: "bold" },
  checkboxTouch: { padding: 2 },
  title: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  completedText: { textDecorationLine: "line-through", opacity: 0.6 },
  content: { fontSize: 14, marginBottom: 6 },
  metaRow: { marginTop: 4 },
  metaText: { fontSize: 12, color: "#64748B" },
  emptyText: { textAlign: "center", marginTop: 40, fontSize: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  menuContainer: {
    width: "100%",
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  menuTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 8 },
  menuOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  menuOptionText: { fontSize: 15, fontWeight: "500" },
  createContainer: {
    width: "100%",
    borderRadius: 16,
    padding: 20,
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 10,
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnText: { color: "#FFF", fontWeight: "bold" },
});
