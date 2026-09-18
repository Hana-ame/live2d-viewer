/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 *
 * ビルド時に public/ へコピーするリソース。
 *
 * 重要: モデルデータ（Samples/Resources 相当）は一切コピーしない。
 * 本アプリはモデルを同梱せず、ユーザーが手元のモデルを選択して描画する方式のため、
 * リポジトリにもビルド成果物にもモデルファイルを含めない。
 */

'use strict';
const fs = require('fs');
const path = require('path');

const publicResources = [
  { src: './Core', dst: './public/Core' },
  { src: './Framework/Shaders', dst: './public/Framework/Shaders' },
];

publicResources.forEach((e) => {
  if (!fs.existsSync(e.src)) {
    console.warn(`[copy_resources] ソースが存在しません（スキップ）: ${e.src}`);
    return;
  }
  if (fs.existsSync(e.dst)) fs.rmSync(e.dst, { recursive: true });
  fs.mkdirSync(path.dirname(e.dst), { recursive: true });
  fs.cpSync(e.src, e.dst, { recursive: true });
  console.log(`[copy_resources] ${e.src} -> ${e.dst}`);
});

console.log('[copy_resources] 完了（モデルデータは同梱していません）');
