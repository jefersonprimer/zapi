import { View, Text, StyleSheet } from "react-native";
import { Users2 } from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";

export default function CommunitiesScreen() {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.headerTitle, { color: colors.text }]}>Comunidades</Text>
      <View style={styles.content}>
        <Users2 size={56} color={colors.tint} style={{ marginBottom: 20 }} />
        <Text style={[styles.title, { color: colors.text }]}>Crie e participe de comunidades</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Junte pessoas com interesses em comum em um só lugar. Organize seus subgrupos e melhore a comunicação.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 40,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    paddingHorizontal: 20,
    marginVertical: 16,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});
