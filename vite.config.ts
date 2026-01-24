import type { UserConfig, ConfigEnv } from 'vite';
import cesium from 'vite-plugin-cesium';
import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'node:path';
import {
  createBuildOptions,
  createCSSOptions,
  createDefineOptions,
  createEsBuildOptions,
  createServerOptions,
  createVitePlugins,
  wrapperEnv,
} from './build';

export default defineConfig(async ({ command, mode }: ConfigEnv) => {
  const root = process.cwd();
  const isBuild = command === 'build';
  const viteEnv = wrapperEnv(loadEnv(mode, root));
  const pathResolve = (pathname: string) => resolve(root, '.', pathname);
  const config: UserConfig = {
    root,
    base: viteEnv.VITE_PUBLIC_PATH,
    define: await createDefineOptions(),
    plugins: [createVitePlugins(isBuild, viteEnv), cesium()],
    server: {
      proxy: {
        // HTTP API
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },

        // ✅ WebSocket：同源转发到 TB 后端
        '/api/ws': {
          target: 'ws://localhost:8080',
          ws: true,
          changeOrigin: true,
        },
      },
    },
    esbuild: createEsBuildOptions(mode),
    build: createBuildOptions(viteEnv),
    css: createCSSOptions(),
    resolve: {
      alias: {
        '/@/': pathResolve('src') + '/',
        '/#/': pathResolve('types') + '/',
      },
    },
  };
  return config;
});
