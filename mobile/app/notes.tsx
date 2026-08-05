import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getNotes,
  deleteNote,
  updateNote,
  type Note,
} from "@/services/notesApi";
import { Ionicons } from "@expo/vector-icons";

import {
  setPinnedNoteLocal,
  getPinnedNoteLocal,
  removePinnedNoteLocal,
} from "@/services/database";

export default function NotesScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [pinnedNoteId, setPinnedNoteId] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getNotes(token);
      setNotes(data);
      const pinned = await getPinnedNoteLocal();
      setPinnedNoteId(pinned?.id || null);
    } catch (err: any) {
      console.error("Failed to fetch notes:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchNotes();
    }, [fetchNotes]),
  );

  async function handleDelete(note: Note) {
    Alert.alert(
      "Excluir nota",
      `Deseja excluir "${note.title || "Sem título"}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            if (!token) return;
            try {
              await deleteNote(token, note.id);
              setNotes((prev) => prev.filter((n) => n.id !== note.id));
            } catch (err: any) {
              Alert.alert("Erro", err.message || "Não foi possível excluir.");
            }
          },
        },
      ],
    );
  }

  async function handleToggleFavorite(note: Note) {
    if (!token) return;
    try {
      const updated = await updateNote(token, note.id, {
        is_favorite: !note.is_favorite,
      });
      setNotes((prev) => prev.map((n) => (n.id === note.id ? updated : n)));
    } catch (err: any) {
      console.error("Failed to toggle favorite:", err);
    }
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "agora";
    if (diffMin < 60) return `${diffMin}min`;
    if (diffHr < 24) return `${diffHr}h`;
    if (diffDay < 7) return `${diffDay}d`;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }

  async function handleTogglePinHome(note: Note) {
    try {
      if (pinnedNoteId === note.id) {
        await removePinnedNoteLocal();
        setPinnedNoteId(null);
        Alert.alert("Sucesso", "Nota desafixada da tela inicial.");
      } else {
        await setPinnedNoteLocal({
          id: note.id,
          title: note.title || "Sem título",
          content: note.content || "",
          updated_at: note.updated_at,
        });
        setPinnedNoteId(note.id);
        Alert.alert("Sucesso", "Nota fixada na tela inicial como lembrete.");
      }
    } catch (err: any) {
      console.error("Failed to pin note to home:", err);
      Alert.alert("Erro", "Não foi possível alterar o status de fixação.");
    }
  }

  const renderItem = ({ item }: { item: Note }) => (
    <TouchableOpacity
      style={[
        styles.noteCard,
        { backgroundColor: colors.cardBackground, borderColor: colors.border },
      ]}
      activeOpacity={0.7}
      onPress={() =>
        router.push({ pathname: "/note-editor", params: { noteId: item.id } })
      }
    >
      <View style={styles.noteHeader}>
        <Text
          style={[styles.noteTitle, { color: colors.text }]}
          numberOfLines={1}
        >
          {item.title || "Sem título"}
        </Text>
        <TouchableOpacity
          onPress={() => {
            setSelectedNote(item);
            setSheetVisible(true);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons
            name="dots-horizontal"
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>
      <Text
        style={[styles.noteContent, { color: colors.textSecondary }]}
        numberOfLines={2}
      >
        {item.content || "Nota vazia"}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top, backgroundColor: colors.headerBackground },
        ]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons
              name="chevron-back-outline"
              size={24}
              color={colors.headerText}
            />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: colors.headerText }]}>
              Notas
            </Text>
            {!loading && (
              <Text
                style={[styles.headerSubtitle, { color: colors.headerText }]}
              >
                {notes.length} nota{notes.length === 1 ? "" : "s"}
              </Text>
            )}
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Nenhuma nota ainda
              </Text>
              <Text
                style={[styles.emptySubtext, { color: colors.textSecondary }]}
              >
                Toque em + para criar sua primeira nota
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: isDark
              ? "rgba(30, 30, 30, 0.98)"
              : "rgba(255, 255, 255, 0.98)",
            borderWidth: 1,
            borderColor: colors.border,
            bottom: insets.bottom + 20,
          },
        ]}
        activeOpacity={0.8}
        onPress={() => router.push({ pathname: "/note-editor" })}
      >
        <Ionicons name="create-outline" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal
        visible={sheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSheetVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.bottomSheet,
              { backgroundColor: colors.cardBackground },
            ]}
          >
            <View style={styles.sheetIndicator} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              {selectedNote?.title || "Sem título"}
            </Text>
            <TouchableOpacity
              style={styles.sheetOption}
              onPress={() => {
                setSheetVisible(false);
                if (selectedNote) handleTogglePinHome(selectedNote);
              }}
            >
              <MaterialCommunityIcons
                name={
                  selectedNote?.id === pinnedNoteId ? "pin-off" : "pin"
                }
                size={20}
                color={
                  selectedNote?.id === pinnedNoteId ? colors.tint : colors.textSecondary
                }
              />
              <Text style={[styles.sheetOptionText, { color: colors.text }]}>
                {selectedNote?.id === pinnedNoteId
                  ? "Desafixar da Home"
                  : "Adicionar à Home"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sheetOption}
              onPress={() => {
                setSheetVisible(false);
                if (selectedNote) handleToggleFavorite(selectedNote);
              }}
            >
              <MaterialCommunityIcons
                name={selectedNote?.is_favorite ? "star" : "star-outline"}
                size={20}
                color={
                  selectedNote?.is_favorite ? "#FFD60A" : colors.textSecondary
                }
              />
              <Text style={[styles.sheetOptionText, { color: colors.text }]}>
                {selectedNote?.is_favorite
                  ? "Remover dos favoritos"
                  : "Adicionar aos favoritos"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sheetOption}
              onPress={() => {
                setSheetVisible(false);
                if (selectedNote) {
                  router.push({
                    pathname: "/share-contact",
                    params: {
                      mode: "note",
                      noteId: selectedNote.id,
                      noteTitle: selectedNote.title || "Sem título",
                      noteContent: selectedNote.content || "",
                    },
                  });
                }
              }}
            >
              <MaterialCommunityIcons
                name="share-variant-outline"
                size={20}
                color={colors.textSecondary}
              />
              <Text style={[styles.sheetOptionText, { color: colors.text }]}>
                Compartilhar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sheetOption}
              onPress={() => {
                setSheetVisible(false);
                if (selectedNote) handleDelete(selectedNote);
              }}
            >
              <MaterialCommunityIcons
                name="delete-outline"
                size={20}
                color={colors.danger}
              />
              <Text style={[styles.sheetOptionText, { color: colors.danger }]}>
                Excluir nota
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingBottom: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 8,
  },
  backBtn: {
    padding: 4,
    marginRight: 16,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.8,
  },
  noteCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  noteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  noteContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  sheetIndicator: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#ccc",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 20,
  },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
  },
  sheetOptionText: {
    fontSize: 15,
  },
});
