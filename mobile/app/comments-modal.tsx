import { View, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import CommentsModal from "@/components/CommentsModal";

export default function CommentsModalScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const router = useRouter();

  if (!postId) return null;

  return (
    <View style={styles.container}>
      <CommentsModal
        postId={postId}
        visible={true}
        onClose={() => router.back()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
