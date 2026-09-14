// Single source of truth for all optional/toggleable NovelTribe features.
// Stored as one jsonb column (profiles.feature_flags) so new toggles never require a migration.

export const FEATURE_FLAG_KEYS = [
  "mood_tags",
  "quote_capture",
  "milestones",
  "format_stats",
  "reading_reminders",
  "reading_sessions",
  "show_stats_widgets",
  "show_session_timeline",
  "reading_velocity",
  "audiobook_format",
  "strict_peer_genre_match",
  "reading_goals",
  "custom_shelves",
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  mood_tags: false,
  quote_capture: false,
  milestones: false,
  format_stats: false,
  reading_reminders: false,
  reading_sessions: false,
  show_stats_widgets: true,
  show_session_timeline: false,
  reading_velocity: false,
  audiobook_format: false,
  strict_peer_genre_match: false,
  reading_goals: false,
  custom_shelves: false,
};

export const MOOD_TAGS = [
  "Cozy",
  "Dark",
  "Fast-paced",
  "Slow burn",
  "Thought-provoking",
  "Heartwarming",
  "Tense",
  "Funny",
  "Bittersweet",
  "Atmospheric",
] as const;

export type MoodTag = (typeof MOOD_TAGS)[number];

/** Merges stored flags with defaults so newly added features are safely off until a user opts in. */
export function resolveFeatureFlags(stored: Partial<FeatureFlags> | null | undefined): FeatureFlags {
  return { ...DEFAULT_FEATURE_FLAGS, ...(stored ?? {}) };
}

export function isFeatureEnabled(stored: Partial<FeatureFlags> | null | undefined, key: FeatureFlagKey): boolean {
  return resolveFeatureFlags(stored)[key];
}
