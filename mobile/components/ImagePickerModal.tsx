import React, { useState, useEffect, useRef } from "react";
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Alert,
  Modal,
  Animated,
} from "react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

interface ImagePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onImageSelected: (uri: string) => void;
  onRemoveImage?: () => void;
  hasImage?: boolean;
  title?: string;
  aspect?: [number, number];
}

export default function ImagePickerModal({
  visible,
  onClose,
  onImageSelected,
  onRemoveImage,
  hasImage = false,
  title = "Foto do perfil",
  aspect = [1, 1],
}: ImagePickerModalProps) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const bottomSheetAnimation = useRef(new Animated.Value(0)).current;
  const [shouldRender, setShouldRender] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      bottomSheetAnimation.setValue(0);
      Animated.spring(bottomSheetAnimation, {
        toValue: 1,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(bottomSheetAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setShouldRender(false);
      });
    }
  }, [visible, bottomSheetAnimation]);

  const handleClose = () => {
    Animated.timing(bottomSheetAnimation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const handleCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissão necessária", "Precisamos de permissão para usar a câmera.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        handleClose();
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
        aspect,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        handleClose();
        onImageSelected(result.assets[0].uri);
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Erro", "Ocorreu um erro ao abrir a galeria.");
    }
  };

  const handleRemove = () => {
    handleClose();
    onRemoveImage?.();
  };

  if (!shouldRender) return null;

  const translateY = bottomSheetAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  const overlayOpacity = bottomSheetAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const optionItems = [
    { label: "Câmera", icon: "camera" as const, color: "#f2f2f2", onPress: handleCamera },
    { label: "Galeria", icon: "image" as const, color: "#f2f2f2", onPress: handleGallery },
    ...(hasImage && onRemoveImage
      ? [{ label: "Remover foto", icon: "trash-can-outline" as const, color: colors.danger, onPress: handleRemove }]
      : []),
  ];

  return (
    <Modal
      visible={shouldRender}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={handleClose}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: colors.modalOverlay, opacity: overlayOpacity },
          ]}
        />
        <Animated.View
          style={[
            styles.bottomSheetContainer,
            {
              backgroundColor: isDark
                ? "rgba(30, 30, 30, 0.85)"
                : "rgba(255, 255, 255, 0.85)",
              borderColor: colors.border,
              transform: [{ translateY }],
              paddingBottom: insets.bottom + 24,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.dragHandleContainer}>
            <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />
          </View>

          <Text style={[styles.sheetTitle, { color: colors.text }]}>
            {title}
          </Text>

          <View style={styles.optionsGroup}>
            {optionItems.map((item, index) => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.sheetOption}
                  onPress={item.onPress}
                  activeOpacity={0.6}
                >
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={20}
                    color={item.color}
                    style={styles.optionIcon}
                  />
                  <Text style={[styles.sheetOptionText, { color: item.color }]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bottomSheetContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 24,
  },
  dragHandleContainer: {
    alignItems: "center",
    paddingVertical: 10,
  },
  dragHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
  },
  optionsGroup: {
    borderRadius: 14,
    overflow: "hidden",
  },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  optionIcon: {
    marginRight: 12,
  },
  sheetOptionText: {
    fontSize: 16,
    fontWeight: "400",
  },
});
