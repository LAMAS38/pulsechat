import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
  server: {
    port: 5173,
    host: true, // accessible depuis iPhone sur le même Wi‑Fi (http://IP-DU-PC:5173)
    proxy: {
      "/health": "http://127.0.0.1:8787",
      "/auth": "http://127.0.0.1:8787",
      "/r": {
        target: "http://127.0.0.1:8787",
        ws: true,
        configure(proxy) {
          // Connexion WS fermée pendant un write (reconnexion, HMR, changement de salon) — bruit dev Windows
          const ignore = (err: NodeJS.ErrnoException) => {
            if (err.code === "ECONNABORTED" || err.code === "ECONNRESET" || err.code === "EPIPE") {
              return true;
            }
            return false;
          };
          proxy.on("error", (err, _req, res) => {
            if (ignore(err)) return;
            console.error("[vite proxy]", err);
            if (res && "writeHead" in res && !res.headersSent) {
              res.writeHead(502);
              res.end();
            }
          });
          proxy.on("proxyReqWs", (_proxyReq, _req, socket) => {
            socket.on("error", (err) => {
              if (!ignore(err)) console.error("[vite proxy ws]", err);
            });
          });
        },
        bypass(req) {
          const url = req.url ?? "";
          // WebSocket only — page routes (/r/salon) stay on Vite (SPA)
          if (/^\/r\/[^/?]+\/ws(?:\?|$)/.test(url)) {
            return;
          }
          return false;
        },
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
