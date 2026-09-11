import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      // Design tokens in src/styles.css are OKLCH values. Wrapping them in
      // hsl() yields `hsl(oklch(...))`, an invalid colour that SVG renders black.
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/hsl\\(\\s*var\\(--/]",
          message:
            "Design tokens are OKLCH: reference them as var(--token), never hsl(var(--token)).",
        },
        {
          selector: "TemplateElement[value.raw=/hsl\\(\\s*var\\(--/]",
          message:
            "Design tokens are OKLCH: reference them as var(--token), never hsl(var(--token)).",
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  eslintPluginPrettier,
);
