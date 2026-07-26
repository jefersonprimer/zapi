import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { addContact, createChat } from "@/services/api";
import { ArrowLeft } from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ScanQrScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  if (!permission) {
    return (
      <View
        style={[styles.centerContainer, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View
        style={[
          styles.centerContainer,
          { backgroundColor: colors.background, padding: 24 },
        ]}
      >
        <Text style={[styles.permissionText, { color: colors.text }]}>
          Precisamos de acesso à câmera para escanear o QR Code de um contato.
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.tint }]}
          onPress={requestPermission}
        >
          <Text style={styles.buttonText}>Conceder Permissão</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned || loading || !token) return;

    const isContactQr =
      data.startsWith("zapi://user/") ||
      data.startsWith("zapi://contact/") ||
      data.startsWith("zapi:user_id:");
    if (isContactQr) {
      setScanned(true);
      setLoading(true);
      const contactId = data
        .replace("zapi://user/", "")
        .replace("zapi://contact/", "")
        .replace("zapi:user_id:", "");

      try {
        // 1. Add contact
        await addContact(token, contactId);

        // 2. Open chat
        const chatData = await createChat(token, contactId);

        Alert.alert("Sucesso", "Contato adicionado com sucesso!", [
          {
            text: "Ir para Conversa",
            onPress: () => {
              router.replace({
                pathname: "/chat",
                params: {
                  chatId: chatData.id,
                  participantId: contactId,
                },
              });
            },
          },
        ]);
      } catch (err: any) {
        Alert.alert(
          "Erro",
          err.message || "Não foi possível adicionar o contato.",
        );
        setScanned(false);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { top: insets.top + 16 }]}
          >
            <ArrowLeft size={28} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.scanTarget} />

          <Text style={styles.scanText}>
            Aponte a câmera para o QR Code do contato
          </Text>

          {loading && (
            <ActivityIndicator
              size="large"
              color="#ffffff"
              style={{ marginTop: 20 }}
            />
          )}
        </View>
      </CameraView>
    </View>
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
  permissionText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 16,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  backBtn: {
    position: "absolute",
    left: 20,
    padding: 8,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: 20,
  },
  scanTarget: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: "#007AFF",
    borderRadius: 24,
    backgroundColor: "transparent",
  },
  scanText: {
    color: "#ffffff",
    marginTop: 28,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 40,
    lineHeight: 22,
  },
});
