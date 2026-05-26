import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/Tracker-Fit-Joe",

  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png"],
      manifest: {
        name:             "Joe Tracker",
        short_name:       "Трекер",
        description:      "Дневник питания и тренировок",
        start_url:        "/Joe-Tracker-/",
        display:          "standalone",
        orientation:      "portrait",
        background_color: "#030712",
        theme_color:      "#030712",
        lang:             "ru",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
          { src: "icons/icon-180.png", sizes: "180x180", type: "image/png", purpose: "any" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "gfonts-css", expiration: { maxEntries: 10, maxAgeSeconds: 31536000 } }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "gfonts-woff2", expiration: { maxEntries: 20, maxAgeSeconds: 31536000 } }
          }
        ]
      }
    })
  ],

  build: {
    target:    "es2020",
    outDir:    "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:   ["react", "react-dom"],
          supabase: ["@supabase/supabase-js"]
        }
      }
    }
  }
});
