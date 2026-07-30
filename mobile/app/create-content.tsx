import { useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/context/ThemeContext";

const OPTIONS = [
  {
    icon: "movie-outline" as const,
    label: "Clip",
    description: "Compartilhe um vídeo curto",
    color: "#FF9500",
    route: "/create-clip" as const,
    params: undefined,
  },
  {
    icon: "camera-outline" as const,
    label: "Status",
    description: "Atualize seu status por 24h",
    color: "#07C160",
    route: "/create-story" as const,
    params: undefined,
  },
  {
    icon: "file-document-outline" as const,
    label: "Post",
    description: "Compartilhe uma ideia ou foto",
    color: "#007AFF",
    route: "/create-post" as const,
    params: undefined,
  },
] as const;

export default function CreateContentScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleOptionPress = useCallback(
    (route: string, params?: Record<string, unknown>) => {
      if (params) {
        router.replace({ pathname: route as any, params: params as any });
      } else {
        router.replace(route as any);
      }
    },
    [router],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Criar conteúdo
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          O que você quer criar?
        </Text>

        {OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.label}
            style={[styles.option, { backgroundColor: colors.surface, borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => handleOptionPress(option.route, option.params as Record<string, unknown> | undefined)}
          >
            <View style={[styles.iconContainer, { backgroundColor: option.color + "18" }]}>
              <MaterialCommunityIcons name={option.icon} size={28} color={option.color} />
            </View>
            <View style={styles.optionText}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>
                {option.label}
              </Text>
              <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                {option.description}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 24,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  optionText: {
    marginLeft: 14,
    flex: 1,
  },
  optionLabel: {
    fontSize: 17,
    fontWeight: "600",
  },
  optionDescription: {
    fontSize: 14,
    marginTop: 2,
  },
});
