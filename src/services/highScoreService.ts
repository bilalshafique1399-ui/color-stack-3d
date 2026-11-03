export interface HighScoreEntry {
  id: string;
  score: number;
  maxCombo: number;
  timestamp: number;
}

const TOP_SCORES_KEY = 'color_stack_top_scores_v1';
const LEGACY_BEST_KEY = 'color_stack_best_score';
const MAX_ENTRIES = 5;

class HighScoreService {
  public getTopScores(): HighScoreEntry[] {
    try {
      const raw = localStorage.getItem(TOP_SCORES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed
            .filter(
              (item): item is HighScoreEntry =>
                typeof item === 'object' &&
                item !== null &&
                typeof item.id === 'string' &&
                typeof item.score === 'number' &&
                item.score > 0,
            )
            .sort((a, b) => b.score - a.score || b.maxCombo - a.maxCombo || b.timestamp - a.timestamp)
            .slice(0, MAX_ENTRIES);
        }
      }

      // Migrate single legacy best score if present
      const legacyBestRaw = localStorage.getItem(LEGACY_BEST_KEY);
      const legacyBest = legacyBestRaw ? parseInt(legacyBestRaw, 10) : 0;
      if (legacyBest > 0) {
        const migrated: HighScoreEntry[] = [
          {
            id: 'migrated-best',
            score: legacyBest,
            maxCombo: 0,
            timestamp: Date.now(),
          },
        ];
        this.saveEntries(migrated);
        return migrated;
      }
    } catch {
      // Ignore storage access errors
    }
    return [];
  }

  public getBestScore(): number {
    const scores = this.getTopScores();
    return scores.length > 0 ? scores[0].score : 0;
  }

  /**
   * Saves a completed game score into the Top 5 leaderboard if eligible.
   * Returns the updated Top 5 array and the created entry ID (if it placed in Top 5).
   */
  public recordScore(
    score: number,
    maxCombo: number,
  ): { topScores: HighScoreEntry[]; placedEntryId: string | null } {
    const existing = this.getTopScores();
    if (score <= 0) {
      return { topScores: existing, placedEntryId: null };
    }

    const newEntry: HighScoreEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      score,
      maxCombo,
      timestamp: Date.now(),
    };

    const combined = [...existing, newEntry]
      .sort((a, b) => b.score - a.score || b.maxCombo - a.maxCombo || b.timestamp - a.timestamp)
      .slice(0, MAX_ENTRIES);

    this.saveEntries(combined);

    const placed = combined.some((item) => item.id === newEntry.id);
    return {
      topScores: combined,
      placedEntryId: placed ? newEntry.id : null,
    };
  }

  private saveEntries(entries: HighScoreEntry[]): void {
    try {
      localStorage.setItem(TOP_SCORES_KEY, JSON.stringify(entries));
      if (entries.length > 0) {
        localStorage.setItem(LEGACY_BEST_KEY, String(entries[0].score));
      }
    } catch {
      // Ignore storage quota / privacy mode errors
    }
  }
}

export const highScoreService = new HighScoreService();

export function formatScoreDate(timestamp: number): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const isSameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    if (isSameDay) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}
