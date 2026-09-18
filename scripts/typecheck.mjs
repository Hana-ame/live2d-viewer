/**
 * 型チェック。自分のコード（src/）の誤りだけを落とし、Framework/ と Core/ の
 * 既知の型エラー（Live2DCubismCore の型宣言が同梱されていないため）は通す。
 *
 * 背景: 以前は build:prod が型チェックを走らせていなかったため、
 * `this.finishExpressionLoad is not a function` のような実行時エラーになる
 * 取り違えがビルドを素通りしてしまった。ここで src/ に限定して関門にする。
 *
 * 使い方: node scripts/typecheck.mjs
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let out = '';
try {
  out = execFileSync('npx', ['tsc', '--noEmit'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
}

const lines = out.split('\n').filter((l) => /^\S.*\(\d+,\d+\): error/.test(l));
const mine = lines.filter((l) => l.startsWith('src/'));
const vendored = lines.filter(
  (l) => l.startsWith('Framework/') || l.startsWith('Core/')
);

if (vendored.length > 0) {
  console.log(
    `[typecheck] Framework/Core の既知の型エラー ${vendored.length} 件は無視します` +
      '（live2dcubismcore の型宣言が同梱されていないため）'
  );
}

if (mine.length > 0) {
  console.error(`[typecheck] src/ に型エラーが ${mine.length} 件あります:`);
  for (const l of mine) console.error('  ' + l);
  process.exit(1);
}

console.log('[typecheck] OK（src/ に型エラーなし）');
