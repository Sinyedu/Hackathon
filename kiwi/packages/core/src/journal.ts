import type { ActionJournal, JournalEntry } from './ports';

export function createJournal(): ActionJournal {
  const entries: JournalEntry[] = [];
  return {
    record: (entry) => entries.push({ ...entry, undone: false }),
    last: () => entries.filter((entry) => !entry.undone).at(-1),
    markUndone(id) {
      const entry = entries.find((candidate) => candidate.id === id);
      if (entry) entry.undone = true;
    },
  };
}
