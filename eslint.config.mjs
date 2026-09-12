import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'build/**',
      'coverage/**',
      'next-env.d.ts',
      '.swc/**',
    ],
  },
  ...nextCoreWebVitals,
  {
    rules: {
      // `eslint-plugin-react-hooks` v9 (pulled in via eslint-config-next 16)
      // ships a set of new "rules of react" / React Compiler readiness
      // checks as hard errors. On this codebase they flag long-standing,
      // working patterns in dozens of files rather than actual bugs, and
      // fixing them properly would mean a wide behavioral refactor across
      // the app (reordering/hoisting effect callbacks, restructuring data
      // fetching, changing when refs are read) — out of scope for a lint
      // migration. Downgraded to warnings so real regressions still show
      // up without gating the build on a large, risky rewrite:
      //
      // - react-hooks/immutability: flags the common
      //   `useEffect(() => { fetchThing() }, [...])` pattern used before
      //   the callback is declared further down the component body.
      // - react-hooks/set-state-in-effect: flags the standard
      //   fetch-in-effect data-loading pattern used throughout the app.
      // - react-hooks/refs: flags reading `ref.current` during render,
      //   used deliberately in a couple of places (e.g. tooltip
      //   positioning, avoiding stale closures) where moving the read
      //   into an effect would change rendering/timing behavior.
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // The codebase makes broad, intentional use of `any` in a handful of
      // dynamic/interop spots (form schemas, third-party payloads, generic
      // API helpers). Enforcing this would require a wide, risky retype of
      // otherwise-working code rather than fixing a real bug, so we relax
      // it to a warning instead of a hard error.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
]

export default eslintConfig
