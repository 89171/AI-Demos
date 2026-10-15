import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'public/**', 'scripts/**'] },
  ...nextCoreWebVitals,
  {
    rules: {
      // Hydration safety: locale/theme are read from localStorage *after* mount
      // so server and client render identical markup. Same for the sidebar
      // expanding to the current route and for re-seeding a demo on model change.
      'react-hooks/set-state-in-effect': 'off',
      // The brush mask and animation handles live in refs; they are read during
      // render only to decide whether to re-arm work, never to paint markup.
      'react-hooks/refs': 'off',
    },
  },
];

export default config;
