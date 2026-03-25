import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    ignores: ["**/dist/", "**/node_modules/", "**/*.cjs", "scripts/", "!eslint.config.js"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Ban raw fetch() in client hooks and components — must use authenticatedFetch/apiClient
  // to ensure 401→token-refresh→retry logic is never bypassed.
  {
    files: ["apps/client/src/hooks/**/*.ts", "apps/client/src/hooks/**/*.tsx"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message: "Use authenticatedFetch() or apiClient() from @/lib/apiClient. Raw fetch() bypasses token refresh and causes silent 401 failures on live.",
        },
      ],
    },
  }
);
