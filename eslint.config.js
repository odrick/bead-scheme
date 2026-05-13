import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const styleRules = {
    "@stylistic/indent": ["error", 4, { SwitchCase: 1 }],
    "@stylistic/jsx-indent-props": ["error", 4],
    "@stylistic/brace-style": ["error", "1tbs", { allowSingleLine: true }],
    "@stylistic/block-spacing": ["error", "always"],
    "@stylistic/comma-spacing": ["error", { before: false, after: true }],
    "@stylistic/keyword-spacing": ["error", { before: true, after: true }],
    "@stylistic/object-curly-spacing": ["error", "always"],
    "@stylistic/space-before-blocks": ["error", "always"],
    "@stylistic/space-infix-ops": "error",
    "padding-line-between-statements": [
        "warn",
        { blankLine: "always", prev: "*", next: "return" },
    ],
};

export default defineConfig([
    globalIgnores(["dist", "node_modules"]),
    {
        files: ["src/**/*.{ts,tsx}"],
        extends: [
            js.configs.recommended,
            tseslint.configs.recommended,
            reactRefresh.configs.vite,
        ],
        languageOptions: {
            ecmaVersion: 2022,
            globals: globals.browser,
        },
        plugins: {
            "@stylistic": stylistic,
            "react-hooks": reactHooks,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            ...styleRules,
            "@typescript-eslint/no-unused-vars": "off",
            "no-useless-assignment": "off",
            "prefer-const": "off",
            "react-hooks/set-state-in-effect": "off",
        },
    },
    {
        files: ["vite.config.ts"],
        extends: [js.configs.recommended, tseslint.configs.recommended],
        languageOptions: {
            ecmaVersion: 2022,
            globals: globals.node,
        },
        plugins: {
            "@stylistic": stylistic,
        },
        rules: {
            ...styleRules,
            "@typescript-eslint/no-unused-vars": "off",
            "no-useless-assignment": "off",
            "prefer-const": "off",
        },
    },
    {
        files: ["scripts/**/*.mjs", "eslint.config.js"],
        extends: [js.configs.recommended],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: globals.node,
        },
        plugins: {
            "@stylistic": stylistic,
        },
        rules: styleRules,
    },
]);
