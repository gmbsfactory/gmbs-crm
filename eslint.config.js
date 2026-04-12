const path = require("path")
const { FlatCompat } = require("@eslint/eslintrc")

const compat = new FlatCompat({
  baseDirectory: __dirname,
  resolvePluginsRelativeTo: __dirname,
})

module.exports = [
  {
    ignores: [
      "**/node_modules/**",
      ".next/**",
      "dist/**",
      "out/**",
      "build/**",
      "coverage/**",
      "scripts/**",
    ],
  },
  ...compat.config({
    extends: ["next/core-web-vitals"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/src/*"],
              message: "N'utilise jamais @/src — utilise @/ direct.",
            },
            {
              group: ["../*", "../../*", "../../../*"],
              message: "Utilise l'alias @/ pour les imports cross-feature.",
            },
            {
              group: [
                "@/lib/api/interventions",
                "@/lib/api/permissions",
              ],
              message:
                "Legacy API layer en cours de migration — importe depuis @/lib/api/v2 à la place. Voir le plan de refacto API.",
            },
          ],
        },
      ],
    },
  }),
  {
    files: [
      "examples/**/*.{js,ts,tsx}",
      "tests/**/*.{js,ts,tsx}",
      "supabase/functions/**/*.{js,ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  // Allowlist: importers existants des modules legacy `src/lib/api/*`.
  // Cette liste doit RÉTRÉCIR au fur et à mesure de la migration vers v2.
  // Ne pas ajouter de nouvelles entrées — créer le module v2 à la place.
  {
    files: [
      "app/api/**/*.{ts,tsx}",
      "app/interventions/**/page.tsx",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
]
