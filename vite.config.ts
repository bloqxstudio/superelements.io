import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { spaceBridge } from "./scripts/space/vitePlugin";
import { spaceChat } from "./scripts/space/chatPlugin";
import { iara } from "./scripts/iara/iaraPlugin";
import { prospecting } from "./scripts/prospects/vitePlugin";
import { criativos } from "./scripts/criativos/vitePlugin";
import { codeSites } from "./scripts/sites/vitePlugin";

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
  optimizeDeps: {
    // Só o worker da transcrição importa esta lib: sem pré-otimizar, o Vite a descobre no meio
    // do uso e recarrega a página, e o vídeo explicativo some no meio do processo (2026-11-07).
    include: ["@huggingface/transformers"],
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
    // Claude no Space: o scripts/space/space.mjs fala com o canvas aberto (só no dev)
    spaceBridge(),
    // Chat com os agentes dentro do canvas: roda o Claude Code ou o Codex nesta máquina (só no dev)
    spaceChat(),
    iara(),
    // Prospecção: busca empresas e lê os sites delas (só no dev, tela /prospeccao)
    prospecting(),
    criativos(),
    // Sites em código (Astro): prévia, edição visual e publicação pelo GitHub desta máquina
    codeSites(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ['react', 'react-dom'],
  },
}));
