# Ember Brain

Plugin do Obsidian que abre o grafo do vault como um **show animado**, numa aba própria, ao lado do Graph view.

![Ember Brain](docs/screenshot.png)

## O que mostra

- **Abertura:** as notas nascem na ordem em que foram criadas, com uma data correndo no canto.
- **Em brasa:** notas quentes pulsam em amarelo, com ondas de sonar.
- **Partículas:** luz corre pelas conexões em direção às notas mais quentes.
- **Ritmo:** notas mornas "respiram" devagar; as frias cintilam fraco.
- **Cores:** cada pasta tem a sua, num fundo de estrelas.
- **Ao vivo:** atualiza quando você cria, edita, renomeia ou apaga notas.

## Como abrir

- Ícone de **chama** na barra lateral, ou
- paleta de comandos: **Abrir Ember Brain**.

| Ação | Efeito |
|---|---|
| arrastar / rolar | mover / zoom (desliga a câmera automática) |
| passar o mouse | nome, caminho, conexões e calor |
| clicar | abre a nota numa aba nova (`Cmd/Ctrl` + clique: ao lado) |
| `R` ou ícone ↺ | repete a abertura |
| ícone ⤢ | tela cheia |

## De onde vem o calor

1. **Propriedade `heat:`.** Se a nota tiver `heat: hot | warm | cold` no frontmatter, o plugin usa esse valor. O projeto [obsidian-heatmap](https://github.com/edersonmelo/obsidian-heatmap) grava essa propriedade conforme o histórico de atualizações de cada nota e das notas ligadas a ela. Ele também espelha o Notion no vault.
2. **Sem a propriedade:** o calor vem da última modificação. Menos de 1 dia conta como em brasa, menos de 7 dias como aquecendo, e o resto como fria.

## Configurações

| Opção | O que faz |
|---|---|
| Pasta raiz | Só as notas desta pasta entram, e as cores são por subpasta dela. Vazio = vault inteiro. |
| Cores por pasta | Uma por linha: `Pasta: #rrggbb`. As outras pastas recebem cores da paleta. |
| Duração da abertura | Segundos para todas as notas nascerem. |

## Desenvolvimento

```sh
npm install
npm run dev     # recompila a cada mudança
npm run build   # checa tipos e gera main.js
```

Para testar, copie `main.js`, `manifest.json` e `styles.css` para `<vault>/.obsidian/plugins/ember-brain/` e ative em *Configurações → Plugins da comunidade*.

O desenho é em canvas 2D, e a física do grafo usa [d3-force](https://github.com/d3/d3-force), embutido no `main.js`. O plugin não carrega nada da internet e não altera nenhuma nota.

## Licença

MIT
