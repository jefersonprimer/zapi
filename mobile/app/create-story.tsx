import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import {
  ArrowLeft,
  Camera,
  Image as ImageIcon,
  Type,
  Send,
  X,
  Video,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { uploadFile } from "@/services/api";
import * as updatesApi from "@/services/updatesApi";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const BG_COLORS = [
  "#111827",
  "#007AFF",
  "#EF4444",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
];

type Mode = "choose" | "media" | "text";

interface SelectedMedia {
  uri: string;
  type: "image" | "video";
  mimeType: string;
  name: string;
  width?: number;
  height?: number;
  duration?: number;
  size?: number;
}

export default function CreateStoryScreen() {
  const { colors } = useAppTheme();
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>("choose");
  const [media, setMedia] = useState<SelectedMedia | null>(null);
  const [text, setText] = useState("");
  const [bgColor, setBgColor] = useState(BG_COLORS[0]);
  const [sending, setSending] = useState(false);

  const applyAsset = useCallback((asset: ImagePicker.ImagePickerAsset) => {
    const isVideo =
      asset.type === "video" ||
      asset.mimeType?.startsWith("video/") === true;
    setMedia({
      uri: asset.uri,
      type: isVideo ? "video" : "image",
      mimeType:
        asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg"),
      name: isVideo
        ? `story_${Date.now()}.mp4`
        : `story_${Date.now()}.jpg`,
      width: asset.width,
      height: asset.height,
      duration: asset.duration
        ? Math.round(asset.duration / 1000)
        : undefined,
      size: asset.fileSize,
    });
    setMode("media");
  }, []);

  const openCamera = useCallback(async () => {
    try {
      if (Platform.OS === "web") {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*,video/*";
        input.setAttribute("capture", "environment");
        input.onchange = (event: Event) => {
          const file = (event.target as HTMLInputElement).files?.[0];
          if (!file) return;
          const isVideo = file.type.startsWith("video/");
          const uri = URL.createObjectURL(file);
          setMedia({
            uri,
            type: isVideo ? "video" : "image",
            mimeType: file.type || (isVideo ? "video/mp4" : "image/jpeg"),
            name:
              file.name ||
              (isVideo
                ? `story_${Date.now()}.mp4`
                : `story_${Date.now()}.jpg`),
            size: file.size,
          });
          setMode("media");
        };
        input.click();
        return;
      }

      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permissão necessária",
          "Precisamos de acesso à câmera para tirar foto ou gravar vídeo."
        );
        return;
      }

      const launch = async (type: "images" | "videos") => {
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: [type],
          quality: 0.85,
          videoMaxDuration: 30,
        });

        if (!result.canceled && result.assets[0]) {
          applyAsset(result.assets[0]);
        }
      };

      Alert.alert(
        "Câmera",
        "Como deseja usar a câmera?",
        [
          { text: "Tirar Foto", onPress: () => launch("images") },
          { text: "Gravar Vídeo", onPress: () => launch("videos") },
          { text: "Cancelar", style: "cancel" },
        ],
        { cancelable: true }
      );
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Não foi possível abrir a câmera.");
    }
  }, [applyAsset]);

  const openGallery = useCallback(async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permissão necessária",
          "Precisamos de acesso à galeria para escolher foto ou vídeo."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        quality: 0.85,
        videoMaxDuration: 30,
      });

      if (!result.canceled && result.assets[0]) {
        applyAsset(result.assets[0]);
      }
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Não foi possível abrir a galeria.");
    }
  }, [applyAsset]);

  const startText = useCallback(() => {
    setMedia(null);
    setMode("text");
  }, []);

  const reset = useCallback(() => {
    setMedia(null);
    setText("");
    setBgColor(BG_COLORS[0]);
    setMode("choose");
  }, []);

  const canPublish =
    (mode === "media" && media != null) ||
    (mode === "text" && text.trim().length > 0);

  const handlePublish = useCallback(async () => {
    if (!token || !canPublish || sending) return;
    setSending(true);
    try {
      const attachments: {
        url: string;
        type: string;
        mime_type?: string;
        width?: number;
        height?: number;
        duration?: number;
        size?: number;
      }[] = [];

      if (media) {
        const uploaded = await uploadFile(
          token,
          media.uri,
          media.name,
          media.mimeType
        );
        attachments.push({
          url: uploaded.url,
          type: media.type,
          mime_type: media.mimeType,
          width: media.width,
          height: media.height,
          duration: media.duration,
          size: media.size,
        });
      }

      await updatesApi.createStory(token, {
        content: text.trim() || null,
        background_color: mode === "text" ? bgColor : null,
        font_color: mode === "text" ? "#FFFFFF" : null,
        attachments,
      });

      router.back();
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Falha ao publicar story");
    } finally {
      setSending(false);
    }
  }, [token, canPublish, sending, media, text, mode, bgColor, router]);

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => (mode === "choose" ? router.back() : reset())}
          style={styles.headerBtn}
        >
          {mode === "choose" ? (
            <ArrowLeft size={24} color="white" />
          ) : (
            <X size={24} color="white" />
          )}
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Novo status</Text>
        {mode !== "choose" ? (
          <TouchableOpacity
            onPress={handlePublish}
            disabled={!canPublish || sending}
            style={[
              styles.headerBtn,
              (!canPublish || sending) && styles.headerBtnDisabled,
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Send size={22} color={canPublish ? colors.tint : "#666"} />
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

      {mode === "choose" && (
        <View style={styles.chooseBody}>
          <Text style={styles.chooseTitle}>O que você quer compartilhar?</Text>
          <Text style={styles.chooseSubtitle}>
            Foto, vídeo ou texto — some em 24 horas.
          </Text>

          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: colors.tint }]}
            onPress={openCamera}
            activeOpacity={0.85}
          >
            <Camera size={28} color="white" />
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionTitle}>Câmera</Text>
              <Text style={styles.optionDesc}>Tirar foto ou gravar vídeo</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: "#1F2937" }]}
            onPress={openGallery}
            activeOpacity={0.85}
          >
            <ImageIcon size={28} color="white" />
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionTitle}>Galeria</Text>
              <Text style={styles.optionDesc}>Escolher foto ou vídeo</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: "#1F2937" }]}
            onPress={startText}
            activeOpacity={0.85}
          >
            <Type size={28} color="white" />
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionTitle}>Texto</Text>
              <Text style={styles.optionDesc}>Status com cor de fundo</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {mode === "media" && media && (
        <View style={styles.previewBody}>
          <Image
            source={{ uri: media.uri }}
            style={styles.previewMedia}
            resizeMode="contain"
          />
          {media.type === "video" && (
            <View style={styles.videoBadge}>
              <Video size={16} color="white" />
              <Text style={styles.videoBadgeText}>Vídeo</Text>
            </View>
          )}
          <View
            style={[
              styles.captionBar,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            <TextInput
              style={styles.captionInput}
              placeholder="Adicionar legenda..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={text}
              onChangeText={setText}
              maxLength={500}
            />
          </View>
        </View>
      )}

      {mode === "text" && (
        <View style={[styles.textBody, { backgroundColor: bgColor }]}>
          <TextInput
            style={styles.textStoryInput}
            placeholder="Digite seu status..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={400}
            autoFocus
            textAlign="center"
          />
          <View
            style={[
              styles.colorRow,
              { paddingBottom: Math.max(insets.bottom, 20) },
            ]}
          >
            {BG_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.colorDot,
                  { backgroundColor: c },
                  bgColor === c && styles.colorDotSelected,
                ]}
                onPress={() => setBgColor(c)}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 12,
    zIndex: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerBtnDisabled: { opacity: 0.5 },
  headerTitle: {
    color: "white",
    fontSize: 17,
    fontWeight: "600",
  },
  chooseBody: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    gap: 14,
  },
  chooseTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  chooseSubtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
    marginBottom: 20,
    lineHeight: 22,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 18,
    borderRadius: 16,
  },
  optionTextWrap: { flex: 1 },
  optionTitle: {
    color: "white",
    fontSize: 17,
    fontWeight: "600",
  },
  optionDesc: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    marginTop: 2,
  },
  previewBody: {
    flex: 1,
    justifyContent: "center",
  },
  previewMedia: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
  videoBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  videoBadgeText: {
    color: "white",
    fontSize: 13,
    fontWeight: "600",
  },
  captionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  captionInput: {
    color: "white",
    fontSize: 16,
    minHeight: 44,
    paddingVertical: 10,
  },
  textBody: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  textStoryInput: {
    color: "white",
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 36,
    minHeight: 160,
    textAlignVertical: "center",
  },
  colorRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    paddingTop: 16,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorDotSelected: {
    borderColor: "white",
    transform: [{ scale: 1.15 }],
  },
});
