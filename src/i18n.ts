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
  heatSourceDesc: "Heat comes from how often you edit a note in the last 60 days, and from edits to the notes linked to it. Ember Brain keeps this history from the day you install it.",
  usePropertyName: "Use the heat property",
  usePropertyDesc: "Notes with a heat property (hot, warm or cold) use it instead of the edit history. Turn off to ignore heat properties set by hand or by other tools.",
  writePropertyName: "Write the heat property",
  writePropertyDesc: "Writes the heat from the edit history to each note's heat property, every hour, so you can use it in the core graph view groups or in searches. It keeps the note's modification date. Turning it off leaves the existing properties in place.",
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
  heatSourceDesc: "O calor vem de quantas vezes você editou a nota nos últimos 60 dias e das edições nas notas ligadas a ela. O Ember Brain guarda esse histórico a partir do dia em que é instalado.",
  usePropertyName: "Usar a propriedade heat",
  usePropertyDesc: "Notas com a propriedade heat (hot, warm ou cold) usam esse valor em vez do histórico de edições. Desligue para ignorar propriedades heat definidas à mão ou por outras ferramentas.",
  writePropertyName: "Gravar a propriedade heat",
  writePropertyDesc: "Grava o calor do histórico de edições na propriedade heat de cada nota, de hora em hora, para usar nos grupos do grafo nativo ou em buscas. A data de modificação da nota é mantida. Ao desligar, as propriedades já gravadas continuam nas notas.",
};

/** Português quando o Obsidian está em português; inglês nos demais idiomas. */
export function t(): Strings {
  // getLanguage() existe a partir do Obsidian 1.8; em versões anteriores, inglês.
  const lang = typeof getLanguage === "function" ? getLanguage() : "en";
  return lang.startsWith("pt") ? pt : en;
}
