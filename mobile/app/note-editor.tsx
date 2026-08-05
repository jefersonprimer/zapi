import { useState, useEffect, useCallback } from "react";
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
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getNote,
  createNote,
  updateNote,
  deleteNote,
  type Note,
} from "@/services/notesApi";
import { Ionicons } from "@expo/vector-icons";

export default function NoteEditorScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ noteId?: string }>();
  const noteId = params.noteId;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(!!noteId);
  const [saving, setSaving] = useState(false);
  const [existingNote, setExistingNote] = useState<Note | null>(null);

  useEffect(() => {
    if (!noteId || !token) return;
    (async () => {
      try {
        const note = await getNote(token, noteId);
        setExistingNote(note);
        setTitle(note.title);
        setContent(note.content);
      } catch {
        Alert.alert("Erro", "Não foi possível carregar a nota.");
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [noteId, token, router]);

  const handleSave = useCallback(async () => {
    if (!token) return;
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (!trimmedTitle && !trimmedContent) {
      Alert.alert("Aviso", "Escreva algo antes de salvar.");
      return;
    }

    setSaving(true);
    try {
      if (noteId && existingNote) {
        await updateNote(token, noteId, {
          title: trimmedTitle,
          content: trimmedContent,
        });
      } else {
        await createNote(token, trimmedTitle, trimmedContent);
      }
      router.back();
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }, [token, title, content, noteId, existingNote, router]);

  async function handleDelete() {
    if (!noteId || !token) return;
    Alert.alert("Excluir nota", "Deseja excluir esta nota?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteNote(token, noteId);
            router.back();
          } catch (err: any) {
            Alert.alert("Erro", err.message || "Não foi possível excluir.");
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator
          size="large"
          color={colors.tint}
          style={{ marginTop: 100 }}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={[
          styles.header,
          { paddingTop: insets.top, backgroundColor: colors.headerBackground },
        ]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.headerButton, { borderColor: colors.border }]}
          >
            <Ionicons
              name="chevron-back-outline"
              size={24}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.headerText }]}>
            {noteId ? "Editar nota" : "Nova Nota"}
          </Text>
          <View style={styles.headerActions}>
            {noteId && (
              <TouchableOpacity
                onPress={handleDelete}
                style={styles.headerBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color={colors.headerText}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={[
                styles.headerButton,
                { backgroundColor: "#34C759", borderColor: "#34C759" },
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="checkmark" size={24} color="#ffffff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.editor}
        contentContainerStyle={{ paddingBottom: 200 }}
        keyboardDismissMode="interactive"
      >
        <TextInput
          style={[styles.titleInput, { color: colors.text }]}
          placeholder="Título"
          placeholderTextColor={colors.textSecondary}
          value={title}
          onChangeText={setTitle}
          multiline
          blurOnSubmit
          returnKeyType="next"
          autoFocus={!noteId}
        />
        <TextInput
          style={[styles.contentInput, { color: colors.text }]}
          placeholder="Escreva sua nota..."
          placeholderTextColor={colors.textSecondary}
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
          blurOnSubmit={false}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 8,
  },
  backBtn: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "500",
    textAlign: "center",
    flex: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headerBtn: {
    padding: 4,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  saveText: {
    fontSize: 16,
    fontWeight: "600",
    borderRadius: 50,
    padding: 1,
  },
  editor: {
    flex: 1,
    paddingHorizontal: 20,
  },
  titleInput: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 16,
    paddingBottom: 8,
  },
  contentInput: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 300,
    paddingTop: 8,
  },
});
