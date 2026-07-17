import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";
import PostHeader from "./PostHeader";
import PostActions from "./PostActions";
import AttachmentGrid from "./AttachmentGrid";
import PollCard from "./PollCard";
import type { FeedPost as FeedPostType } from "@/services/updatesApi";

interface FeedPostProps {
  post: FeedPostType;
  onHeaderPress: () => void;
  onMenuPress: () => void;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
  onVote: (optionId: string) => void;
}

export default function FeedPost({
  post,
  onHeaderPress,
  onMenuPress,
  onLike,
  onComment,
  onShare,
  onSave,
  onVote,
}: FeedPostProps) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.card, { borderBottomColor: colors.border }]}>
      <PostHeader
        publisherName={post.publisher_name}
        publisherAvatar={post.publisher_avatar}
        publisherType={post.publisher_type}
        isVerified={post.is_verified}
        createdAt={post.created_at}
        onPress={onHeaderPress}
        onMenuPress={onMenuPress}
      />
      {post.content && (
        <Text style={[styles.content, { color: colors.text }]}>{post.content}</Text>
      )}
      {post.poll_options && post.poll_options.length > 0 && (
        <PollCard options={post.poll_options} votedOption={post.voted_option} onVote={onVote} />
      )}
      <AttachmentGrid attachments={post.attachments} />
      <PostActions
        liked={post.liked_by_me}
        likesCount={post.likes_count}
        commentsCount={post.comments_count}
        saved={post.saved_by_me}
        onLike={onLike}
        onComment={onComment}
        onShare={onShare}
        onSave={onSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: {
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
});
