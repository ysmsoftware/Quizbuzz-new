import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { ignores: [".next/**", "**/node_modules/**", "dist/**", "out/**", ".impeccable/**", "**/scripts/**", "public/**"] },
  { files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: {...globals.browser, ...globals.node} } },
  tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  {
    plugins: {
      "react-hooks": reactHooks
    },
    settings: {
      react: {
        version: "detect"
      }
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off",
      "react/react-in-jsx-scope": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react/no-unescaped-entities": "off",
      // TypeScript already validates prop shapes at compile time, so
      // eslint-plugin-react's recommended react/prop-types rule (which
      // expects runtime PropTypes declarations) is redundant here and was
      // false-positiving on typed components using object destructuring —
      // e.g. a forwarded `rootRef`/`className` pair or a `columns`/`rows`
      // skeleton prop. Standard to turn off in a TS + React project (this
      // is also what eslint-config-next itself sets).
      "react/prop-types": "off"
    }
  }
]);
