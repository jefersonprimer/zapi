import React from "react";
import { Modal, TouchableOpacity, View, Text, StyleSheet } from "react-native";
import {
  Bell,
  Pencil,
  GripVertical,
  Trash2,
  Heart,
  Star,
  Briefcase,
  Home,
  Gamepad2,
  BookOpen,
  Folder,
} from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";

interface ListMenuModalProps {
  visible: boolean;
  onClose: () => void;
  list: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    isSystem: boolean;
  } | null;
  onMuteChats: () => void;
  onEditList: () => void;
  onReorderLists: () => void;
  onDeleteList: () => void;
}

const renderListIcon = (
  iconName: string | null,
  colorColor: string | null,
  tintColor: string,
  size: number = 20,
) => {
  let hexColor = tintColor;
  if (colorColor === "🔴") hexColor = "#ef4444";
  else if (colorColor === "🟠") hexColor = "#f97316";
  else if (colorColor === "🟡") hexColor = "#eab308";
  else if (colorColor === "🟢") hexColor = "#22c55e";
  else if (colorColor === "🔵") hexColor = "#3b82f6";
  else if (colorColor === "🟣") hexColor = "#a855f7";

  switch (iconName) {
    case "❤️":
      return <Heart size={size} color={hexColor} fill={hexColor + "22"} />;
    case "⭐":
      return <Star size={size} color={hexColor} fill={hexColor + "22"} />;
    case "💼":
      return <Briefcase size={size} color={hexColor} fill={hexColor + "22"} />;
    case "🏠":
      return <Home size={size} color={hexColor} fill={hexColor + "22"} />;
    case "🎮":
      return <Gamepad2 size={size} color={hexColor} fill={hexColor + "22"} />;
    case "📚":
      return <BookOpen size={size} color={hexColor} fill={hexColor + "22"} />;
    default:
      return <Folder size={size} color={hexColor} fill={hexColor + "22"} />;
  }
};

export default function ListMenuModal({
  visible,
  onClose,
  list,
  onMuteChats,
  onEditList,
  onReorderLists,
  onDeleteList,
}: ListMenuModalProps) {
  const { colors } = useAppTheme();

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
          onStartShouldSetResponder={() => true}
        >
          <View style={[styles.dialogOptionLabel, { marginBottom: 4 }]}>
            {list?.icon &&
              renderListIcon(list.icon, list.color, colors.tint, 22)}
            <Text
              style={[
                styles.dialogTitle,
                { color: colors.text, marginBottom: 0, flex: 1 },
              ]}
              numberOfLines={1}
            >
              {list?.name ?? "Lista"}
            </Text>
          </View>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            Opções da lista
          </Text>

          <View
            style={[
              styles.menuDivider,
              { backgroundColor: colors.border, marginBottom: 4 },
            ]}
          />

          <TouchableOpacity style={styles.dialogOption} onPress={onMuteChats}>
            <View style={styles.dialogOptionLabel}>
              <Bell size={20} color={colors.textSecondary} />
              <Text style={[styles.dialogOptionText, { color: colors.text }]}>
                Silenciar conversas
              </Text>
            </View>
          </TouchableOpacity>

          {!list?.isSystem && (
            <TouchableOpacity style={styles.dialogOption} onPress={onEditList}>
              <View style={styles.dialogOptionLabel}>
                <Pencil size={20} color={colors.textSecondary} />
                <Text style={[styles.dialogOptionText, { color: colors.text }]}>
                  Editar lista
                </Text>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.dialogOption}
            onPress={onReorderLists}
          >
            <View style={styles.dialogOptionLabel}>
              <GripVertical size={20} color={colors.textSecondary} />
              <Text style={[styles.dialogOptionText, { color: colors.text }]}>
                Reorganizar listas
              </Text>
            </View>
          </TouchableOpacity>

          {!list?.isSystem && (
            <>
              <View
                style={[
                  styles.menuDivider,
                  { backgroundColor: colors.border, marginVertical: 4 },
                ]}
              />
              <TouchableOpacity
                style={styles.dialogOption}
                onPress={onDeleteList}
              >
                <View style={styles.dialogOptionLabel}>
                  <Trash2 size={20} color={colors.danger} />
                  <Text
                    style={[styles.dialogOptionText, { color: colors.danger }]}
                  >
                    Apagar lista
                  </Text>
                </View>
              </TouchableOpacity>
            </>
          )}

          <View
            style={[
              styles.menuDivider,
              { backgroundColor: colors.border, marginVertical: 8 },
            ]}
          />

          <TouchableOpacity style={styles.dialogCloseButton} onPress={onClose}>
            <Text
              style={{ color: colors.tint, fontSize: 16, fontWeight: "600" }}
            >
              Fechar
            </Text>
          </TouchableOpacity>
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
  },
  dialogOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  dialogOptionLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dialogOptionText: {
    fontSize: 16,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
  },
  dialogCloseButton: {
    alignItems: "flex-end",
    paddingTop: 8,
    paddingRight: 4,
  },
});
