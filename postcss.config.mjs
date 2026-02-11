import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    "postcss-import": {
      resolve(id, basedir) {
        if (id.startsWith("@/")) {
          return resolve(__dirname, "src", id.slice(2));
        }
        return resolve(basedir, id);
      },
    },
    tailwindcss: {},
  },
};

export default config;
