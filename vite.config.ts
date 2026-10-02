import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { spaceBridge } from "./scripts/space/vitePlugin";

// Login automático do dev server (ver AuthContext). Sem prefixo VITE_ de propósito:
// algumas dependências leem import.meta.env inteiro, o que colaria toda VITE_* no bundle.
const devAuth = (command: string, mode: string) => {
  if (command !== "serve") return null;
  const env = loadEnv(mode, process.cwd(), "DEV_AUTH_");
  return env.DEV_AUTH_EMAIL && env.DEV_AUTH_PASSWORD
    ? { email: env.DEV_AUTH_EMAIL, password: env.DEV_AUTH_PASSWORD }
    : null;
};

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => ({
  define: {
    __DEV_AUTH__: JSON.stringify(devAuth(command, mode)),
  },
  server: {
    // Só este computador: com o login automático, abrir na rede daria acesso logado a quem estiver no Wi-Fi.
    host: "localhost",
    port: 8080,
    watch: {
      // Ship Studio keeps a live Chrome profile here; its locked files crash the watcher (EBUSY)
      ignored: ["**/.shipstudio/**"],
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tooltip'],
        },
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    // Claude no Space: o scripts/space/space.mjs fala com o canvas aberto (só no dev)
    spaceBridge(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ['react', 'react-dom'],
  },
}));
