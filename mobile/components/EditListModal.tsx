import { useState, useEffect } from "react";
import { Modal, TouchableOpacity, View, Text, TextInput, StyleSheet, Alert } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";

interface EditListModalProps {
  visible: boolean;
  initialName: string;
  initialColor: string;
  initialIcon: string;
  onClose: () => void;
  onSave: (name: string, color: string, icon: string) => void;
}

export default function EditListModal({
  visible,
  initialName,
  initialColor,
  initialIcon,
  onClose,
  onSave,
}: EditListModalProps) {
  const { colors } = useAppTheme();
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const [icon, setIcon] = useState(initialIcon);

  useEffect(() => {
    if (visible) {
      setName(initialName);
      setColor(initialColor);
      setIcon(initialIcon);
    }
  }, [visible, initialName, initialColor, initialIcon]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert("Erro", "Por favor, digite o nome da lista.");
      return;
    }
    onSave(name, color, icon);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={[
          styles.dialogOverlay,
          { backgroundColor: colors.modalOverlay },
        ]}
        activeOpacity={1}
        onPress={onClose}
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
            Editar Lista
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
            <TouchableOpacity onPress={onClose}>
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
            <TouchableOpacity onPress={handleSave}>
              <Text
                style={{
                  color: colors.tint,
                  fontSize: 16,
                  fontWeight: "bold",
                  padding: 8,
                }}
              >
                Salvar
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
