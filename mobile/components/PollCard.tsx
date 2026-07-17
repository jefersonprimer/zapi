import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";
import type { PollOption } from "@/services/updatesApi";

interface PollCardProps {
  options: PollOption[];
  votedOption: string | null;
  onVote: (optionId: string) => void;
}

export default function PollCard({ options, votedOption, onVote }: PollCardProps) {
  const { colors } = useAppTheme();

  const totalVotes = options.reduce((sum, o) => sum + o.votes_count, 0);

  if (votedOption) {
    return (
      <View style={styles.container}>
        {options.map((option) => (
          <View
            key={option.id}
            style={[
              styles.optionBar,
              { backgroundColor: colors.surface, borderColor: colors.border },
              option.id === votedOption && { borderColor: colors.tint },
            ]}
          >
            <View
              style={[
                styles.fill,
                {
                  width: `${option.percentage}%` as any,
                  backgroundColor: option.id === votedOption ? colors.tint : colors.border,
                },
              ]}
            />
            <View style={styles.optionContent}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
              <Text style={[styles.optionPct, { color: colors.textSecondary }]}>
                {Math.round(option.percentage)}%
              </Text>
            </View>
          </View>
        ))}
        <Text style={[styles.totalVotes, { color: colors.textSecondary }]}>
          {totalVotes} voto{totalVotes !== 1 ? "s" : ""}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {options.map((option) => (
        <TouchableOpacity
          key={option.id}
          style={[styles.voteButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={() => onVote(option.id)}
        >
          <Text style={[styles.voteLabel, { color: colors.text }]}>{option.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  optionBar: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "center",
  },
  fill: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: 7,
    opacity: 0.3,
  },
  optionContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  optionPct: {
    fontSize: 14,
    fontWeight: "600",
  },
  totalVotes: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
  voteButton: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  voteLabel: {
    fontSize: 14,
  },
});
