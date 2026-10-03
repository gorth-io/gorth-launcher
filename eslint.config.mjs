import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/**",
      ".vite/**",
      "out/**",
      "dist/**",
      "packages/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx,mjs}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      ...js.configs.recommended.rules,
      ...(tsPlugin.configs["eslint-recommended"].overrides?.[0]?.rules ?? {}),
      ...tsPlugin.configs.recommended.rules,
    },
  },
];
