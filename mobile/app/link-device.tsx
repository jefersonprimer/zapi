import React, { useState, useRef, useEffect, useCallback } from "react";
import * as MediaLibrary from "expo-media-library";
import * as ImagePicker from "expo-image-picker";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Clipboard,
  Linking,
  Image,
  FlatList,
  Animated,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { API_URL, addContact, createChat } from "@/services/api";
import { CameraView, useCameraPermissions } from "expo-camera";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export default function LinkDeviceScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isLinkModeOnly = mode === "link";
  const isScanMode = mode === "scan";

  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [manualCode, setManualCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<any | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [flash, setFlash] = useState<"off" | "on" | "auto">("off");
  const [lastMediaUri, setLastMediaUri] = useState<string | null>(null);
  const [detectedQR, setDetectedQR] = useState(false);
  const shutterScale = useRef(new Animated.Value(1)).current;

  const [cameraMode, setCameraMode] = useState<"picture" | "video">("picture");
  const [isRecording, setIsRecording] = useState(false);
  const [recentMedia, setRecentMedia] = useState<MediaLibrary.Asset[]>([]);

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
    } catch (err: any) {
      console.log("Error loading last media (this is expected in Expo Go on Android):", err?.message || err);
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
          first: 10,
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
    } catch (err: any) {
      console.log("Error loading recent media list (this is expected in Expo Go on Android):", err?.message || err);
    }
  }, []);

  useEffect(() => {
    if (isScanning && !isLinkModeOnly && !isScanMode) {
      loadLastMedia();
      loadRecentMediaList();
    }
  }, [
    isScanning,
    isLinkModeOnly,
    isScanMode,
    loadLastMedia,
    loadRecentMediaList,
  ]);

  async function handleOpenGallery() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsEditing: false,
        quality: 1,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        Alert.alert(
          "Mídia Selecionada",
          `Você selecionou: ${result.assets[0].uri.split("/").pop()}`,
        );
      }
    } catch {
      Alert.alert("Erro", "Não foi possível abrir a galeria.");
    }
  }

  const handlePressIn = () => {
    Animated.spring(shutterScale, {
      toValue: 0.88,
      useNativeDriver: true,
      tension: 40,
      friction: 3,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(shutterScale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 40,
      friction: 3,
    }).start();
  };

  async function handleTakePicture() {
    if (cameraRef.current) {
      try {
        setLoading(true);
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.85,
        });
        if (photo && photo.uri) {
          const { status } = await MediaLibrary.requestPermissionsAsync(true);
          if (status === "granted") {
            await MediaLibrary.createAssetAsync(photo.uri);
            Alert.alert("Sucesso", "Foto salva na galeria!");
            loadLastMedia();
            loadRecentMediaList();
          } else {
            Alert.alert(
              "Permissão negada",
              "Permissão para acessar a galeria foi negada.",
            );
          }
        }
      } catch (err: any) {
        Alert.alert("Erro", err.message || "Erro ao tirar foto.");
      } finally {
        setLoading(false);
      }
    }
  }

  async function handleRecordVideo() {
    if (cameraRef.current) {
      if (isRecording) {
        try {
          cameraRef.current.stopRecording();
        } catch (err) {
          console.error("Stop recording error:", err);
        }
      } else {
        try {
          setIsRecording(true);
          const video = await cameraRef.current.recordAsync({
            maxDuration: 60,
          });
          if (video && video.uri) {
            const { status } = await MediaLibrary.requestPermissionsAsync(true);
            if (status === "granted") {
              await MediaLibrary.createAssetAsync(video.uri);
              Alert.alert("Sucesso", "Vídeo Salvo!", [
                {
                  text: "OK",
                  onPress: () => {
                    loadLastMedia();
                    loadRecentMediaList();
                  },
                },
              ]);
            } else {
              Alert.alert(
                "Permissão negada",
                "Permissão para salvar o vídeo foi negada.",
              );
            }
          }
        } catch (err: any) {
          Alert.alert("Erro", err.message || "Erro ao gravar vídeo.");
        } finally {
          setIsRecording(false);
        }
      }
    }
  }

  // Extract session code from QR payload
  function extractSessionCode(qrData: string): string {
    if (qrData.startsWith("zapi://login/")) {
      return qrData.replace("zapi://login/", "");
    }
    if (qrData.includes("/qr/")) {
      const parts = qrData.split("/qr/");
      return parts[parts.length - 1];
    }
    return qrData.trim();
  }

  async function handleVerifyCode(codeToVerify: string) {
    const cleanedCode = codeToVerify.trim();
    if (!cleanedCode) {
      Alert.alert("Erro", "Código inválido.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/web/session/${cleanedCode}`);
      if (!res.ok) {
        throw new Error("Código expirado ou inválido.");
      }
      const data = await res.json();
      if (data.status !== "waiting") {
        throw new Error(`Esta sessão está em estado: ${data.status}`);
      }
      setSessionInfo(data);
      setIsScanning(false);
    } catch (err: any) {
      Alert.alert(
        "Erro",
        err.message || "Não foi possível verificar a sessão.",
      );
      setSessionInfo(null);
    } finally {
      setLoading(false);
    }
  }

  async function processScannedData(trimmedData: string) {
    // 1. Check if it's a device login code
    if (
      trimmedData.startsWith("zapi://login/") ||
      (!isLinkModeOnly &&
        (trimmedData.includes("/qr/") ||
          (trimmedData.length === 14 && /^[A-Z0-9]+$/.test(trimmedData))))
    ) {
      const code = extractSessionCode(trimmedData);
      if (code) {
        await handleVerifyCode(code);
      }
      return;
    }

    // If we are strictly in link mode, reject other formats
    if (isLinkModeOnly) {
      Alert.alert(
        "Aparelho Não Conectado",
        "Este QR Code não é válido para login. Por favor, escaneie o QR Code exibido na página de login do Zapi Web.",
      );
      return;
    }

    // 2. Check if it's a contact or user profile QR code
    if (
      trimmedData.startsWith("zapi://contact/") ||
      trimmedData.startsWith("zapi://user/") ||
      trimmedData.startsWith("zapi:user_id:")
    ) {
      const contactId = trimmedData
        .replace("zapi://contact/", "")
        .replace("zapi://user/", "")
        .replace("zapi:user_id:", "");

      try {
        setLoading(true);
        // 1. Add contact
        await addContact(token || "", contactId);
        // 2. Open chat
        const chatData = await createChat(token || "", contactId);

        Alert.alert("Sucesso", "Contato adicionado com sucesso!", [
          {
            text: "Ir para Conversa",
            onPress: () => {
              router.replace({
                pathname: "/chat",
                params: {
                  chatId: chatData.id,
                  participantId: contactId,
                  participantUsername: `Usuário ${contactId.substring(0, 6)}`,
                },
              });
            },
          },
          { text: "Fechar", onPress: () => setIsScanning(true) },
        ]);
      } catch (err: any) {
        Alert.alert(
          "Erro",
          err.message || "Não foi possível adicionar o contato.",
        );
        setIsScanning(true);
      } finally {
        setLoading(false);
      }
      return;
    }

    // 3. Check if it's a web URL
    if (
      trimmedData.startsWith("http://") ||
      trimmedData.startsWith("https://")
    ) {
      Alert.alert(
        "Link Escaneado",
        `O que deseja fazer com o link abaixo?\n\n${trimmedData}`,
        [
          {
            text: "Cancelar",
            style: "cancel",
            onPress: () => setIsScanning(true),
          },
          {
            text: "Copiar",
            onPress: () => {
              Clipboard.setString(trimmedData);
              Alert.alert(
                "Copiado",
                "Link copiado para a área de transferência!",
              );
              setIsScanning(true);
            },
          },
          {
            text: "Abrir Link",
            onPress: () => {
              Linking.openURL(trimmedData).catch(() =>
                Alert.alert("Erro", "Não foi possível abrir o link."),
              );
              setIsScanning(true);
            },
          },
        ],
      );
      return;
    }

    // 4. Fallback to generic text
    Alert.alert("Código Escaneado", `Conteúdo escaneado:\n\n${trimmedData}`, [
      { text: "Cancelar", style: "cancel", onPress: () => setIsScanning(true) },
      {
        text: "Copiar",
        onPress: () => {
          Clipboard.setString(trimmedData);
          Alert.alert("Copiado", "Texto copiado para a área de transferência!");
          setIsScanning(true);
        },
      },
    ]);
  }

  async function handleBarcodeScanned({ data }: { data: string }) {
    if (loading || sessionInfo || detectedQR) return;
    const trimmedData = data.trim();
    if (!trimmedData) return;

    setDetectedQR(true);

    setTimeout(() => {
      setDetectedQR(false);
      processScannedData(trimmedData);
    }, 850);
  }

  async function handleConfirm(approve: boolean) {
    if (!sessionInfo || !token) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/web/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: sessionInfo.code,
          approve,
        }),
      });

      if (!res.ok) {
        throw new Error("Falha ao enviar resposta de autenticação.");
      }

      if (approve) {
        Alert.alert("Sucesso", "Login autorizado no navegador!", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert("Cancelado", "Login cancelado.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Erro ao responder confirmação.");
    } finally {
      setLoading(false);
    }
  }

  // Request camera permission
  if (isScanning && !permission) {
    return (
      <View
        style={[styles.centerContainer, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (isScanning && permission && !permission.granted) {
    return (
      <View
        style={[
          styles.centerContainer,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingHorizontal: 24,
          },
        ]}
      >
        <MaterialCommunityIcons
          name="camera"
          size={48}
          color={colors.textSecondary}
          style={{ marginBottom: 16 }}
        />
        <Text style={[styles.title, { color: colors.text }]}>
          Permissão de Câmera
        </Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Precisamos de acesso à câmera para escanear o QR Code no site web.
        </Text>
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: colors.tint, marginTop: 16 },
          ]}
          onPress={requestPermission}
        >
          <Text style={[styles.buttonText, { color: colors.background }]}>
            Conceder Permissão
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ marginTop: 20 }}
          onPress={() => setIsScanning(false)}
        >
          <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>
            Digitar código manualmente
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      {isScanning ? (
        <View
          style={[
            styles.headerAbsolute,
            {
              paddingTop: insets.top,
              height: 60 + insets.top,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={[
              styles.iconButton,
              { backgroundColor: "rgba(0,0,0,0.5)" },
            ]}
          >
            <Ionicons
              name="chevron-back-outline"
              size={22}
              color="#fff"
            />
          </TouchableOpacity>

          {isScanning && !isLinkModeOnly ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <TouchableOpacity
                style={[
                  styles.iconButton,
                  { backgroundColor: "rgba(0,0,0,0.5)" },
                ]}
                onPress={() =>
                  setFlash((f) =>
                    f === "off" ? "on" : f === "on" ? "auto" : "off",
                  )
                }
              >
                {flash === "off" ? (
                  <MaterialCommunityIcons
                    name="flash-off"
                    size={20}
                    color="#fff"
                  />
                ) : (
                  <MaterialCommunityIcons
                    name="flash"
                    size={20}
                    color={flash === "on" ? colors.badge : "#fff"}
                  />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsScanning(false)}
                style={[
                  styles.iconButton,
                  { backgroundColor: "rgba(0,0,0,0.5)" },
                ]}
              >
                <MaterialCommunityIcons
                  name="keyboard-outline"
                  size={20}
                  color="#fff"
                />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ width: 42 }} />
          )}
        </View>
      ) : (
        <View
          style={[
            styles.customHeader,
            {
              paddingTop: insets.top,
              backgroundColor: colors.headerBackground,
            },
          ]}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[
                styles.backButton,
                {
                  borderColor: isDark
                    ? "rgba(255, 255, 255, 0.12)"
                    : "rgba(0, 0, 0, 0.08)",
                  backgroundColor: isDark
                    ? "rgba(30, 30, 30, 0.98)"
                    : "rgba(255, 255, 255, 0.98)",
                },
              ]}
            >
              <Ionicons
                name="chevron-back-outline"
                size={24}
                color={colors.headerText}
              />
            </TouchableOpacity>

            <Text style={[styles.headerTitle, { color: colors.headerText }]}>
              {isLinkModeOnly
                ? "Conectar Aparelho"
                : isScanMode
                  ? "Escanear QR Code"
                  : "Câmera"}
            </Text>
          </View>
        </View>
      )}

      {isScanning && (
        /* Camera Scanner View */
        <View style={styles.scannerContainer}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFillObject}
            facing={facing}
            flash={flash}
            mode={cameraMode}
            onBarcodeScanned={handleBarcodeScanned}
          />

          {isLinkModeOnly || isScanMode ? (
            <>
              {/* Scanning Reticle overlay */}
              <View style={styles.overlayContainer}>
                <View style={styles.unfocusedArea} />
                <View style={styles.middleRow}>
                  <View style={styles.unfocusedArea} />
                  <View
                    style={[
                      styles.focusedTarget,
                      { borderColor: colors.badge },
                    ]}
                  >
                    <View
                      style={[
                        styles.corner,
                        styles.topLeft,
                        { borderColor: colors.badge },
                      ]}
                    />
                    <View
                      style={[
                        styles.corner,
                        styles.topRight,
                        { borderColor: colors.badge },
                      ]}
                    />
                    <View
                      style={[
                        styles.corner,
                        styles.bottomLeft,
                        { borderColor: colors.badge },
                      ]}
                    />
                    <View
                      style={[
                        styles.corner,
                        styles.bottomRight,
                        { borderColor: colors.badge },
                      ]}
                    />
                  </View>
                  <View style={styles.unfocusedArea} />
                </View>
                <View style={styles.unfocusedArea} />
              </View>

              <View
                style={[
                  styles.scannerInstructions,
                  { bottom: 40 + insets.bottom },
                ]}
              >
                <Text style={styles.scannerInstructionsText}>
                  {isScanMode
                    ? "Aponte a câmera para o QR Code do contato ou aparelho"
                    : "Aponte a câmera para o QR Code na tela do Zapi Web"}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.switchModeButton,
                    { backgroundColor: colors.surface },
                  ]}
                  onPress={() => setIsScanning(false)}
                >
                  <MaterialCommunityIcons
                    name="keyboard-outline"
                    size={18}
                    color={colors.text}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "600",
                      fontSize: 14,
                    }}
                  >
                    Digitar código manualmente
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {/* QR Guide Overlay (appears automatically when a QR code is detected) */}
              {detectedQR && (
                <View style={styles.overlayContainer}>
                  <View style={styles.unfocusedArea} />
                  <View style={styles.middleRow}>
                    <View style={styles.unfocusedArea} />
                    <View
                      style={[styles.focusedTarget, { borderColor: "#4CD964" }]}
                    >
                      <View
                        style={[
                          styles.corner,
                          styles.topLeft,
                          { borderColor: "#4CD964" },
                        ]}
                      />
                      <View
                        style={[
                          styles.corner,
                          styles.topRight,
                          { borderColor: "#4CD964" },
                        ]}
                      />
                      <View
                        style={[
                          styles.corner,
                          styles.bottomLeft,
                          { borderColor: "#4CD964" },
                        ]}
                      />
                      <View
                        style={[
                          styles.corner,
                          styles.bottomRight,
                          { borderColor: "#4CD964" },
                        ]}
                      />
                      <View style={styles.qrGuideTextContainer}>
                        <Text
                          style={[styles.qrGuideText, { color: "#4CD964" }]}
                        >
                          QR DETECTADO
                        </Text>
                      </View>
                    </View>
                    <View style={styles.unfocusedArea} />
                  </View>
                  <View style={styles.unfocusedArea} />
                </View>
              )}

              {/* Camera Shutter / Controls Panel Container */}
              <View
                style={[
                  styles.bottomControlsContainer,
                  { paddingBottom: insets.bottom + 10 },
                ]}
              >
                {/* Horizontal Carousel of Recent Media */}
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
                            const info =
                              await MediaLibrary.getAssetInfoAsync(item);
                            const localUri = info.localUri || info.uri;
                            if (localUri) {
                              Linking.openURL(localUri);
                            }
                          } catch {
                            Alert.alert(
                              "Erro",
                              "Não foi possível abrir a mídia.",
                            );
                          }
                        }}
                      >
                        <Image
                          source={{ uri: item.uri }}
                          style={styles.carouselImage}
                        />
                        {item.mediaType === "video" && (
                          <View style={styles.videoIndicator}>
                            <Text style={styles.videoIndicatorText}>▶</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    )}
                  />
                )}

                {/* Mode selector: Foto / Vídeo */}
                <View style={styles.modeSelector}>
                  <TouchableOpacity
                    onPress={() => {
                      if (!isRecording) setCameraMode("picture");
                    }}
                    style={[
                      styles.modeButton,
                      cameraMode === "picture" && styles.modeButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modeText,
                        cameraMode === "picture" && styles.modeTextActive,
                      ]}
                    >
                      Foto
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      if (!isRecording) setCameraMode("video");
                    }}
                    style={[
                      styles.modeButton,
                      cameraMode === "video" && styles.modeButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modeText,
                        cameraMode === "video" && styles.modeTextActive,
                      ]}
                    >
                      Vídeo
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Shutter / Controls Row */}
                <View style={styles.cameraControlsRow}>
                  {/* Last media thumbnail / Gallery button */}
                  <TouchableOpacity
                    style={styles.galleryButton}
                    onPress={handleOpenGallery}
                  >
                    {lastMediaUri ? (
                      <Image
                        source={{ uri: lastMediaUri }}
                        style={styles.thumbnailImage}
                      />
                    ) : (
                      <View style={styles.galleryPlaceholder}>
                        <MaterialCommunityIcons
                          name="image-outline"
                          size={22}
                          color="#fff"
                        />
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Capture Photo / Record Video Shutter */}
                  <TouchableOpacity
                    onPress={
                      cameraMode === "video"
                        ? handleRecordVideo
                        : handleTakePicture
                    }
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    activeOpacity={1}
                    disabled={loading}
                  >
                    <Animated.View
                      style={[
                        styles.shutterButtonOuter,
                        cameraMode === "video" && {
                          borderColor: colors.danger,
                        },
                        { transform: [{ scale: shutterScale }] },
                      ]}
                    >
                      <View
                        style={[
                          styles.shutterButtonInner,
                          {
                            backgroundColor:
                              cameraMode === "video"
                                ? colors.danger
                                : colors.tint,
                          },
                          isRecording && {
                            borderRadius: 8,
                            transform: [{ scale: 0.65 }],
                          },
                        ]}
                      />
                    </Animated.View>
                  </TouchableOpacity>

                  {/* Flip camera */}
                  <TouchableOpacity
                    style={styles.controlButton}
                    onPress={() =>
                      setFacing((f) => (f === "back" ? "front" : "back"))
                    }
                    disabled={isRecording}
                  >
                    <MaterialCommunityIcons
                      name="refresh"
                      size={22}
                      color="#fff"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </View>
      )}

      {!isScanning && !sessionInfo && (
        /* Manual Code Entry */
        <View style={[styles.content, { paddingBottom: 24 + insets.bottom }]}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name="monitor"
              size={64}
              color={colors.textSecondary}
            />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            Conectar via Código
          </Text>

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Insira o código alfanumérico exibido ao lado do QR Code no site do
            Zapi.
          </Text>

          <TextInput
            style={[
              styles.input,
              {
                borderColor: colors.border,
                color: colors.text,
                backgroundColor: colors.surface,
              },
            ]}
            placeholder="Ex: A8D1F1ABCD1234"
            placeholderTextColor={colors.textSecondary}
            value={manualCode}
            onChangeText={setManualCode}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.tint }]}
            onPress={() => handleVerifyCode(manualCode)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.background }]}>
                Verificar Código
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.switchModeButtonOutline,
              { borderColor: colors.border, marginTop: 16 },
            ]}
            onPress={() => setIsScanning(true)}
          >
            <MaterialCommunityIcons
              name="camera"
              size={18}
              color={colors.text}
              style={{ marginRight: 8 }}
            />
            <Text style={{ color: colors.text, fontWeight: "600" }}>
              Escanear QR Code
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {sessionInfo && (
        /* Confirmation Screen */
        <View style={[styles.content, { paddingBottom: 24 + insets.bottom }]}>
          <View style={styles.confirmationBox}>
            <MaterialCommunityIcons
              name="shield-alert-outline"
              size={64}
              color={colors.badge}
              style={{ marginBottom: 16 }}
            />

            <Text style={[styles.title, { color: colors.text }]}>
              Confirmar login web?
            </Text>

            <View
              style={[
                styles.deviceCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <MaterialCommunityIcons
                name="monitor"
                size={32}
                color={colors.text}
                style={{ marginRight: 16 }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.deviceInfoText,
                    { color: colors.text, fontWeight: "bold" },
                  ]}
                >
                  {sessionInfo.browser || "Navegador Desconhecido"}
                </Text>
                <Text
                  style={[
                    styles.deviceSubtext,
                    { color: colors.textSecondary },
                  ]}
                >
                  Sistema: {sessionInfo.platform || "Sistema Desconhecido"}
                </Text>
                <Text
                  style={[
                    styles.deviceSubtext,
                    { color: colors.textSecondary },
                  ]}
                >
                  IP: {sessionInfo.ip || "127.0.0.1"}
                </Text>
              </View>
            </View>

            <Text style={[styles.warningText, { color: colors.textSecondary }]}>
              Confirme apenas se você solicitou este login no computador
              pessoal. Nunca confirme requisições de terceiros.
            </Text>

            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.cancelButton,
                  { borderColor: colors.danger },
                ]}
                onPress={() => handleConfirm(false)}
                disabled={loading}
              >
                <MaterialCommunityIcons
                  name="close-circle-outline"
                  size={18}
                  color={colors.danger}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[styles.actionButtonText, { color: colors.danger }]}
                >
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.approveButton,
                  { backgroundColor: colors.tint },
                ]}
                onPress={() => handleConfirm(true)}
                disabled={loading}
              >
                <MaterialCommunityIcons
                  name="check-circle-outline"
                  size={18}
                  color={colors.background}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.actionButtonText,
                    { color: colors.background },
                  ]}
                >
                  Confirmar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerAbsolute: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 0,
    backgroundColor: "transparent",
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  customHeader: {
    paddingBottom: 12,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 8,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "500",
    flex: 1,
  },
  scannerContainer: {
    flex: 1,
    position: "relative",
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  unfocusedArea: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  middleRow: {
    height: 250,
    flexDirection: "row",
  },
  focusedTarget: {
    width: 250,
    height: 250,
    position: "relative",
    backgroundColor: "transparent",
  },
  corner: {
    position: "absolute",
    width: 20,
    height: 20,
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scannerInstructions: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: "center",
  },
  scannerInstructionsText: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
    fontWeight: "500",
  },
  switchModeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  switchModeButtonOutline: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 32,
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
    fontWeight: "600",
  },
  button: {
    width: "100%",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  confirmationBox: {
    width: "100%",
    alignItems: "center",
  },
  deviceCard: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 20,
    marginBottom: 20,
  },
  deviceInfoText: {
    fontSize: 16,
  },
  deviceSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  warningText: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 32,
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 8,
  },
  cancelButton: {
    borderWidth: 1,
  },
  approveButton: {},
  actionButtonText: {
    fontSize: 15,
    fontWeight: "bold",
  },
  bottomControlsContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 20,
    backgroundColor: "transparent",
  },
  recentMediaCarousel: {
    maxHeight: 90,
    marginBottom: 20,
  },
  carouselItem: {
    width: 60,
    height: 80,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
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
    transform: [{ translateX: -10 }, { translateY: -10 }],
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  videoIndicatorText: {
    color: "#fff",
    fontSize: 9,
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
  cameraControlsRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  controlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  controlText: {
    color: "#fff",
    fontSize: 9,
    marginTop: 2,
    fontWeight: "bold",
    textAlign: "center",
  },
  shutterButtonOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 6,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },
  shutterButtonInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
  },
  cameraTipContainer: {
    position: "absolute",
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: "center",
    alignItems: "center",
  },
  cameraTipText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  keyboardButton: {
    padding: 8,
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
  qrGuideTextContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  qrGuideText: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 28,
    fontWeight: "bold",
    letterSpacing: 2,
  },
});
