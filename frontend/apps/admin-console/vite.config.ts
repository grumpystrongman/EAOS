import { defineConfig } from "vite";

const demoIdentitiesEnabled = process.env.VITE_ENABLE_DEMO_IDENTITIES === "true";

export default defineConfig({
  define: {
    "globalThis.__ENABLE_DEMO_IDENTITIES__": JSON.stringify(demoIdentitiesEnabled)
  },
  server: {
    port: 8080
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (
          warning.code === "MODULE_LEVEL_DIRECTIVE" &&
          typeof warning.id === "string" &&
          warning.id.includes("react-router/dist/development")
        ) {
          return;
        }
        warn(warning);
      }
    }
  }
});
