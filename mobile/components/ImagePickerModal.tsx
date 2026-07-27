import React, { forwardRef, useRef, useEffect, useCallback } from "react";
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Alert,
} from "react-native";
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from "@gorhom/bottom-sheet";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";

interface ImagePickerModalProps {
  visible?: boolean;
  onClose?: () => void;
  onImageSelected: (uri: string) => void;
  onRemoveImage?: () => void;
  hasImage?: boolean;
  title?: string;
  aspect?: [number, number];
}

const ImagePickerModal = forwardRef<BottomSheetModal, ImagePickerModalProps>(
  (
    {
      visible,
      onClose,
      onImageSelected,
      onRemoveImage,
      hasImage = false,
      title = "Foto do perfil",
      aspect = [1, 1],
    },
    ref
  ) => {
    const { colors } = useAppTheme();
    const insets = useSafeAreaInsets();
    
    // Internal ref to support legacy visibility prop if ref is not passed
    const localRef = useRef<BottomSheetModal>(null);
    const bottomSheetRef = (ref || localRef) as React.RefObject<BottomSheetModal>;

    // Support legacy "visible" prop
    useEffect(() => {
      if (visible !== undefined) {
        if (visible) {
          const timer = setTimeout(() => {
            bottomSheetRef.current?.present();
          }, 50);
          return () => clearTimeout(timer);
        } else {
          bottomSheetRef.current?.dismiss();
        }
      }
    }, [visible, bottomSheetRef]);

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
          bottomSheetRef.current?.dismiss();
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
          bottomSheetRef.current?.dismiss();
          onImageSelected(result.assets[0].uri);
        }
      } catch (e) {
        console.error(e);
        Alert.alert("Erro", "Ocorreu um erro ao abrir a galeria.");
      }
    };

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
        />
      ),
      []
    );

    const handleClose = () => {
      bottomSheetRef.current?.dismiss();
      if (onClose) {
        onClose();
      }
    };

    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={["40%"]}
        backdropComponent={renderBackdrop}
        onDismiss={onClose}
        backgroundStyle={{ backgroundColor: colors.menuBackground }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        <BottomSheetView style={{ padding: 24, paddingBottom: insets.bottom + 24 }}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>
            {title}
          </Text>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginBottom: 12 }} />

          {/* Camera Option */}
          <TouchableOpacity
            style={styles.sheetOption}
            onPress={handleCamera}
            activeOpacity={0.7}
          >
            <Text style={[styles.sheetOptionText, { color: colors.text }]}>
              Câmera
            </Text>
          </TouchableOpacity>

          {/* Gallery Option */}
          <TouchableOpacity
            style={styles.sheetOption}
            onPress={handleGallery}
            activeOpacity={0.7}
          >
            <Text style={[styles.sheetOptionText, { color: colors.text }]}>
              Galeria
            </Text>
          </TouchableOpacity>

          {/* Remove Option */}
          {hasImage && onRemoveImage && (
            <TouchableOpacity
              style={styles.sheetOption}
              onPress={() => {
                bottomSheetRef.current?.dismiss();
                onRemoveImage();
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.sheetOptionText, { color: colors.danger }]}>
                Remover foto
              </Text>
            </TouchableOpacity>
          )}

          {/* Close/Cancel Button */}
          <TouchableOpacity
            style={[styles.sheetCloseButton, { backgroundColor: colors.tint, marginTop: 12 }]}
            onPress={handleClose}
            activeOpacity={0.8}
          >
            <Text style={styles.sheetCloseButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

ImagePickerModal.displayName = "ImagePickerModal";

export default ImagePickerModal;

const styles = StyleSheet.create({
  sheetTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  sheetOptionText: {
    fontSize: 16,
    fontWeight: "500",
  },
  sheetCloseButton: {
    height: 50,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetCloseButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});
