import { View, Text, StyleSheet } from "react-native";
import { Users2 } from "lucide-react-native";

export default function CommunitiesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Comunidades</Text>
      <View style={styles.content}>
        <Users2 size={48} color="#007AFF" style={{ marginBottom: 16 }} />
        <Text style={styles.title}>Crie e participe de comunidades</Text>
        <Text style={styles.description}>
          Junte pessoas com interesses em comum em um só lugar. Organize seus subgrupos e melhore a comunicação.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    paddingHorizontal: 16,
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
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: "#8e8e93",
    textAlign: "center",
    lineHeight: 20,
  },
});
