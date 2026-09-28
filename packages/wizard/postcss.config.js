import { fileURLToPath } from 'url';

export default {
  plugins: {
    // Explicit path: Tailwind otherwise looks for its config in the working directory, not this package.
    tailwindcss: { config: fileURLToPath(new URL('./tailwind.config.js', import.meta.url)) },
    autoprefixer: {},
  },
};
