import React from "react";
import {
  Modal,
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Alert,
} from "react-native";
import { Camera, Image as ImageIcon, Trash2 } from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";
import * as ImagePicker from "expo-image-picker";

interface ImagePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onImageSelected: (uri: string) => void;
  onRemoveImage?: () => void;
  hasImage?: boolean;
  title?: string;
}

export default function ImagePickerModal({
  visible,
  onClose,
  onImageSelected,
  onRemoveImage,
  hasImage = false,
  title = "Foto do perfil",
}: ImagePickerModalProps) {
  const { colors } = useAppTheme();

  const handleCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissão necessária", "Precisamos de permissão para usar a câmera.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        onClose();
        onImageSelected(result.assets[0].uri);
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Erro", "Ocorreu um erro ao abrir a câmera.");
    }
  };

  const handleGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissão necessária", "Precisamos de permissão para acessar a galeria.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        onClose();
        onImageSelected(result.assets[0].uri);
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Erro", "Ocorreu um erro ao abrir a galeria.");
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[
            styles.bottomSheet,
            {
              backgroundColor: colors.menuBackground,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={[styles.sheetIndicator, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>
            {title}
          </Text>

          <TouchableOpacity
            style={[styles.sheetOption, { backgroundColor: colors.background }]}
            onPress={handleCamera}
            activeOpacity={0.8}
          >
            <View style={styles.sheetOptionLeft}>
              <Camera size={20} color={colors.tint} />
              <Text style={[styles.sheetOptionText, { color: colors.text, fontWeight: "600" }]}>
                Câmera
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sheetOption, { backgroundColor: colors.background }]}
            onPress={handleGallery}
            activeOpacity={0.8}
          >
            <View style={styles.sheetOptionLeft}>
              <ImageIcon size={20} color={colors.tint} />
              <Text style={[styles.sheetOptionText, { color: colors.text, fontWeight: "600" }]}>
                Galeria
              </Text>
            </View>
          </TouchableOpacity>

          {hasImage && onRemoveImage && (
            <TouchableOpacity
              style={[styles.sheetOption, { backgroundColor: colors.background }]}
              onPress={() => {
                onClose();
                onRemoveImage();
              }}
              activeOpacity={0.8}
            >
              <View style={styles.sheetOptionLeft}>
                <Trash2 size={20} color={colors.danger} />
                <Text style={[styles.sheetOptionText, { color: colors.danger, fontWeight: "600" }]}>
                  Remover Foto
                </Text>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.sheetCloseButton, { backgroundColor: colors.tint, marginTop: 8 }]}
            onPress={onClose}
          >
            <Text style={styles.sheetCloseButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 16,
  },
  sheetIndicator: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  sheetOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sheetOptionText: {
    fontSize: 16,
  },
  sheetCloseButton: {
    height: 50,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sheetCloseButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});
