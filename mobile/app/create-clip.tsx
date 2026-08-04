import { useCallback, useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth } from "@/context/AuthContext";
import { uploadFile } from "@/services/api";
import * as updatesApi from "@/services/updatesApi";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type ClipMode = "camera" | "preview";
type CaptureType = "photo" | "video";

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

export default function CreateClipScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<ClipMode>("camera");
  const [media, setMedia] = useState<SelectedMedia | null>(null);
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState("contacts");
  const [sending, setSending] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [facing, setFacing] = useState<CameraType>("back");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [captureType, setCaptureType] = useState<CaptureType>("video");
  const [lastMediaUri, setLastMediaUri] = useState<string | null>(null);
  const [recentMedia, setRecentMedia] = useState<MediaLibrary.Asset[]>([]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const loadLastMedia = useCallback(async () => {
    try {
      const { status } = await MediaLibrary.getPermissionsAsync(false, [
        "photo",
        "video",
      ]);
      if (status === "granted") {
        const result = await MediaLibrary.getAssetsAsync({
          first: 1,
          mediaType: [
            MediaLibrary.MediaType.photo,
            MediaLibrary.MediaType.video,
          ],
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        });
        if (result.assets && result.assets.length > 0) {
          setLastMediaUri(result.assets[0].uri);
        }
      }
    } catch (err) {
      console.log("Error loading last media:", err);
    }
  }, []);

  const loadRecentMediaList = useCallback(async () => {
    try {
      const { status } = await MediaLibrary.getPermissionsAsync(false, [
        "photo",
        "video",
      ]);
      if (status === "granted") {
        const result = await MediaLibrary.getAssetsAsync({
          first: 12,
          mediaType: [
            MediaLibrary.MediaType.photo,
            MediaLibrary.MediaType.video,
          ],
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        });
        if (result.assets) {
          setRecentMedia(result.assets);
        }
      }
    } catch (err) {
      console.log("Error loading recent media list:", err);
    }
  }, []);

  useEffect(() => {
    loadLastMedia();
    loadRecentMediaList();
  }, [loadLastMedia, loadRecentMediaList, mode]);

  const toggleFacing = useCallback(() => {
    setFacing((prev) => (prev === "back" ? "front" : "back"));
  }, []);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
      });
      if (photo) {
        setMedia({
          uri: photo.uri,
          type: "image",
          mimeType: "image/jpeg",
          name: `clip_${Date.now()}.jpg`,
          width: photo.width,
          height: photo.height,
        });
        setMode("preview");
      }
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Não foi possível tirar a foto.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (!cameraRef.current || !isRecording) return;
    cameraRef.current.stopRecording();
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    if (!cameraRef.current || isRecording) return;
    try {
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= 60) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

      const video = await cameraRef.current.recordAsync({
        maxDuration: 60,
      });

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      if (video) {
        setMedia({
          uri: video.uri,
          type: "video",
          mimeType: "video/mp4",
          name: `clip_${Date.now()}.mp4`,
          duration: recordingDuration,
        });
        setMode("preview");
      }
    } catch (e: any) {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      Alert.alert("Erro", e?.message || "Não foi possível gravar o vídeo.");
    } finally {
      setIsRecording(false);
    }
  }, [isRecording, recordingDuration, stopRecording]);

  const handleCapturePress = useCallback(() => {
    if (captureType === "photo") {
      takePhoto();
    } else {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    }
  }, [captureType, takePhoto, startRecording, stopRecording, isRecording]);

  const openGallery = useCallback(async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permissão necessária",
          "Precisamos de acesso à galeria para escolher foto ou vídeo.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        quality: 0.85,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const isVideo =
          asset.type === "video" ||
          asset.mimeType?.startsWith("video/") === true;
        setMedia({
          uri: asset.uri,
          type: isVideo ? "video" : "image",
          mimeType: asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg"),
          name: isVideo ? `clip_${Date.now()}.mp4` : `clip_${Date.now()}.jpg`,
          width: asset.width,
          height: asset.height,
          duration: asset.duration
            ? Math.round(asset.duration / 1000)
            : undefined,
          size: asset.fileSize,
        });
        setMode("preview");
      }
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Não foi possível abrir a galeria.");
    }
  }, []);

  const resetToCamera = useCallback(() => {
    setMedia(null);
    setCaption("");
    setMode("camera");
  }, []);

  const canPublish = media != null;

  const handlePublish = useCallback(async () => {
    if (!token || !canPublish || sending || !media) return;
    setSending(true);
    try {
      const uploaded = await uploadFile(
        token,
        media.uri,
        media.name,
        media.mimeType,
      );

      await updatesApi.createPost(token, {
        type: "clip",
        content: caption.trim() || null,
        visibility,
        attachments: [
          {
            url: uploaded.url,
            type: media.type,
            mime_type: media.mimeType,
            width: media.width,
            height: media.height,
            duration: media.duration,
            size: media.size,
          },
        ],
      });

      router.back();
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Falha ao criar clip");
    } finally {
      setSending(false);
    }
  }, [token, canPublish, sending, media, caption, visibility, router]);

  if (!permission) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#07C160" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.center]}>
        <MaterialCommunityIcons
          name="camera"
          size={64}
          color="rgba(255,255,255,0.3)"
        />
        <Text style={styles.permissionText}>
          Precisamos de acesso à sua câmera
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>Permitir Câmera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.permissionButtonSecondary}
          onPress={() => router.back()}
        >
          <Text style={styles.permissionButtonTextSecondary}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (mode === "preview" && media) {
    return (
      <View style={styles.container}>
        <View style={[styles.previewHeader, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={resetToCamera} style={styles.headerBtn}>
            <MaterialCommunityIcons name="close" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Preview</Text>
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
              <MaterialCommunityIcons
                name="send"
                size={22}
                color={canPublish ? "#07C160" : "#666"}
              />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.previewMediaContainer}>
          <Image
            source={{ uri: media.uri }}
            style={styles.previewMedia}
            resizeMode="cover"
          />
          {media.type === "video" && (
            <View style={styles.videoBadge}>
              <MaterialCommunityIcons name="video" size={14} color="white" />
              <Text style={styles.videoBadgeText}>
                {media.duration ? `${media.duration}s` : "Vídeo"}
              </Text>
            </View>
          )}
        </View>

        <View
          style={[
            styles.previewControls,
            { paddingBottom: insets.bottom + 16 },
          ]}
        >
          <View style={styles.captionContainer}>
            <TextInput
              style={styles.captionInput}
              placeholder="Adicione uma legenda..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={300}
            />
          </View>

          <View style={styles.visibilityRow}>
            {(["contacts", "followers", "public"] as const).map((v) => (
              <TouchableOpacity
                key={v}
                style={[
                  styles.visibilityChip,
                  visibility === v && styles.visibilityChipActive,
                ]}
                onPress={() => setVisibility(v)}
              >
                <Text
                  style={[
                    styles.visibilityText,
                    visibility === v && styles.visibilityTextActive,
                  ]}
                >
                  {v === "contacts"
                    ? "Contatos"
                    : v === "followers"
                      ? "Seguidores"
                      : "Público"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        flash={flashEnabled ? "on" : "off"}
        mode={captureType === "video" ? "video" : "picture"}
      />

      <View style={styles.cameraOverlay}>
        <View style={[styles.cameraHeader, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerBtn}
          >
            <Ionicons name="chevron-back-outline" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Novo clip</Text>
          <TouchableOpacity
            style={styles.flashBtn}
            onPress={() => setFlashEnabled((prev) => !prev)}
          >
            {flashEnabled ? (
              <MaterialCommunityIcons name="flash" size={20} color="#FFD700" />
            ) : (
              <MaterialCommunityIcons
                name="flash-off"
                size={20}
                color="white"
              />
            )}
          </TouchableOpacity>
        </View>

        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>
              {String(Math.floor(recordingDuration / 60)).padStart(2, "0")}:
              {String(recordingDuration % 60).padStart(2, "0")}
            </Text>
          </View>
        )}

        <View
          style={[styles.bottomControls, { paddingBottom: insets.bottom + 10 }]}
        >
          {recentMedia.length > 0 && (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={recentMedia}
              keyExtractor={(item) => item.id}
              style={styles.recentMediaCarousel}
              contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.carouselItem}
                  onPress={async () => {
                    try {
                      const info = await MediaLibrary.getAssetInfoAsync(item);
                      const isVideo =
                        item.mediaType === MediaLibrary.MediaType.video;
                      setMedia({
                        uri: info.localUri || info.uri,
                        type: isVideo ? "video" : "image",
                        mimeType: isVideo ? "video/mp4" : "image/jpeg",
                        name: `clip_${Date.now()}.${isVideo ? "mp4" : "jpg"}`,
                        duration: item.duration
                          ? Math.round(item.duration)
                          : undefined,
                        width: item.width,
                        height: item.height,
                      });
                      setMode("preview");
                    } catch {
                      Alert.alert("Erro", "Não foi possível abrir a mídia.");
                    }
                  }}
                >
                  <Image
                    source={{ uri: item.uri }}
                    style={styles.carouselImage}
                  />
                  {item.mediaType === MediaLibrary.MediaType.video && (
                    <View style={styles.videoIndicator}>
                      <Text style={styles.videoIndicatorText}>▶</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />
          )}

          <View style={styles.modeSelector}>
            <TouchableOpacity
              onPress={() => {
                if (!isRecording) setCaptureType("photo");
              }}
              style={[
                styles.modeButton,
                captureType === "photo" && styles.modeButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.modeText,
                  captureType === "photo" && styles.modeTextActive,
                ]}
              >
                Foto
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (!isRecording) setCaptureType("video");
              }}
              style={[
                styles.modeButton,
                captureType === "video" && styles.modeButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.modeText,
                  captureType === "video" && styles.modeTextActive,
                ]}
              >
                Vídeo
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={styles.galleryButton}
              onPress={openGallery}
            >
              {lastMediaUri ? (
                <Image
                  source={{ uri: lastMediaUri }}
                  style={styles.thumbnailImage}
                />
              ) : (
                <MaterialCommunityIcons
                  name="image-outline"
                  size={22}
                  color="#fff"
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.captureButton,
                isRecording && styles.captureButtonRecording,
              ]}
              onPress={handleCapturePress}
              activeOpacity={0.8}
            >
              {isRecording ? (
                <View style={styles.stopIcon} />
              ) : (
                <View
                  style={[
                    styles.captureInner,
                    captureType === "video" && styles.captureInnerVideo,
                  ]}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.flipButton}
              onPress={toggleFacing}
              disabled={isRecording}
            >
              <MaterialCommunityIcons
                name="camera-flip"
                size={22}
                color="white"
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  permissionText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 16,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: "#07C160",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  permissionButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  permissionButtonSecondary: {
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  permissionButtonTextSecondary: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 16,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  cameraHeader: {
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
  headerBtnDisabled: {
    opacity: 0.5,
  },
  headerTitle: {
    color: "white",
    fontSize: 17,
    fontWeight: "600",
  },
  flashBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 20,
  },
  recordingIndicator: {
    position: "absolute",
    top: 110,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FF3B30",
  },
  recordingText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  bottomControls: {
    backgroundColor: "transparent",
    paddingVertical: 16,
  },
  recentMediaCarousel: {
    maxHeight: 80,
    marginBottom: 16,
  },
  carouselItem: {
    width: 56,
    height: 72,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#fff",
    backgroundColor: "#000",
    position: "relative",
  },
  carouselImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  videoIndicator: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -8 }, { translateY: -8 }],
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  videoIndicatorText: {
    color: "#fff",
    fontSize: 8,
  },
  modeSelector: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    gap: 24,
  },
  modeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  modeButtonActive: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  modeText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  modeTextActive: {
    color: "#fff",
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  galleryButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "#fff",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  galleryPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  captureButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 6,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  captureButtonRecording: {
    borderColor: "#FF3B30",
  },
  captureInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "white",
  },
  captureInnerVideo: {
    backgroundColor: "#FF3B30",
    borderRadius: 8,
    width: 28,
    height: 28,
  },
  stopIcon: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: "#FF3B30",
  },
  flipButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 12,
    zIndex: 10,
  },
  previewMediaContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  previewMedia: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.55,
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
  previewControls: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  captionContainer: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  captionInput: {
    color: "white",
    fontSize: 15,
    minHeight: 40,
    maxHeight: 100,
  },
  visibilityRow: {
    flexDirection: "row",
    gap: 8,
  },
  visibilityChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  visibilityChipActive: {
    backgroundColor: "#07C160",
  },
  visibilityText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "500",
  },
  visibilityTextActive: {
    color: "white",
  },
});
