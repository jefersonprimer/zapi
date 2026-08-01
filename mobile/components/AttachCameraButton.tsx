import React from "react";
import { TouchableOpacity, Alert, StyleSheet, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export interface Attachment {
  uri: string;
  name: string;
  type: "image" | "video" | "audio" | "document";
  mimeType?: string;
  size?: number;
  duration?: number;
}

interface AttachCameraButtonProps {
  onTakePhoto: (attachment: Attachment) => void;
}

export const AttachCameraButton: React.FC<AttachCameraButtonProps> = ({
  onTakePhoto,
}) => {
  const { token } = useAuth();
  const { colors } = useAppTheme();

  const handleTakePhoto = async () => {
    if (!token) return;

    if (Platform.OS === "web") {
      try {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*,video/*";
        input.setAttribute("capture", "environment");
        input.onchange = (event: any) => {
          const file = event.target.files?.[0];
          if (!file) return;

          const isVideo = file.type.startsWith("video/");
          const uri = URL.createObjectURL(file);
          onTakePhoto({
            uri,
            name:
              file.name ||
              (isVideo ? `video_${Date.now()}.mp4` : `photo_${Date.now()}.jpg`),
            type: isVideo ? "video" : "image",
            mimeType: file.type || (isVideo ? "video/mp4" : "image/jpeg"),
            size: file.size,
          });
        };
        input.click();
      } catch (err: any) {
        Alert.alert("Erro ao tirar foto", err.message);
      }
      return;
    }

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(
          "Permissão Negada",
          "O acesso à câmera é necessário para tirar fotos.",
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images", "videos"],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0)
        return;
      const asset = result.assets[0];

      const isVideo =
        asset.type === "video" ||
        (asset as any).mediaType === "video" ||
        asset.mimeType?.startsWith("video/");
      onTakePhoto({
        uri: asset.uri,
        name: isVideo ? `video_${Date.now()}.mp4` : `photo_${Date.now()}.jpg`,
        type: isVideo ? "video" : "image",
        mimeType: asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg"),
        size: asset.fileSize,
      });
    } catch (err: any) {
      Alert.alert("Erro ao tirar foto", err.message);
    }
  };

  return (
    <TouchableOpacity style={styles.iconBtn} onPress={handleTakePhoto}>
      <MaterialCommunityIcons name="camera" size={22} color={colors.icon} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  iconBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 2,
  },
});
