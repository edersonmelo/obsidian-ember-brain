import { App, normalizePath, Plugin, PluginSettingTab, Setting } from "obsidian";
import { t } from "./i18n";
import { EmberBrainView, VIEW_TYPE_EMBER } from "./view";

export interface EmberBrainSettings {
  /** Only notes in this folder are shown (empty = whole vault). Colors are per subfolder of it. */
  rootFolder: string;
  /** One per line: "Folder: #rrggbb". */
  groupColors: string;
  introSeconds: number;
}

const DEFAULT_SETTINGS: EmberBrainSettings = {
  rootFolder: "",
  groupColors: "",
  introSeconds: 14,
};

export default class EmberBrainPlugin extends Plugin {
  settings: EmberBrainSettings = { ...DEFAULT_SETTINGS };

  async onload() {
    await this.loadSettings();
    this.registerView(VIEW_TYPE_EMBER, leaf => new EmberBrainView(leaf, this));
    this.addRibbonIcon("flame", t().openView, () => void this.openView());
    this.addCommand({ id: "open-view", name: t().openView, callback: () => void this.openView() });
    this.addSettingTab(new EmberBrainSettingTab(this.app, this));
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

  async loadSettings() {
    const saved = (await this.loadData()) as Partial<EmberBrainSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...saved };
  }

  async saveSettings() {
    await this.saveData(this.settings);
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_EMBER)) {
      if (leaf.view instanceof EmberBrainView) leaf.view.refresh();
    }
  }
}

type SettingKey = keyof EmberBrainSettings;

/** Minimal local typing of the declarative settings API (Obsidian 1.13+), so we keep building against older typings. */
type SettingControlDef =
  | { type: "folder"; key: SettingKey; placeholder?: string; includeRoot?: boolean }
  | { type: "textarea"; key: SettingKey; placeholder?: string; rows?: number }
  | { type: "slider"; key: SettingKey; min: number; max: number; step: number };
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
  }
}
