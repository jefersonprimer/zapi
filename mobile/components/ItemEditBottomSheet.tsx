import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  PanResponder,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/context/ThemeContext";
import { useItemsStore } from "@/store/useItemsStore";
import { ItemType } from "@/types/item";
import { IntentSuggestion } from "@/services/chatIntentEngine";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const DEFAULT_HEIGHT = SCREEN_HEIGHT * 0.65;
const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.90;

interface Props {
  visible: boolean;
  initialType: ItemType;
  suggestion?: IntentSuggestion | null;
  onClose: () => void;
}

export function ItemEditBottomSheet({ visible, initialType, suggestion, onClose }: Props) {
  const { colors, isDark } = useAppTheme();
  const { createNote, createReminder, createEvent } = useItemsStore();

  const [type, setType] = useState<ItemType>(initialType);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [location, setLocation] = useState("");

  const sheetHeight = useRef(new Animated.Value(DEFAULT_HEIGHT)).current;
  const isExpandedRef = useRef(false);

  // Gestos de PanResponder para puxar para cima/baixo
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderMove: (_, gestureState) => {
        const newHeight = isExpandedRef.current
          ? EXPANDED_HEIGHT - gestureState.dy
          : DEFAULT_HEIGHT - gestureState.dy;

        if (newHeight >= DEFAULT_HEIGHT * 0.8 && newHeight <= SCREEN_HEIGHT * 0.95) {
          sheetHeight.setValue(newHeight);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -50) {
          // Puxou para cima: expande
          Animated.spring(sheetHeight, {
            toValue: EXPANDED_HEIGHT,
            useNativeDriver: false,
            friction: 8,
          }).start(() => {
            isExpandedRef.current = true;
          });
        } else if (gestureState.dy > 80) {
          if (isExpandedRef.current) {
            // Volta para altura padrão
            Animated.spring(sheetHeight, {
              toValue: DEFAULT_HEIGHT,
              useNativeDriver: false,
              friction: 8,
            }).start(() => {
              isExpandedRef.current = false;
            });
          } else {
            // Fecha se puxar para baixo no estado padrão
            onClose();
          }
        } else {
          // Retorna à posição atual
          Animated.spring(sheetHeight, {
            toValue: isExpandedRef.current ? EXPANDED_HEIGHT : DEFAULT_HEIGHT,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      setType(initialType);
      setTitle(suggestion?.title || "");
      setContent(suggestion?.content || "");
      setDueDate(
        suggestion?.dueDate
          ? new Date(suggestion.dueDate).toLocaleString("pt-BR")
          : new Date().toLocaleString("pt-BR")
      );
      setStart(
        suggestion?.start
          ? new Date(suggestion.start).toLocaleString("pt-BR")
          : new Date().toLocaleString("pt-BR")
      );
      setEnd(
        suggestion?.end
          ? new Date(suggestion.end).toLocaleString("pt-BR")
          : new Date(Date.now() + 3600000).toLocaleString("pt-BR")
      );
      setLocation(suggestion?.location || "");

      sheetHeight.setValue(DEFAULT_HEIGHT);
      isExpandedRef.current = false;
    }
  }, [visible, initialType, suggestion, sheetHeight]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Atenção", "O título não pode ficar em branco.");
      return;
    }

    try {
      if (type === "note") {
        await createNote({ type: "note", title, content, noteType: "text" });
      } else if (type === "reminder") {
        await createReminder({
          type: "reminder",
          title,
          content,
          dueDate: new Date().toISOString(),
          repeat: "none",
          priority: "none",
        });
      } else if (type === "event") {
        await createEvent({
          type: "event",
          title,
          content,
          start: new Date().toISOString(),
          end: new Date(Date.now() + 3600000).toISOString(),
          allDay: false,
          location,
          participants: [],
          repeat: "none",
        });
      }

      Alert.alert("Sucesso", `${type === "note" ? "Nota" : type === "reminder" ? "Lembrete" : "Evento"} salvo(a)!`);
      onClose();
    } catch {
      Alert.alert("Erro", "Não foi possível salvar o item.");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: isDark
                ? "rgba(30, 30, 30, 0.98)"
                : "rgba(255, 255, 255, 0.98)",
              height: sheetHeight,
            },
          ]}
        >
          {/* Área de arraste (Drag Handle) */}
          <View {...panResponder.panHandlers} style={styles.dragHandleArea}>
            <View style={styles.handleBar} />

            {/* Cabeçalho com ícone de fechar no canto esquerdo, Título ao centro e Checkmark verde à direita (Estilo DrawingCanvasModal) */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={onClose}
                style={[
                  styles.headerButton,
                  {
                    borderColor: colors.border,
                    backgroundColor: isDark ? "rgba(30, 30, 30, 0.98)" : "rgba(255, 255, 255, 0.98)",
                  },
                ]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>

              <Text style={[styles.headerTitle, { color: colors.text }]}>
                {type === "note" ? "Nova Nota" : type === "reminder" ? "Novo Lembrete" : "Novo Evento"}
              </Text>

              <TouchableOpacity
                onPress={handleSave}
                style={[
                  styles.headerButton,
                  { backgroundColor: "#34C759", borderColor: "#34C759" },
                ]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="checkmark" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Seleção rápida de tipo em Abas */}
          <View style={styles.typeSelector}>
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
                <Text style={[styles.typeTabText, { color: type === t ? "#FFF" : colors.textSecondary }]}>
                  {t === "note" ? "Nota" : t === "reminder" ? "Lembrete" : "Evento"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Título</Text>
            <TextInput
              style={[styles.input, styles.titleInput, { color: colors.text, borderColor: colors.border }]}
              value={title}
              onChangeText={setTitle}
              placeholder="Título"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Conteúdo / Descrição</Text>
            <TextInput
              style={[styles.input, styles.multilineInput, { color: colors.text, borderColor: colors.border }]}
              value={content}
              onChangeText={setContent}
              placeholder="Digite o conteúdo ou observações..."
              placeholderTextColor={colors.textSecondary}
              multiline
            />

            {type === "reminder" && (
              <>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Data e Hora do Vencimento</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  value={dueDate}
                  onChangeText={setDueDate}
                />
              </>
            )}

            {type === "event" && (
              <>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Início</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  value={start}
                  onChangeText={setStart}
                />
                <Text style={[styles.label, { color: colors.textSecondary }]}>Término</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  value={end}
                  onChangeText={setEnd}
                />
                <Text style={[styles.label, { color: colors.textSecondary }]}>Localização</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Ex: Sala de Reunião 2"
                  placeholderTextColor={colors.textSecondary}
                />
              </>
            )}
          </ScrollView>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 10,
    width: "100%",
  },
  dragHandleArea: {
    paddingBottom: 10,
  },
  handleBar: {
    width: 36,
    height: 4,
    backgroundColor: "#CBD5E1",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  typeSelector: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 14,
  },
  typeTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(100, 116, 139, 0.12)",
  },
  typeTabText: {
    fontSize: 13,
    fontWeight: "600",
  },
  formContent: {
    gap: 10,
    paddingBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  titleInput: {
    fontSize: 20,
    paddingVertical: 12,
    fontWeight: "500",
  },
  multilineInput: {
    minHeight: 70,
    textAlignVertical: "top",
  },
});
