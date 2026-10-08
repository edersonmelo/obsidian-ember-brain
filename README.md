# Ember Brain

Watch your vault come alive. Ember Brain opens your notes as an **animated graph** in its own tab, next to the core Graph view: your most active notes glow and pulse, light flows along your links, and the whole vault grows in the order you wrote it.

![Ember Brain](docs/screenshot.png)

## Features

- **Intro.** Notes appear in creation order while a date ticks in the corner. Replay it anytime.
- **Notes on fire.** Hot notes pulse in gold with sonar rings.
- **Light along links.** Particles flow towards the hottest notes.
- **Breathing graph.** Warm notes breathe slowly; cold ones twinkle faintly.
- **Folder colors.** Each folder gets its own color over a starry sky. Colors are configurable.
- **Live.** The graph updates as you create, edit, rename or delete notes.
- **Click to open.** Click a note to open it in a new tab, or `Cmd/Ctrl`+click to open it to the side.
- **Languages.** The interface is in English and Portuguese, following Obsidian's language.

## How heat is decided

1. **A `heat` property.** If a note has `heat: hot`, `heat: warm` or `heat: cold` in its frontmatter, that value is used. You can set it by hand, or generate it from your note history with [obsidian-heatmap](https://github.com/edersonmelo/obsidian-heatmap).
2. **Otherwise, the last edit.** Under a day is hot, under a week is warm, and anything older is cold.

## Usage

Click the **flame** icon in the ribbon, or run **Ember Brain: Open animated graph** from the command palette.

| Action | Result |
|---|---|
| Drag / scroll | Pan / zoom (turns off the automatic camera) |
| Hover a note | Name, path, number of links and heat |
| Click a note | Open it in a new tab (`Cmd/Ctrl`+click: to the side) |
| `R` or ↺ | Replay the intro |
| ⤢ | Fullscreen |

## Settings

| Setting | Description |
|---|---|
| Root folder | Only notes in this folder are shown, colored by their subfolder. Leave empty for the whole vault. |
| Folder colors | One per line, as `Folder: #rrggbb`. Folders without a color get one from the palette. |
| Intro duration | Seconds for all notes to appear. |

## Installation

- **From Community plugins:** search for **Ember Brain** once it is listed.
- **Manually:** download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/edersonmelo/obsidian-ember-brain/releases/latest) into `<vault>/.obsidian/plugins/ember-brain/`. Then enable the plugin in *Settings → Community plugins*.

## Privacy

Ember Brain works entirely offline:
- It makes no network requests.
- It collects no data.
- It never modifies your notes; it only reads links, frontmatter and file dates.

## Development

```sh
npm install
npm run dev    # rebuild on change
npm run lint   # eslint with eslint-plugin-obsidianmd (the same rules as the plugin review)
npm run build  # type-check and produce main.js
```

To release, run `npm version patch` (or `minor`/`major`) and push the tag (`git push --follow-tags`). The GitHub Action builds the plugin and attaches `main.js`, `manifest.json` and `styles.css` to the release.

The graph is drawn on a 2D canvas. The physics uses [d3-force](https://github.com/d3/d3-force), bundled into `main.js`.

## License

[MIT](LICENSE) © Ederson Melo
