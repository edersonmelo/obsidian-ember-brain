import type { TFile } from "obsidian";

/**
 * Heat from how often a note is edited, the same model as obsidian-heatmap:
 * - own = sum of e^(-days/7) over the note's updates in the last 60 days;
 * - score = own + 0.25 × the own of every linked note (links in either direction),
 *   so a hub warms up when the notes around it are edited;
 * - hot: score >= 2 · warm: score >= 0.5 · cold: the rest.
 */
export type Heat = "hot" | "warm" | "cold";

export interface NoteHistory {
  /** Last modification time seen (ms). */
  mtime: number;
  /** Update times (ms), oldest first. */
  updates: number[];
}

export type HeatHistory = Record<string, NoteHistory>;

const DAY = 86400000;
const DECAY_DAYS = 7;
const WINDOW = 60 * DAY;
const NEIGHBOR_WEIGHT = 0.25;
const HOT = 2;
const WARM = 0.5;
/** Saves less than an hour apart count as one update (autosave fires every few seconds). */
const SESSION = 3600000;

export function heatOf(score: number): Heat {
  return score >= HOT ? "hot" : score >= WARM ? "warm" : "cold";
}

export function isHeat(value: unknown): value is Heat {
  return value === "hot" || value === "warm" || value === "cold";
}

/** Keeps the edit history of each note. */
export class HeatTracker {
  constructor(public history: HeatHistory, private onChange: () => void) {}

  /** Records an update if the note's modification time changed. */
  touch(file: TFile, now = Date.now()) {
    if (this.record(file, now)) this.onChange();
  }

  private record(file: TFile, now: number): boolean {
    const mtime = file.stat.mtime;
    const entry = this.history[file.path] ??= { mtime: 0, updates: [] };
    if (Math.abs(mtime - entry.mtime) <= 1000) return false;
    entry.mtime = mtime;
    const last = entry.updates.length - 1;
    if (last >= 0 && mtime - entry.updates[last] < SESSION) entry.updates[last] = mtime;
    else entry.updates.push(mtime);
    entry.updates = entry.updates.filter(u => now - u < WINDOW);
    return true;
  }

  /** Brings the history in line with the vault: new edits, deleted notes, old updates. */
  scan(files: TFile[], now = Date.now()) {
    let changed = false;
    const present = new Set<string>();
    for (const f of files) {
      present.add(f.path);
      const before = this.history[f.path];
      if (this.record(f, now)) changed = true;
      else if (before) {
        const kept = before.updates.filter(u => now - u < WINDOW);
        if (kept.length !== before.updates.length) { before.updates = kept; changed = true; }
      }
    }
    for (const path of Object.keys(this.history)) {
      if (!present.has(path)) { delete this.history[path]; changed = true; }
    }
    if (changed) this.onChange();
  }

  rename(oldPath: string, newPath: string) {
    if (!this.history[oldPath]) return;
    this.history[newPath] = this.history[oldPath];
    delete this.history[oldPath];
    this.onChange();
  }

  remove(path: string) {
    if (!this.history[path]) return;
    delete this.history[path];
    this.onChange();
  }

  /** Heat score of each path in `paths`, counting only links between them. */
  scores(paths: string[], links: Record<string, Record<string, number>>, now = Date.now()): Map<string, number> {
    const own = new Map<string, number>();
    for (const p of paths) {
      let sum = 0;
      for (const u of this.history[p]?.updates ?? []) {
        if (now - u < WINDOW) sum += Math.exp(-(now - u) / DAY / DECAY_DAYS);
      }
      own.set(p, sum);
    }
    const neighbors = new Map<string, Set<string>>();
    const link = (a: string, b: string) => {
      let set = neighbors.get(a);
      if (!set) neighbors.set(a, set = new Set());
      set.add(b);
    };
    for (const src of Object.keys(links)) {
      if (!own.has(src)) continue;
      for (const dst of Object.keys(links[src])) {
        if (dst === src || !own.has(dst)) continue;
        link(src, dst);
        link(dst, src);
      }
    }
    const score = new Map<string, number>();
    for (const p of paths) {
      let s = own.get(p) ?? 0;
      for (const n of neighbors.get(p) ?? []) s += NEIGHBOR_WEIGHT * (own.get(n) ?? 0);
      score.set(p, s);
    }
    return score;
  }
}
