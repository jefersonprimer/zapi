import { View, Text, StyleSheet } from "react-native";
import { Sparkles } from "lucide-react-native";

export default function UpdatesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Atualizações</Text>
      <View style={styles.content}>
        <Sparkles size={48} color="#007AFF" style={{ marginBottom: 16 }} />
        <Text style={styles.title}>Fique por dentro das novidades</Text>
        <Text style={styles.description}>
          Em breve você poderá ver atualizações de status, canais e stories de seus contatos diretamente aqui.
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
