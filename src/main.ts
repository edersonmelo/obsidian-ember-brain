import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from "obsidian";
import { EmberBrainView, VIEW_TYPE_EMBER } from "./view";

export interface EmberBrainSettings {
  /** Só esta pasta entra no grafo (vazio = vault inteiro). As cores são por subpasta dela. */
  rootFolder: string;
  /** Uma por linha: "Pasta: #rrggbb". */
  groupColors: string;
  introSeconds: number;
}

const DEFAULT_SETTINGS: EmberBrainSettings = {
  rootFolder: "",
  groupColors: "",
  introSeconds: 14,
};

export default class EmberBrainPlugin extends Plugin {
  settings: EmberBrainSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();
    this.registerView(VIEW_TYPE_EMBER, leaf => new EmberBrainView(leaf, this));
    this.addRibbonIcon("flame", "Abrir Ember Brain", () => this.openView());
    this.addCommand({ id: "open", name: "Abrir Ember Brain", callback: () => this.openView() });
    this.addSettingTab(new EmberBrainSettingTab(this.app, this));
  }

  async openView() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_EMBER)[0];
    const leaf: WorkspaceLeaf = existing ?? this.app.workspace.getLeaf("tab");
    if (!existing) await leaf.setViewState({ type: VIEW_TYPE_EMBER, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_EMBER)) {
      (leaf.view as EmberBrainView).refresh();
    }
  }
}

class EmberBrainSettingTab extends PluginSettingTab {
  plugin: EmberBrainPlugin;

  constructor(app: App, plugin: EmberBrainPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("p", {
      text: "Notas com a propriedade heat: hot | warm | cold (ex.: geradas pelo obsidian-heatmap) usam esse calor. " +
        "Sem ela, o calor vem da última modificação: menos de 1 dia = em brasa, menos de 7 dias = aquecendo.",
    });

    new Setting(containerEl)
      .setName("Pasta raiz")
      .setDesc("Só as notas desta pasta entram no grafo, e as cores são por subpasta dela. Vazio = vault inteiro.")
      .addText(t => t.setPlaceholder("ex.: edersonmelo").setValue(this.plugin.settings.rootFolder)
        .onChange(async v => { this.plugin.settings.rootFolder = v.trim(); await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName("Cores por pasta")
      .setDesc("Uma por linha, no formato Pasta: #rrggbb. As pastas sem cor recebem cores da paleta.")
      .addTextArea(t => {
        t.setPlaceholder("Notion: #dfe6f5\n02 Projetos: #ff5c7a").setValue(this.plugin.settings.groupColors)
          .onChange(async v => { this.plugin.settings.groupColors = v; await this.plugin.saveSettings(); });
        t.inputEl.rows = 6;
      });

    new Setting(containerEl)
      .setName("Duração da abertura (segundos)")
      .setDesc("Tempo em que as notas vão nascendo na ordem de criação.")
      .addSlider(s => s.setLimits(3, 40, 1).setValue(this.plugin.settings.introSeconds).setDynamicTooltip()
        .onChange(async v => { this.plugin.settings.introSeconds = v; await this.plugin.saveSettings(); }));
  }
}
