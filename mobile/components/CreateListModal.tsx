import { useState } from "react";
import { Modal, TouchableOpacity, View, Text, TextInput, StyleSheet, Alert } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";

interface CreateListModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, color: string, icon: string) => void;
}

export default function CreateListModal({
  visible,
  onClose,
  onCreate,
}: CreateListModalProps) {
  const { colors } = useAppTheme();
  const [name, setName] = useState("");
  const [color, setColor] = useState("🔴");
  const [icon, setIcon] = useState("❤️");

  const handleCreate = () => {
    if (!name.trim()) {
      Alert.alert("Erro", "Por favor, digite o nome da lista.");
      return;
    }
    onCreate(name, color, icon);
    // Reset local state
    setName("");
    setColor("🔴");
    setIcon("❤️");
  };

  const handleClose = () => {
    setName("");
    setColor("🔴");
    setIcon("❤️");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={[
          styles.dialogOverlay,
          { backgroundColor: colors.modalOverlay },
        ]}
        activeOpacity={1}
        onPress={handleClose}
      >
        <View
          style={[
            styles.themeDialog,
            {
              backgroundColor: colors.menuBackground,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.dialogTitle, { color: colors.text }]}>
            Nova Lista
          </Text>

          <TextInput
            placeholder="Nome da lista"
            placeholderTextColor={colors.textSecondary}
            style={{
              borderBottomWidth: 1,
              borderBottomColor: colors.tint,
              color: colors.text,
              fontSize: 16,
              paddingVertical: 8,
              marginBottom: 20,
            }}
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <Text
            style={{
              color: colors.textSecondary,
              marginBottom: 8,
              fontSize: 14,
            }}
          >
            Cor
          </Text>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            {["🔴", "🟠", "🟡", "🟢", "🔵", "🟣"].map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  { padding: 8, borderRadius: 20 },
                  color === c && {
                    backgroundColor: colors.border,
                  },
                ]}
                onPress={() => setColor(c)}
              >
                <Text style={{ fontSize: 20 }}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text
            style={{
              color: colors.textSecondary,
              marginBottom: 8,
              fontSize: 14,
            }}
          >
            Ícone
          </Text>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            {["❤️", "⭐", "💼", "🏠", "🎮", "📚"].map((i) => (
              <TouchableOpacity
                key={i}
                style={[
                  { padding: 8, borderRadius: 20 },
                  icon === i && { backgroundColor: colors.border },
                ]}
                onPress={() => setIcon(i)}
              >
                <Text style={{ fontSize: 20 }}>{i}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              gap: 12,
            }}
          >
            <TouchableOpacity onPress={handleClose}>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 16,
                  padding: 8,
                }}
              >
                Cancelar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCreate}>
              <Text
                style={{
                  color: colors.tint,
                  fontSize: 16,
                  fontWeight: "bold",
                  padding: 8,
                }}
              >
                Criar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dialogOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  themeDialog: {
    width: "80%",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
});
