import React from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export default function MyQrScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  if (!user) return null;

  const qrValue = `zapi://user/${user.user_id}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrValue)}`;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={[styles.backBtn, { top: insets.top + 16 }]}
      >
        <Ionicons name="chevron-back-outline" size={24} color={colors.text} />
      </TouchableOpacity>

      <Text style={[styles.title, { color: colors.text }]}>Meu QR Code</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Peça para outro usuário escanear para te adicionar aos contatos
        instantaneamente
      </Text>

      <View style={styles.qrContainer}>
        <Image source={{ uri: qrCodeUrl }} style={styles.qrImage} />
      </View>

      <Text style={[styles.username, { color: colors.text }]}>
        @{user.username}
      </Text>
      <Text style={[styles.email, { color: colors.textSecondary }]}>
        {user.email}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  backBtn: {
    position: "absolute",
    left: 20,
    padding: 8,
    borderRadius: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 40,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  qrContainer: {
    padding: 20,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  qrImage: {
    width: 240,
    height: 240,
  },
  username: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 24,
  },
  email: {
    fontSize: 14,
    marginTop: 4,
  },
});
