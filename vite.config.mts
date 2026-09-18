import { defineConfig, UserConfig, ConfigEnv } from 'vite';
import path from 'path';

export default defineConfig((env: ConfigEnv): UserConfig => {
  const common: UserConfig = {
    server: {
      port: 5000,
    },
    root: './',
    // 相対パスにしておくと、GitHub Pages のサブパス
    // （https://<user>.github.io/<repo>/）でも
    // ローカルのルート配信でも、同じビルド成果物が動く。
    base: './',
    publicDir: './public',
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        // 本リポジトリは Framework を同梱している（サブモジュールではない）
        '@framework': path.resolve(__dirname, './Framework/src'),
      },
    },
    build: {
      target: 'baseline-widely-available',
      assetsDir: 'assets',
      outDir: './dist',
      sourcemap: env.mode === 'development' ? true : false,
    },
  };
  return common;
});
