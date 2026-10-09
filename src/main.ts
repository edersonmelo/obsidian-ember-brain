import { App, debounce, normalizePath, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";
import { Heat, HeatHistory, heatOf, HeatTracker, isHeat } from "./heat";
import { t } from "./i18n";
import { EmberBrainView, VIEW_TYPE_EMBER } from "./view";

export interface EmberBrainSettings {
  /** Only notes in this folder are shown (empty = whole vault). Colors are per subfolder of it. */
  rootFolder: string;
  /** One per line: "Folder: #rrggbb". */
  groupColors: string;
  introSeconds: number;
  /** Notes with a heat property (hot, warm or cold) use it instead of the edit history. */
  useHeatProperty: boolean;
  /** Writes the heat from the edit history to each note's heat property, keeping its modification time. */
  writeHeatProperty: boolean;
}

const DEFAULT_SETTINGS: EmberBrainSettings = {
  rootFolder: "",
  groupColors: "",
  introSeconds: 14,
  useHeatProperty: true,
  writeHeatProperty: false,
};

/** What is saved in data.json: the settings plus the edit history. */
interface SavedData extends Partial<EmberBrainSettings> { history?: HeatHistory }

export interface NoteHeat { heat: Heat; score: number }

const HOUR = 3600000;

export default class EmberBrainPlugin extends Plugin {
  settings: EmberBrainSettings = { ...DEFAULT_SETTINGS };
  tracker = new HeatTracker({}, () => this.saveLater());
  private saveLater = debounce(() => void this.persist(), 10000, true);
  private writing = false;

  async onload() {
    await this.loadSettings();
    this.registerView(VIEW_TYPE_EMBER, leaf => new EmberBrainView(leaf, this));
    this.addRibbonIcon("flame", t().openView, () => void this.openView());
    this.addCommand({ id: "open-view", name: t().openView, callback: () => void this.openView() });
    this.addSettingTab(new EmberBrainSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      this.tracker.scan(this.app.vault.getMarkdownFiles());
      this.registerEvent(this.app.vault.on("create", f => { if (isNote(f)) this.tracker.touch(f); }));
      this.registerEvent(this.app.vault.on("modify", f => { if (isNote(f)) this.tracker.touch(f); }));
      this.registerEvent(this.app.vault.on("rename", (f, oldPath) => this.tracker.rename(oldPath, f.path)));
      this.registerEvent(this.app.vault.on("delete", f => this.tracker.remove(f.path)));
      void this.writeHeat();
      // Heat cools down without edits: recompute every hour.
      this.registerInterval(window.setInterval(() => {
        this.refreshViews();
        void this.writeHeat();
      }, HOUR));
    });
  }

  onunload() {
    this.saveLater.cancel();
    void this.persist();
  }

  async openView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_EMBER)[0];
    if (!leaf) {
      leaf = workspace.getLeaf("tab");
      await leaf.setViewState({ type: VIEW_TYPE_EMBER, active: true });
    }
    await workspace.revealLeaf(leaf);
  }

  /** The root folder as a normalized vault path ("" = whole vault). */
  rootFolder(): string {
    const raw = this.settings.rootFolder.trim();
    return raw ? normalizePath(raw).replace(/^\/+|\/+$/g, "") : "";
  }

  /** Markdown notes shown by the plugin: the root folder, or the whole vault. */
  notes(): TFile[] {
    const root = this.rootFolder();
    return this.app.vault.getMarkdownFiles().filter(f => !root || f.path.startsWith(root + "/"));
  }

  /** Heat of each note, from its heat property or its edit history (see heat.ts). */
  heatOf(files: TFile[]): Map<string, NoteHeat> {
    const scores = this.tracker.scores(files.map(f => f.path), this.app.metadataCache.resolvedLinks);
    const useProperty = this.settings.useHeatProperty && !this.settings.writeHeatProperty;
    const result = new Map<string, NoteHeat>();
    for (const f of files) {
      const score = scores.get(f.path) ?? 0;
      const property: unknown = this.app.metadataCache.getFileCache(f)?.frontmatter?.["heat"];
      result.set(f.path, { heat: useProperty && isHeat(property) ? property : heatOf(score), score });
    }
    return result;
  }

  /** With "write heat property" on, keeps each note's heat property up to date. */
  async writeHeat() {
    if (!this.settings.writeHeatProperty || this.writing) return;
    this.writing = true;
    try {
      const files = this.notes();
      const heats = this.heatOf(files);
      for (const f of files) {
        const heat = heats.get(f.path)?.heat;
        if (!heat || this.app.metadataCache.getFileCache(f)?.frontmatter?.["heat"] === heat) continue;
        // Keeping mtime means this write is not counted as an edit.
        await this.app.fileManager.processFrontMatter(f, (fm: Record<string, unknown>) => { fm["heat"] = heat; },
          { mtime: f.stat.mtime, ctime: f.stat.ctime });
      }
    } catch (e) {
      console.error("Ember Brain: failed to write heat", e);
    } finally {
      this.writing = false;
    }
  }

  async loadSettings() {
    const saved = (await this.loadData()) as SavedData | null;
    const { history, ...settings } = saved ?? {};
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.tracker.history = history ?? {};
  }

  async saveSettings() {
    await this.persist();
    this.refreshViews();
    void this.writeHeat();
  }

  private async persist() {
    const data: SavedData = { ...this.settings, history: this.tracker.history };
    await this.saveData(data);
  }

  private refreshViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_EMBER)) {
      if (leaf.view instanceof EmberBrainView) leaf.view.refresh();
    }
  }
}

function isNote(f: unknown): f is TFile {
  return f instanceof TFile && f.extension === "md";
}

type SettingKey = keyof EmberBrainSettings;

/** Minimal local typing of the declarative settings API (Obsidian 1.13+), so we keep building against older typings. */
type SettingControlDef =
  | { type: "folder"; key: SettingKey; placeholder?: string; includeRoot?: boolean }
  | { type: "textarea"; key: SettingKey; placeholder?: string; rows?: number }
  | { type: "slider"; key: SettingKey; min: number; max: number; step: number }
  | { type: "toggle"; key: SettingKey };
interface SettingDef { name: string; desc?: string; control?: SettingControlDef }

class EmberBrainSettingTab extends PluginSettingTab {
  plugin: EmberBrainPlugin;

  constructor(app: App, plugin: EmberBrainPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /** Obsidian 1.13+: declarative settings, which also show up in settings search. */
  getSettingDefinitions(): SettingDef[] {
    const s = t();
    return [
      { name: s.rootFolderName, desc: s.rootFolderDesc,
        control: { type: "folder", key: "rootFolder", placeholder: s.rootFolderPlaceholder, includeRoot: true } },
      { name: s.colorsName, desc: s.colorsDesc,
        control: { type: "textarea", key: "groupColors", placeholder: s.colorsPlaceholder, rows: 6 } },
      { name: s.introName, desc: s.introDesc,
        control: { type: "slider", key: "introSeconds", min: 3, max: 40, step: 1 } },
      { name: s.heatSourceName, desc: s.heatSourceDesc },
      { name: s.usePropertyName, desc: s.usePropertyDesc, control: { type: "toggle", key: "useHeatProperty" } },
      { name: s.writePropertyName, desc: s.writePropertyDesc, control: { type: "toggle", key: "writeHeatProperty" } },
    ];
  }

  getControlValue(key: string): unknown {
    return this.plugin.settings[key as SettingKey];
  }

  async setControlValue(key: string, value: unknown) {
    const settings = this.plugin.settings as unknown as Record<string, unknown>;
    settings[key] = value;
    await this.plugin.saveSettings();
  }

  /** Obsidian before 1.13: classic settings UI. */
  display() {
    const { containerEl } = this;
    const s = t();
    containerEl.empty();

    new Setting(containerEl)
      .setName(s.rootFolderName)
      .setDesc(s.rootFolderDesc)
      .addText(text => text
        .setPlaceholder(s.rootFolderPlaceholder)
        .setValue(this.plugin.settings.rootFolder)
        .onChange(async value => {
          this.plugin.settings.rootFolder = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(s.colorsName)
      .setDesc(s.colorsDesc)
      .addTextArea(text => {
        text
          .setPlaceholder(s.colorsPlaceholder)
          .setValue(this.plugin.settings.groupColors)
          .onChange(async value => {
            this.plugin.settings.groupColors = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 6;
      });

    new Setting(containerEl)
      .setName(s.introName)
      .setDesc(s.introDesc)
      .addSlider(slider => slider
        .setLimits(3, 40, 1)
        .setValue(this.plugin.settings.introSeconds)
        .setDynamicTooltip()
        .onChange(async value => {
          this.plugin.settings.introSeconds = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(s.heatSourceName)
      .setDesc(s.heatSourceDesc);

    new Setting(containerEl)
      .setName(s.usePropertyName)
      .setDesc(s.usePropertyDesc)
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useHeatProperty)
        .onChange(async value => {
          this.plugin.settings.useHeatProperty = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(s.writePropertyName)
      .setDesc(s.writePropertyDesc)
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.writeHeatProperty)
        .onChange(async value => {
          this.plugin.settings.writeHeatProperty = value;
          await this.plugin.saveSettings();
        }));
  }
}
