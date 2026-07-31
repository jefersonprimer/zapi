import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Check, CheckCircle } from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { LocalChatList } from "@/services/database";

interface ListSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  userLists: LocalChatList[];
  initialSelectedListIds: string[];
  onSave: (selectedListIds: string[]) => void;
  onCreateNewList: () => void;
}

export default function ListSelectorModal({
  visible,
  onClose,
  userLists,
  initialSelectedListIds,
  onSave,
  onCreateNewList,
}: ListSelectorModalProps) {
  const { colors } = useAppTheme();
  const [selectedListIds, setSelectedListIds] = useState<string[]>(
    initialSelectedListIds,
  );

  useEffect(() => {
    if (visible) {
      setSelectedListIds(initialSelectedListIds);
    }
  }, [visible, initialSelectedListIds]);

  const handleToggleList = (listId: string) => {
    setSelectedListIds((prev) =>
      prev.includes(listId)
        ? prev.filter((id) => id !== listId)
        : [...prev, listId],
    );
  };

  const handleSave = () => {
    onSave(selectedListIds);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={[styles.dialogOverlay, { backgroundColor: colors.modalOverlay }]}
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
          <Text
            style={[
              styles.dialogTitle,
              { color: colors.text, marginBottom: 12 },
            ]}
          >
            Marcar Listas
          </Text>

          {userLists.length === 0 ? (
            <Text
              style={{
                color: colors.textSecondary,
                marginVertical: 12,
                textAlign: "center",
              }}
            >
              Nenhuma lista personalizada criada.
            </Text>
          ) : (
            <FlatList
              data={userLists}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 200 }}
              renderItem={({ item }) => {
                const isChecked = selectedListIds.includes(item.id);
                return (
                  <TouchableOpacity
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 12,
                    }}
                    onPress={() => handleToggleList(item.id)}
                  >
                    <Text style={{ color: colors.text, fontSize: 16 }}>
                      {item.icon ? `${item.icon} ` : ""}
                      {item.name}
                    </Text>
                    <View
                      style={[
                        {
                          width: 22,
                          height: 22,
                          borderRadius: 50,
                          borderWidth: 2,
                          borderColor: colors.textSecondary,
                          justifyContent: "center",
                          alignItems: "center",
                        },
                        isChecked && {
                          backgroundColor: colors.tint,
                          borderColor: colors.tint,
                        },
                      ]}
                    >
                      {isChecked && <Check size={14} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingVertical: 12,
              marginTop: 8,
            }}
            onPress={onCreateNewList}
          >
            <Text style={{ color: colors.tint, fontSize: 16 }}>
              ＋ Nova lista
            </Text>
          </TouchableOpacity>

          <View
            style={[
              styles.menuDivider,
              { backgroundColor: colors.border, marginVertical: 8 },
            ]}
          />

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
    width: "70%",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  dialogTitle: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
  },
});
