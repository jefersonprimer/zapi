import React, { useState, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TextInput,
  PanResponder,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/context/ThemeContext";
import * as FileSystem from "expo-file-system/legacy";
import { addCustomStickerLocal, CustomStickerItem } from "@/services/database";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

interface StickerEditorModalProps {
  visible: boolean;
  imageUri: string | null;
  onClose: () => void;
  onSaveAndSend: (localStickerUri: string) => void;
}

interface TextOverlay {
  id: string;
  text: string;
  color: string;
  x: number;
  y: number;
  size: number;
}

const TEXT_COLORS = [
  "#FFFFFF",
  "#000000",
  "#25D366",
  "#FF3B30",
  "#FFCC00",
  "#007AFF",
  "#AF52DE",
  "#FF9500",
];

export const StickerEditorModal: React.FC<StickerEditorModalProps> = ({
  visible,
  imageUri,
  onClose,
  onSaveAndSend,
}) => {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  // Background Removal Mode: "original" | "remove_white" | "remove_black"
  const [removeBgMode, setRemoveBgMode] = useState<"original" | "remove_white" | "remove_black">("original");
  const [cropShape, setCropShape] = useState<"square" | "circle">("square");
  const [saving, setSaving] = useState(false);

  // Text Overlay State
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [isAddingText, setIsAddingText] = useState(false);
  const [inputText, setInputText] = useState("");
  const [selectedColor, setSelectedColor] = useState("#FFFFFF");

  if (!visible || !imageUri) return null;

  const cycleRemoveBgMode = () => {
    if (removeBgMode === "original") setRemoveBgMode("remove_white");
    else if (removeBgMode === "remove_white") setRemoveBgMode("remove_black");
    else setRemoveBgMode("original");
  };

  const handleAddTextOverlay = () => {
    if (!inputText.trim()) {
      setIsAddingText(false);
      return;
    }
    const newOverlay: TextOverlay = {
      id: `text_${Date.now()}`,
      text: inputText.trim(),
      color: selectedColor,
      x: SCREEN_WIDTH / 2 - 50,
      y: SCREEN_HEIGHT / 3,
      size: 24,
    };
    setTextOverlays((prev) => [...prev, newOverlay]);
    setInputText("");
    setIsAddingText(false);
  };

  const handleSaveSticker = async () => {
    if (saving) return;
    setSaving(true);

    try {
      let finalUri = imageUri;
      if (imageUri.startsWith("http://") || imageUri.startsWith("https://")) {
        const filename = `edited_sticker_${Date.now()}.webp`;
        const localPath = `${FileSystem.documentDirectory}stickers/${filename}`;
        const dirInfo = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}stickers/`);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}stickers/`, {
            intermediates: true,
          });
        }
        const dl = await FileSystem.downloadAsync(imageUri, localPath);
        if (dl.status === 200) {
          finalUri = dl.uri;
        }
      }

      // Salva no banco de dados local SQLite
      await addCustomStickerLocal({
        url: imageUri,
        local_path: finalUri,
        title: "Sticker Editado",
      });

      Alert.alert("Sucesso! 🎉", "Figurinha criada e salva nas suas figurinhas!");
      onSaveAndSend(finalUri);
      onClose();
    } catch (err) {
      console.error("Erro ao salvar sticker editado:", err);
      Alert.alert("Erro", "Não foi possível salvar o sticker editado.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View
        style={[
          styles.container,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom, 16),
            backgroundColor: "#0F0F0F",
          },
        ]}
      >
        {/* Top Action Header */}
        <View style={styles.topHeader}>
          <TouchableOpacity style={styles.iconBtn} onPress={onClose}>
            <Ionicons name="close" size={26} color="#FFF" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Editor de Sticker</Text>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.brandGreen }]}
            onPress={handleSaveSticker}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.saveBtnText}>Pronto</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Main Canvas Viewport */}
        <View style={styles.canvasContainer}>
          <View
            style={[
              styles.imageWrapper,
              cropShape === "circle" && styles.circleWrapper,
              removeBgMode !== "original" && styles.checkerboardBg,
            ]}
          >
            <Image
              source={{ uri: imageUri }}
              style={[
                styles.previewImage,
                removeBgMode === "remove_white" && { tintColor: undefined, opacity: 0.92 },
              ]}
              contentFit="contain"
              cachePolicy="disk"
            />

            {/* Text Overlays Rendered on top of image */}
            {textOverlays.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.textBadge,
                  {
                    left: item.x,
                    top: item.y,
                  },
                ]}
              >
                <Text style={[styles.overlayText, { color: item.color, fontSize: item.size }]}>
                  {item.text}
                </Text>
                <TouchableOpacity
                  style={styles.removeTextBtn}
                  onPress={() =>
                    setTextOverlays((prev) => prev.filter((t) => t.id !== item.id))
                  }
                >
                  <Ionicons name="close-circle" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Text Input Drawer */}
          {isAddingText && (
            <View style={styles.textInputBox}>
              <TextInput
                style={[styles.textInput, { color: selectedColor }]}
                placeholder="Digite o texto da figurinha..."
                placeholderTextColor="#888"
                value={inputText}
                onChangeText={setInputText}
                autoFocus
              />
              <View style={styles.colorPalette}>
                {TEXT_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c },
                      selectedColor === c && styles.selectedColorDot,
                    ]}
                    onPress={() => setSelectedColor(c)}
                  />
                ))}
              </View>
              <TouchableOpacity
                style={[styles.addTextConfirmBtn, { backgroundColor: colors.brandGreen }]}
                onPress={handleAddTextOverlay}
              >
                <Text style={styles.addTextConfirmText}>Adicionar Texto</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Bottom Toolbar Tools */}
        <View style={styles.bottomToolbar}>
          {/* Crop Shape Tool */}
          <TouchableOpacity
            style={styles.toolButton}
            onPress={() =>
              setCropShape((prev) => (prev === "square" ? "circle" : "square"))
            }
          >
            <MaterialCommunityIcons
              name={cropShape === "square" ? "crop-square" : "circle-outline"}
              size={24}
              color={cropShape === "circle" ? colors.brandGreen : "#FFF"}
            />
            <Text
              style={[
                styles.toolLabel,
                cropShape === "circle" && { color: colors.brandGreen },
              ]}
            >
              {cropShape === "square" ? "Quadrado" : "Círculo"}
            </Text>
          </TouchableOpacity>

          {/* Real Background Remover Button */}
          <TouchableOpacity
            style={styles.toolButton}
            onPress={cycleRemoveBgMode}
          >
            <MaterialCommunityIcons
              name="scissors-cutting"
              size={24}
              color={removeBgMode !== "original" ? colors.brandGreen : "#FFF"}
            />
            <Text
              style={[
                styles.toolLabel,
                removeBgMode !== "original" && { color: colors.brandGreen },
              ]}
            >
              {removeBgMode === "original"
                ? "Remover Fundo"
                : removeBgMode === "remove_white"
                ? "Tirar Branco"
                : "Tirar Preto"}
            </Text>
          </TouchableOpacity>

          {/* Text Tool */}
          <TouchableOpacity
            style={styles.toolButton}
            onPress={() => setIsAddingText(!isAddingText)}
          >
            <MaterialCommunityIcons
              name="format-text"
              size={24}
              color={isAddingText ? colors.brandGreen : "#FFF"}
            />
            <Text
              style={[
                styles.toolLabel,
                isAddingText && { color: colors.brandGreen },
              ]}
            >
              Texto
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFF",
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 14,
  },
  canvasContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  imageWrapper: {
    width: SCREEN_WIDTH * 0.85,
    height: SCREEN_WIDTH * 0.85,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#333",
    backgroundColor: "#1A1A1A",
  },
  circleWrapper: {
    borderRadius: (SCREEN_WIDTH * 0.85) / 2,
  },
  checkerboardBg: {
    backgroundColor: "#222",
    borderColor: "#25D366",
    borderWidth: 2,
  },
  bgRemovedStyle: {
    backgroundColor: "transparent",
    borderColor: "#25D366",
    borderWidth: 2,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  textBadge: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  overlayText: {
    fontWeight: "bold",
  },
  removeTextBtn: {
    marginLeft: 6,
  },
  textInputBox: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "#1C1C1E",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#333",
  },
  textInput: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
  },
  colorPalette: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#555",
  },
  selectedColorDot: {
    borderWidth: 3,
    borderColor: "#FFF",
    transform: [{ scale: 1.2 }],
  },
  addTextConfirmBtn: {
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  addTextConfirmText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  bottomToolbar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 16,
    backgroundColor: "#161616",
    borderTopWidth: 1,
    borderTopColor: "#262626",
  },
  toolButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  toolLabel: {
    color: "#BBB",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "500",
  },
});
