import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Send,
  BarChart3,
  Image as ImageIcon,
  X,
  Video,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { uploadFile } from "@/services/api";
import * as updatesApi from "@/services/updatesApi";

const MAX_ATTACHMENTS = 4;

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

export default function CreatePostScreen() {
  const { colors } = useAppTheme();
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState("contacts");
  const [isPoll, setIsPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [media, setMedia] = useState<SelectedMedia[]>([]);
  const [sending, setSending] = useState(false);

  const canSend =
    content.trim().length > 0 ||
    media.length > 0 ||
    (isPoll && pollOptions.filter((o) => o.trim()).length >= 2);

  const applyAssets = useCallback((assets: ImagePicker.ImagePickerAsset[]) => {
    setMedia((prev) => {
      const remaining = MAX_ATTACHMENTS - prev.length;
      if (remaining <= 0) return prev;

      const next = assets.slice(0, remaining).map((asset) => {
        const isVideo =
          asset.type === "video" || asset.mimeType?.startsWith("video/") === true;
        return {
          uri: asset.uri,
          type: (isVideo ? "video" : "image") as "image" | "video",
          mimeType: asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg"),
          name: isVideo
            ? `post_${Date.now()}.mp4`
            : `post_${Date.now()}.jpg`,
          width: asset.width,
          height: asset.height,
          duration: asset.duration ? Math.round(asset.duration / 1000) : undefined,
          size: asset.fileSize,
        };
      });

      return [...prev, ...next];
    });
  }, []);

  const openGallery = useCallback(async () => {
    try {
      if (media.length >= MAX_ATTACHMENTS) {
        Alert.alert("Limite", `Você pode anexar no máximo ${MAX_ATTACHMENTS} arquivos.`);
        return;
      }

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
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
        allowsMultipleSelection: true,
        selectionLimit: MAX_ATTACHMENTS - media.length,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets.length > 0) {
        applyAssets(result.assets);
      }
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Não foi possível abrir a galeria.");
    }
  }, [media.length, applyAssets]);

  const openCamera = useCallback(async () => {
    try {
      if (media.length >= MAX_ATTACHMENTS) {
        Alert.alert("Limite", `Você pode anexar no máximo ${MAX_ATTACHMENTS} arquivos.`);
        return;
      }

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
          applyAssets([{
            uri,
            width: 0,
            height: 0,
            type: isVideo ? "video" : "image",
            mimeType: file.type || (isVideo ? "video/mp4" : "image/jpeg"),
            fileName: file.name,
            fileSize: file.size,
          } as any]);
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
          videoMaxDuration: 60,
        });

        if (!result.canceled && result.assets.length > 0) {
          applyAssets(result.assets);
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
  }, [media.length, applyAssets]);

  const handleSelectMediaOption = useCallback(() => {
    Alert.alert(
      "Adicionar Mídia",
      "Como deseja adicionar foto ou vídeo?",
      [
        { text: "Escolher da Galeria", onPress: openGallery },
        { text: "Usar Câmera", onPress: openCamera },
        { text: "Cancelar", style: "cancel" },
      ],
      { cancelable: true }
    );
  }, [openGallery, openCamera]);

  const removeMedia = useCallback((index: number) => {
    setMedia((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSend = async () => {
    if (!token || !canSend || sending) return;
    setSending(true);
    try {
      const validOptions = pollOptions.filter((o) => o.trim());
      const attachments: {
        url: string;
        type: string;
        mime_type?: string;
        width?: number;
        height?: number;
        duration?: number;
        size?: number;
      }[] = [];

      for (const item of media) {
        const uploaded = await uploadFile(token, item.uri, item.name, item.mimeType);
        attachments.push({
          url: uploaded.url,
          type: item.type,
          mime_type: item.mimeType,
          width: item.width,
          height: item.height,
          duration: item.duration,
          size: item.size,
        });
      }

      let type = "text";
      if (isPoll && validOptions.length >= 2) {
        type = "poll";
      } else if (attachments.length > 0) {
        const allVideo = attachments.every((a) => a.type === "video");
        type = allVideo ? "video" : "image";
      }

      const data: Parameters<typeof updatesApi.createPost>[1] = {
        type,
        content: content.trim() || null,
        visibility,
        attachments,
      };

      if (type === "poll") {
        data.poll_options = validOptions;
        data.poll_duration_hours = 24;
      }

      await updatesApi.createPost(token, data);
      router.back();
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Falha ao criar post");
    } finally {
      setSending(false);
    }
  };

  const addPollOption = () => {
    if (pollOptions.length < 5) {
      setPollOptions([...pollOptions, ""]);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, backgroundColor: colors.headerBackground },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Criar post</Text>
        <TouchableOpacity onPress={handleSend} disabled={sending || !canSend}>
          {sending ? (
            <ActivityIndicator size="small" color={colors.tint} />
          ) : (
            <Send size={22} color={canSend ? colors.tint : colors.textSecondary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 40 }}>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder="O que está acontecendo?"
          placeholderTextColor={colors.textSecondary}
          multiline
          value={content}
          onChangeText={setContent}
        />

        {media.length > 0 && (
          <View style={styles.mediaGrid}>
            {media.map((item, index) => (
              <View key={`${item.uri}-${index}`} style={styles.mediaThumb}>
                <Image source={{ uri: item.uri }} style={styles.mediaImage} />
                {item.type === "video" && (
                  <View style={styles.videoBadge}>
                    <Video size={14} color="white" />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.removeMedia}
                  onPress={() => removeMedia(index)}
                  hitSlop={8}
                >
                  <X size={14} color="white" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.mediaButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={handleSelectMediaOption}
          disabled={media.length >= MAX_ATTACHMENTS}
        >
          <ImageIcon size={20} color={colors.icon} />
          <Text style={[styles.mediaButtonText, { color: colors.text }]}>
            {media.length >= MAX_ATTACHMENTS
              ? "Limite de anexos atingido"
              : "Adicionar foto ou vídeo"}
          </Text>
        </TouchableOpacity>

        <View style={styles.optionsRow}>
          {["contacts", "followers", "public"].map((v) => (
            <TouchableOpacity
              key={v}
              style={[
                styles.optionChip,
                {
                  backgroundColor: visibility === v ? colors.tint : colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setVisibility(v)}
            >
              <Text
                style={[
                  styles.optionText,
                  { color: visibility === v ? "white" : colors.text },
                ]}
              >
                {v === "contacts" ? "Contatos" : v === "followers" ? "Seguidores" : "Público"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.pollToggle,
            {
              backgroundColor: isPoll ? colors.tint : colors.surface,
              borderColor: colors.border,
            },
          ]}
          onPress={() => setIsPoll(!isPoll)}
        >
          <BarChart3 size={20} color={isPoll ? "white" : colors.icon} />
          <Text style={[styles.pollToggleText, { color: isPoll ? "white" : colors.text }]}>
            {isPoll ? "Remover enquete" : "Adicionar enquete"}
          </Text>
        </TouchableOpacity>

        {isPoll && (
          <View style={styles.pollSection}>
            {pollOptions.map((opt, i) => (
              <TextInput
                key={i}
                style={[styles.pollInput, { color: colors.text, borderColor: colors.border }]}
                placeholder={`Opção ${i + 1}`}
                placeholderTextColor={colors.textSecondary}
                value={opt}
                onChangeText={(t) => {
                  const next = [...pollOptions];
                  next[i] = t;
                  setPollOptions(next);
                }}
              />
            ))}
            {pollOptions.length < 5 && (
              <TouchableOpacity style={styles.addOption} onPress={addPollOption}>
                <Text style={[styles.addOptionText, { color: colors.tint }]}>
                  + Adicionar opção
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: "600" },
  body: { flex: 1, padding: 16 },
  input: {
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: "top",
    lineHeight: 24,
  },
  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  mediaThumb: {
    width: 88,
    height: 88,
    borderRadius: 10,
    overflow: "hidden",
  },
  mediaImage: {
    width: "100%",
    height: "100%",
  },
  videoBadge: {
    position: "absolute",
    left: 6,
    bottom: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 10,
    padding: 4,
  },
  removeMedia: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 10,
    padding: 3,
  },
  mediaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
  },
  mediaButtonText: { fontSize: 14, fontWeight: "500" },
  optionsRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  optionText: { fontSize: 14, fontWeight: "500" },
  pollToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
  },
  pollToggleText: { fontSize: 14, fontWeight: "500" },
  pollSection: { marginTop: 12, gap: 8 },
  pollInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  addOption: { padding: 8 },
  addOptionText: { fontSize: 14, fontWeight: "500" },
});
