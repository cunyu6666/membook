/**
 * [WHO]: 提供Vite构建配置，包含React插件、Tailwind CSS插件、API代理
 * [FROM]: 依赖@vitejs/plugin-react、@tailwindcss/vite、vite
 * [TO]: 被Vite构建系统消费，用于开发和构建
 * [HERE]: vite.config.ts，项目构建配置入口
 */
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
