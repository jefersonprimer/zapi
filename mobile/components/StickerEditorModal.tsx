import React, { useState, useRef, useEffect } from "react";
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
  Animated,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import * as FileSystem from "expo-file-system/legacy";
import { addCustomStickerLocal } from "@/services/database";
import { removeBackground } from "@/services/stickerApi";

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

type BgRemovalState = "idle" | "processing" | "done" | "error";

export const StickerEditorModal: React.FC<StickerEditorModalProps> = ({
  visible,
  imageUri,
  onClose,
  onSaveAndSend,
}) => {
  const { colors } = useAppTheme();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();

  // Background Removal state (real AI-powered)
  const [bgRemovalState, setBgRemovalState] = useState<BgRemovalState>("idle");
  const [processedImageUri, setProcessedImageUri] = useState<string | null>(null);
  const [cropShape, setCropShape] = useState<"square" | "circle">("square");
  const [saving, setSaving] = useState(false);

  // Text Overlay State
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [isAddingText, setIsAddingText] = useState(false);
  const [inputText, setInputText] = useState("");
  const [selectedColor, setSelectedColor] = useState("#FFFFFF");

  // Progress animation
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Zoom & Pan (Gestures) Animated values
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // Track values locally for delta calculation
  const lastScale = useRef(1);
  const lastTranslate = useRef({ x: 0, y: 0 });

  // Reset image transform when imageUri changes or modal becomes visible
  useEffect(() => {
    if (visible) {
      scale.setValue(1);
      translateX.setValue(0);
      translateY.setValue(0);
      lastScale.current = 1;
      lastTranslate.current = { x: 0, y: 0 };
    }
  }, [visible, imageUri, scale, translateX, translateY]);

  // Gestures Handler with PanResponder (detects pan and pinch zoom)
  const initialDistance = useRef<number | null>(null);
  const initialScale = useRef<number>(1);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const touches = e.nativeEvent.touches;
        if (touches.length === 2) {
          // Calculate initial distance for zoom
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          initialDistance.current = Math.sqrt(dx * dx + dy * dy);
          initialScale.current = lastScale.current;
        } else {
          initialDistance.current = null;
        }
        
        // Save offset position for drag
        translateX.setOffset(lastTranslate.current.x);
        translateY.setOffset(lastTranslate.current.y);
        translateX.setValue(0);
        translateY.setValue(0);
      },
      onPanResponderMove: (e, gestureState) => {
        const touches = e.nativeEvent.touches;
        
        if (touches.length === 2 && initialDistance.current !== null) {
          // Pinch Zooming
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          const ratio = distance / initialDistance.current;
          let nextScale = initialScale.current * ratio;
          
          // Clamp scale between 0.6x and 5.0x
          nextScale = Math.max(0.6, Math.min(nextScale, 5.0));
          scale.setValue(nextScale);
          lastScale.current = nextScale;
        } else if (touches.length === 1) {
          // Dragging (only if not zooming)
          translateX.setValue(gestureState.dx);
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: () => {
        // Flatten offset into main values
        translateX.flattenOffset();
        translateY.flattenOffset();
        lastTranslate.current = {
          x: (translateX as any)._value || 0,
          y: (translateY as any)._value || 0,
        };
        initialDistance.current = null;
      },
      onPanResponderTerminate: () => {
        translateX.flattenOffset();
        translateY.flattenOffset();
        initialDistance.current = null;
      }
    })
  ).current;

  if (!visible || !imageUri) return null;

  // The image to display: processed (bg removed) or original
  const displayImageUri = processedImageUri || imageUri;

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const handleRemoveBackground = async () => {
    if (bgRemovalState === "processing") return;

    // If already processed, toggle back to original
    if (bgRemovalState === "done") {
      setProcessedImageUri(null);
      setBgRemovalState("idle");
      return;
    }

    if (!token) {
      Alert.alert("Erro", "Você precisa estar autenticado para remover o fundo.");
      return;
    }

    setBgRemovalState("processing");
    startPulseAnimation();

    // Animate progress bar
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 0.85,
      duration: 8000,
      useNativeDriver: false,
    }).start();

    try {
      const resultUri = await removeBackground(imageUri, token);
      
      // Complete the progress bar
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();

      setProcessedImageUri(resultUri);
      setBgRemovalState("done");
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    } catch (err) {
      console.error("Erro ao remover fundo:", err);
      setBgRemovalState("error");
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      progressAnim.setValue(0);

      Alert.alert(
        "Erro ao remover fundo",
        "Não foi possível remover o fundo da imagem. Tente novamente.",
        [
          { text: "Tentar Novamente", onPress: () => setBgRemovalState("idle") },
          { text: "Cancelar", style: "cancel", onPress: () => setBgRemovalState("idle") },
        ]
      );
    }
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
      let finalUri = displayImageUri;
      if (displayImageUri.startsWith("http://") || displayImageUri.startsWith("https://")) {
        const filename = `edited_sticker_${Date.now()}.webp`;
        const localPath = `${FileSystem.documentDirectory}stickers/${filename}`;
        const dirInfo = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}stickers/`);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}stickers/`, {
            intermediates: true,
          });
        }
        const dl = await FileSystem.downloadAsync(displayImageUri, localPath);
        if (dl.status === 200) {
          finalUri = dl.uri;
        }
      }

      // Salva no banco de dados local SQLite
      await addCustomStickerLocal({
        url: displayImageUri,
        local_path: finalUri,
        title: processedImageUri ? "Sticker (Fundo Removido)" : "Sticker Editado",
      });

      Alert.alert("Sucesso! 🎉", "Figurinha criada e salva nas suas figurinhas!");
      onSaveAndSend(finalUri);
      onClose();

      // Reset state
      setProcessedImageUri(null);
      setBgRemovalState("idle");
      setTextOverlays([]);
    } catch (err) {
      console.error("Erro ao salvar sticker editado:", err);
      Alert.alert("Erro", "Não foi possível salvar o sticker editado.");
    } finally {
      setSaving(false);
    }
  };

  const getRemoveBgLabel = () => {
    switch (bgRemovalState) {
      case "processing":
        return "Removendo...";
      case "done":
        return "Restaurar";
      case "error":
        return "Tentar Novamente";
      default:
        return "Remover Fundo";
    }
  };

  const getRemoveBgIcon = (): string => {
    switch (bgRemovalState) {
      case "done":
        return "undo-variant";
      default:
        return "scissors-cutting";
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

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
            disabled={saving || bgRemovalState === "processing"}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.saveBtnText}>Pronto</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Progress Bar for BG Removal */}
        {bgRemovalState === "processing" && (
          <View style={styles.progressContainer}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: progressWidth,
                  backgroundColor: colors.brandGreen,
                },
              ]}
            />
          </View>
        )}

        {/* Main Canvas Viewport */}
        <View style={styles.canvasContainer}>
          <View
            style={[
              styles.imageWrapper,
              cropShape === "circle" && styles.circleWrapper,
              processedImageUri && styles.checkerboardBg,
            ]}
            {...panResponder.panHandlers}
          >
            <Animated.View
              style={[
                styles.previewContainer,
                bgRemovalState === "processing" && { opacity: pulseAnim },
                {
                  transform: [
                    { scale: scale },
                    { translateX: translateX },
                    { translateY: translateY }
                  ]
                }
              ]}
            >
              <Image
                source={{ uri: displayImageUri }}
                style={styles.previewImage}
                contentFit="contain"
                cachePolicy="none"
              />
            </Animated.View>

            {/* Processing Overlay */}
            {bgRemovalState === "processing" && (
              <View style={styles.processingOverlay}>
                <ActivityIndicator size="large" color={colors.brandGreen} />
                <Text style={styles.processingText}>Removendo fundo com IA...</Text>
                <Text style={styles.processingSubtext}>Isso pode levar alguns segundos</Text>
              </View>
            )}

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

          {/* BG Removed Badge & Helper instruction */}
          {bgRemovalState === "done" ? (
            <View style={[styles.bgRemovedBadge, { backgroundColor: colors.brandGreen }]}>
              <Ionicons name="checkmark-circle" size={14} color="#FFF" />
              <Text style={styles.bgRemovedBadgeText}>Fundo removido por IA</Text>
            </View>
          ) : (
            <Text style={styles.helperText}>Use dois dedos para dar zoom ou arraste para ajustar</Text>
          )}

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

          {/* AI Background Remover Button */}
          <TouchableOpacity
            style={[
              styles.toolButton,
              bgRemovalState === "processing" && styles.toolButtonDisabled,
            ]}
            onPress={handleRemoveBackground}
            disabled={bgRemovalState === "processing"}
          >
            {bgRemovalState === "processing" ? (
              <ActivityIndicator size={24} color={colors.brandGreen} />
            ) : (
              <MaterialCommunityIcons
                name={getRemoveBgIcon() as any}
                size={24}
                color={
                  bgRemovalState === "done"
                    ? colors.brandGreen
                    : bgRemovalState === "error"
                    ? "#FF3B30"
                    : "#FFF"
                }
              />
            )}
            <Text
              style={[
                styles.toolLabel,
                bgRemovalState === "done" && { color: colors.brandGreen },
                bgRemovalState === "error" && { color: "#FF3B30" },
              ]}
            >
              {getRemoveBgLabel()}
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
  progressContainer: {
    height: 3,
    backgroundColor: "#333",
    marginHorizontal: 16,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 2,
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
  previewContainer: {
    width: "100%",
    height: "100%",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
    zIndex: 10,
  },
  processingText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 16,
  },
  processingSubtext: {
    color: "#AAA",
    fontSize: 13,
    marginTop: 6,
  },
  bgRemovedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
    gap: 6,
  },
  bgRemovedBadgeText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },
  helperText: {
    color: "#888",
    fontSize: 12,
    marginTop: 12,
    fontWeight: "500",
  },
  textBadge: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    zIndex: 5,
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
    zIndex: 100,
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
  toolButtonDisabled: {
    opacity: 0.7,
  },
  toolLabel: {
    color: "#BBB",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "500",
  },
});
