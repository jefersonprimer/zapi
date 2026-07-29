import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Share,
  Clipboard,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/context/ThemeContext";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";

interface BrowserMediaActionsModalProps {
  visible: boolean;
  onClose: () => void;
  mediaType: "image" | "video" | null;
  src: string | null;
  onOpenInNewTab: (url: string) => void;
}

export function BrowserMediaActionsModal({
  visible,
  onClose,
  mediaType,
  src,
  onOpenInNewTab,
}: BrowserMediaActionsModalProps) {
  const { colors, isDark } = useAppTheme();
  const actionsAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      actionsAnimation.setValue(0);
      Animated.spring(actionsAnimation, {
        toValue: 1,
        tension: 90,
        friction: 9,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, actionsAnimation]);

  const hideActionsModal = (callback?: () => void) => {
    Animated.timing(actionsAnimation, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      onClose();
      if (callback) callback();
    });
  };

  if (!visible || !mediaType || !src) return null;

  const modalScale = actionsAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.93, 1],
  });

  const modalTranslateY = actionsAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  const modalOpacity = actionsAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const handleSaveMedia = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permissão necessária",
          "Precisamos de permissão para salvar arquivos na sua galeria."
        );
        return;
      }

      const extension = mediaType === "video" ? "mp4" : "jpg";
      const filename = `zapi_${Date.now()}.${extension}`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      // If it's a base64 Data URL, write it directly
      if (src.startsWith("data:")) {
        const parts = src.split(";base64,");
        if (parts.length === 2) {
          const base64Data = parts[1];
          const match = src.match(/data:(image|video)\/([a-zA-Z0-9+]+);base64,/);
          const ext = match ? match[2] : extension;
          const dataFilename = `zapi_${Date.now()}.${ext}`;
          const dataFileUri = `${FileSystem.documentDirectory}${dataFilename}`;

          await FileSystem.writeAsStringAsync(dataFileUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          await MediaLibrary.saveToLibraryAsync(dataFileUri);
          Alert.alert("Sucesso", "Arquivo salvo na sua galeria!");
          hideActionsModal();
          return;
        }
      }

      // Download remote URL
      const downloadResult = await FileSystem.downloadAsync(src, fileUri);

      if (downloadResult.status === 200) {
        await MediaLibrary.saveToLibraryAsync(downloadResult.uri);
        Alert.alert("Sucesso", "Arquivo salvo na sua galeria!");
      } else {
        Alert.alert("Erro", "Não foi possível baixar o arquivo.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Erro", "Ocorreu um erro ao salvar o arquivo.");
    }
    hideActionsModal();
  };

  const handleShareMedia = async () => {
    try {
      await Share.share({
        message: src,
        url: src,
      });
    } catch (e) {
      console.warn("Share failed", e);
    }
    hideActionsModal();
  };

  const handleCopyLink = () => {
    Clipboard.setString(src);
    Alert.alert("Copiado", "Link copiado para a área de transferência!");
    hideActionsModal();
  };

  const mediaLabel = mediaType === "video" ? "Vídeo" : "Imagem";

  return (
    <TouchableOpacity
      style={[
        StyleSheet.absoluteFillObject,
        styles.modalOverlayCentered,
        { zIndex: 1000 },
      ]}
      activeOpacity={1}
      onPress={() => hideActionsModal()}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: colors.modalOverlay || "rgba(0, 0, 0, 0.4)",
            opacity: modalOpacity,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.actionsModalCard,
          {
            backgroundColor: isDark
              ? "rgba(30, 30, 30, 0.85)"
              : "rgba(255, 255, 255, 0.85)",
            borderColor: colors.border,
            opacity: modalOpacity,
            transform: [{ scale: modalScale }, { translateY: modalTranslateY }],
          },
        ]}
      >
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.modalHeaderText, { color: colors.textSecondary || "#8E8E93" }]}>
            Opções de {mediaLabel}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.modalRowOption, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
          onPress={handleSaveMedia}
        >
          <View
            style={[
              styles.modalRowIconContainer,
              { backgroundColor: "#34C759" },
            ]}
          >
            <MaterialCommunityIcons
              name="download"
              size={20}
              color="#FFFFFF"
            />
          </View>
          <Text style={[styles.modalRowText, { color: colors.text }]}>
            Salvar {mediaLabel}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modalRowOption, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
          onPress={handleShareMedia}
        >
          <View
            style={[
              styles.modalRowIconContainer,
              { backgroundColor: "#007AFF" },
            ]}
          >
            <MaterialCommunityIcons
              name="share-variant"
              size={20}
              color="#FFFFFF"
            />
          </View>
          <Text style={[styles.modalRowText, { color: colors.text }]}>
            Compartilhar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modalRowOption, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
          onPress={handleCopyLink}
        >
          <View
            style={[
              styles.modalRowIconContainer,
              { backgroundColor: "#FF9500" },
            ]}
          >
            <MaterialCommunityIcons
              name="content-copy"
              size={20}
              color="#FFFFFF"
            />
          </View>
          <Text style={[styles.modalRowText, { color: colors.text }]}>
            Copiar Link
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.modalRowOption}
          onPress={() => {
            hideActionsModal(() => onOpenInNewTab(src));
          }}
        >
          <View
            style={[
              styles.modalRowIconContainer,
              { backgroundColor: "#AF52DE" },
            ]}
          >
            <MaterialCommunityIcons
              name="open-in-new"
              size={20}
              color="#FFFFFF"
            />
          </View>
          <Text style={[styles.modalRowText, { color: colors.text }]}>
            Abrir em Nova Aba
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  modalOverlayCentered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  actionsModalCard: {
    width: "75%",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 24,
  },
  modalHeader: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalHeaderText: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modalRowOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  modalRowIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  modalRowText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
