import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import { DEFAULT_BRANDS } from "eslint-plugin-obsidianmd/dist/lib/rules/ui/brands.js";

export default defineConfig([
  { ignores: ["main.js", "node_modules/**", "esbuild.config.mjs", "version-bump.mjs"] },
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ["eslint.config.*"] },
      },
    },
    rules: {
      // Proper nouns used in the UI.
      "obsidianmd/ui/sentence-case": ["warn", { brands: [...DEFAULT_BRANDS, "Ember Brain"] }],
    },
  },
]);
