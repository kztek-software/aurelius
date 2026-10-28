import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Not part of the Next.js app: native .NET mobile project & generated graph data.
    "mobile/**",
    "code-graph/**",
    "windows-tools/**",
  ]),
  {
    // `any` is tracked as technical debt (306 warnings) rather than a CI blocker:
    // it is a typing gap, not a defect. Tighten file-by-file, then flip back to "error".
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // Standalone Node/Electron CommonJS scripts — outside the Next.js bundle,
    // so CJS `require()` is the correct module system here.
    files: [
      "desktop/**/*.js",
      "scripts/**/*.{js,mjs}",
      ".gemini/**/*.js",
      "*.mjs",
    ],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-var-requires": "off",
    },
  },
]);

export default eslintConfig;
