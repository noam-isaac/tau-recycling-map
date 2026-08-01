import { mergeConfig } from "vite";
import { defineConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      clearMocks: true,
      environment: "jsdom",
      restoreMocks: true,
      setupFiles: ["./tests/setup.ts"],
    },
  }),
);
