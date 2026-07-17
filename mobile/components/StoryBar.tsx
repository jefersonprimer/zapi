import { FlatList, View, StyleSheet } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";
import MyStoryItem from "./MyStoryItem";
import StoryItem from "./StoryItem";
import type { StoryGroup } from "@/services/updatesApi";

interface StoryBarProps {
  myAvatarUrl: string | null;
  groups: StoryGroup[];
  onMyStoryPress: () => void;
  onStoryPress: (group: StoryGroup) => void;
}

export default function StoryBar({ myAvatarUrl, groups, onMyStoryPress, onStoryPress }: StoryBarProps) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.container, { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        data={groups}
        keyExtractor={(item) => item.publisher_id}
        ListHeaderComponent={<MyStoryItem avatarUrl={myAvatarUrl} onPress={onMyStoryPress} />}
        renderItem={({ item }) => (
          <StoryItem
            name={item.publisher_name}
            avatarUrl={item.publisher_avatar}
            isVerified={item.is_verified}
            viewed={item.all_viewed}
            onPress={() => onStoryPress(item)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  content: {
    paddingHorizontal: 16,
  },
});
