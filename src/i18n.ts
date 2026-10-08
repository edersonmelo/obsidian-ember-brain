import { getLanguage } from "obsidian";

const en = {
  openView: "Open animated graph",
  replayIntro: "Replay intro",
  fullscreen: "Toggle fullscreen",
  hint: "Drag · scroll to zoom · click opens the note · R replays the intro",
  notes: "notes",
  links: "links",
  heatHot: "on fire",
  heatWarm: "warming up",
  heatCold: "cold",
  root: "Root",
  openFailed: "Ember Brain failed to open:",
  rootFolderName: "Root folder",
  rootFolderDesc: "Only notes in this folder are shown, colored by their subfolder. Leave empty for the whole vault.",
  rootFolderPlaceholder: "Example: Notes",
  colorsName: "Folder colors",
  colorsDesc: "One per line, as folder: #rrggbb. Folders without a color get one from the palette.",
  colorsPlaceholder: "Projects: #ff5c7a\nJournal: #4dd0e1",
  introName: "Intro duration (seconds)",
  introDesc: "How long notes take to appear, in creation order.",
  heatSourceName: "Heat source",
  heatSourceDesc: "Notes with a heat property (hot, warm or cold) use it. Otherwise heat comes from the last edit: under a day is hot, under a week is warm.",
};

type Strings = typeof en;

const pt: Strings = {
  openView: "Abrir grafo animado",
  replayIntro: "Repetir a abertura",
  fullscreen: "Alternar tela cheia",
  hint: "Arraste · role para zoom · clique abre a nota · R repete a abertura",
  notes: "notas",
  links: "conexões",
  heatHot: "em brasa",
  heatWarm: "aquecendo",
  heatCold: "fria",
  root: "Raiz",
  openFailed: "Ember Brain falhou ao abrir:",
  rootFolderName: "Pasta raiz",
  rootFolderDesc: "Só as notas desta pasta aparecem, coloridas pela subpasta. Vazio mostra o vault inteiro.",
  rootFolderPlaceholder: "Exemplo: Notas",
  colorsName: "Cores por pasta",
  colorsDesc: "Uma por linha, no formato pasta: #rrggbb. Pastas sem cor recebem uma da paleta.",
  colorsPlaceholder: "Projetos: #ff5c7a\nDiário: #4dd0e1",
  introName: "Duração da abertura (segundos)",
  introDesc: "Tempo para as notas aparecerem, na ordem de criação.",
  heatSourceName: "Origem do calor",
  heatSourceDesc: "Notas com a propriedade heat (hot, warm ou cold) usam esse valor. Sem ela, o calor vem da última edição: menos de um dia é quente, menos de uma semana é morna.",
};

/** Português quando o Obsidian está em português; inglês nos demais idiomas. */
export function t(): Strings {
  // getLanguage() existe a partir do Obsidian 1.8; em versões anteriores, inglês.
  const lang = typeof getLanguage === "function" ? getLanguage() : "en";
  return lang.startsWith("pt") ? pt : en;
}
