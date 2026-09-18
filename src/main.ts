/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { LAppDelegate } from './lappdelegate';
import * as VFS from './vfs';
import { installUI } from './uploader';

/**
 * ブラウザロード後の処理
 */
window.addEventListener(
  'load',
  (): void => {
    // 把虚拟 FS 接到 fetch 上。
    // 官方管线只用 fetch(url)，因此仅替换这里
    // 就能直接渲染上传的模型。
    (window as unknown as { fetch: typeof fetch }).fetch = VFS.vfsFetch as typeof fetch;

    // Initialize WebGL and create the application instance
    if (!LAppDelegate.getInstance().initialize()) {
      return;
    }

    LAppDelegate.getInstance().run();

    installUI();
  },
  { passive: true }
);

/**
 * 終了時の処理
 */
window.addEventListener(
  'beforeunload',
  (): void => {
    VFS.unmount();
    LAppDelegate.releaseInstance();
  },
  { passive: true }
);
