import React, { useState } from "react";
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
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { API_URL } from "@/services/api";
import { CameraView, useCameraPermissions } from "expo-camera";
import { ArrowLeft, Monitor, ShieldAlert, CheckCircle2, XCircle, Keyboard, Camera } from "lucide-react-native";

export default function LinkDeviceScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { colors } = useAppTheme();

  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [manualCode, setManualCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<any | null>(null);

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
      Alert.alert("Erro", err.message || "Não foi possível verificar a sessão.");
      setSessionInfo(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleBarcodeScanned({ data }: { data: string }) {
    if (loading || sessionInfo) return;
    const code = extractSessionCode(data);
    if (code) {
      await handleVerifyCode(code);
    }
  }

  async function handleConfirm(approve: boolean) {
    if (!sessionInfo || !token) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/web/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
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
          { text: "OK", onPress: () => router.back() }
        ]);
      } else {
        Alert.alert("Cancelado", "Login cancelado.", [
          { text: "OK", onPress: () => router.back() }
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
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (isScanning && permission && !permission.granted) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background, padding: 24 }]}>
        <Camera size={48} color={colors.textSecondary} style={{ marginBottom: 16 }} />
        <Text style={[styles.title, { color: colors.text }]}>Permissão de Câmera</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Precisamos de acesso à câmera para escanear o QR Code no site web.
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.tint, marginTop: 16 }]}
          onPress={requestPermission}
        >
          <Text style={[styles.buttonText, { color: colors.background }]}>Conceder Permissão</Text>
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
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Conectar Aparelho
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {isScanning && (
        /* Camera Scanner View */
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            onBarcodeScanned={handleBarcodeScanned}
          />
          {/* Scanning Reticle overlay */}
          <View style={styles.overlayContainer}>
            <View style={styles.unfocusedArea} />
            <View style={styles.middleRow}>
              <View style={styles.unfocusedArea} />
              <View style={[styles.focusedTarget, { borderColor: colors.badge }]}>
                <View style={[styles.corner, styles.topLeft, { borderColor: colors.badge }]} />
                <View style={[styles.corner, styles.topRight, { borderColor: colors.badge }]} />
                <View style={[styles.corner, styles.bottomLeft, { borderColor: colors.badge }]} />
                <View style={[styles.corner, styles.bottomRight, { borderColor: colors.badge }]} />
              </View>
              <View style={styles.unfocusedArea} />
            </View>
            <View style={styles.unfocusedArea} />
          </View>

          <View style={styles.scannerInstructions}>
            <Text style={styles.scannerInstructionsText}>
              Aponte a câmera para o QR Code na tela do Zapi Web
            </Text>
            <TouchableOpacity
              style={[styles.switchModeButton, { backgroundColor: colors.surface }]}
              onPress={() => setIsScanning(false)}
            >
              <Keyboard size={18} color={colors.text} style={{ marginRight: 8 }} />
              <Text style={{ color: colors.text, fontWeight: "600", fontSize: 14 }}>
                Digitar código manualmente
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!isScanning && !sessionInfo && (
        /* Manual Code Entry */
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Monitor size={64} color={colors.textSecondary} />
          </View>
          
          <Text style={[styles.title, { color: colors.text }]}>
            Conectar via Código
          </Text>
          
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Insira o código alfanumérico exibido ao lado do QR Code no site do Zapi.
          </Text>

          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
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
            style={[styles.switchModeButtonOutline, { borderColor: colors.border, marginTop: 16 }]}
            onPress={() => setIsScanning(true)}
          >
            <Camera size={18} color={colors.text} style={{ marginRight: 8 }} />
            <Text style={{ color: colors.text, fontWeight: "600" }}>
              Escanear QR Code
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {sessionInfo && (
        /* Confirmation Screen */
        <View style={styles.content}>
          <View style={styles.confirmationBox}>
            <ShieldAlert size={64} color={colors.badge} style={{ marginBottom: 16 }} />
            
            <Text style={[styles.title, { color: colors.text }]}>
              Confirmar login web?
            </Text>

            <View style={[styles.deviceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Monitor size={32} color={colors.text} style={{ marginRight: 16 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.deviceInfoText, { color: colors.text, fontWeight: "bold" }]}>
                  {sessionInfo.browser || "Navegador Desconhecido"}
                </Text>
                <Text style={[styles.deviceSubtext, { color: colors.textSecondary }]}>
                  Sistema: {sessionInfo.platform || "Sistema Desconhecido"}
                </Text>
                <Text style={[styles.deviceSubtext, { color: colors.textSecondary }]}>
                  IP: {sessionInfo.ip || "127.0.0.1"}
                </Text>
              </View>
            </View>

            <Text style={[styles.warningText, { color: colors.textSecondary }]}>
              Confirme apenas se você solicitou este login no computador pessoal. Nunca confirme requisições de terceiros.
            </Text>

            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton, { borderColor: colors.danger }]}
                onPress={() => handleConfirm(false)}
                disabled={loading}
              >
                <XCircle size={18} color={colors.danger} style={{ marginRight: 6 }} />
                <Text style={[styles.actionButtonText, { color: colors.danger }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.approveButton, { backgroundColor: colors.tint }]}
                onPress={() => handleConfirm(true)}
                disabled={loading}
              >
                <CheckCircle2 size={18} color={colors.background} style={{ marginRight: 6 }} />
                <Text style={[styles.actionButtonText, { color: colors.background }]}>
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
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
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
});
