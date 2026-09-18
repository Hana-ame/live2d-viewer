/**
 * 模型上传 UI。
 *
 * 不打包任何模型数据，由用户选择本地的模型文件夹，
 * 在浏览器内渲染。
 */

import { LAppDelegate } from './lappdelegate';
import * as VFS from './vfs';

/** 支持的模型配置文件 */
const MODEL3_EXT = '.model3.json';

const style = (el: HTMLElement, s: Partial<CSSStyleDeclaration>): void => {
  Object.assign(el.style, s);
};

const buildPanel = (): {
  panel: HTMLDivElement;
  fileInput: HTMLInputElement;
  dirInput: HTMLInputElement;
  status: HTMLDivElement;
  log: HTMLDivElement;
} => {
  const panel = document.createElement('div');
  style(panel, {
    position: 'fixed',
    left: '16px',
    top: '16px',
    zIndex: '10',
    width: '320px',
    maxHeight: 'calc(100vh - 32px)',
    overflow: 'auto',
    padding: '14px 16px',
    borderRadius: '10px',
    background: 'rgba(24,24,28,0.88)',
    color: '#e8e8ea',
    font: '13px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif',
    boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
    backdropFilter: 'blur(6px)',
  });

  const title = document.createElement('div');
  title.textContent = 'Live2D 模型查看器';
  style(title, { fontSize: '15px', fontWeight: '600', marginBottom: '4px' });

  const hint = document.createElement('div');
  hint.textContent = '选择模型文件夹（需含 .model3.json / .moc3 / 贴图）';
  style(hint, { opacity: '0.7', fontSize: '12px', marginBottom: '10px' });

  const mkButton = (label: string): HTMLButtonElement => {
    const b = document.createElement('button');
    b.textContent = label;
    style(b, {
      display: 'block',
      width: '100%',
      margin: '6px 0',
      padding: '8px 10px',
      borderRadius: '6px',
      border: '1px solid rgba(255,255,255,0.18)',
      background: 'rgba(255,255,255,0.08)',
      color: 'inherit',
      font: 'inherit',
      cursor: 'pointer',
    });
    return b;
  };

  // フォルダ選択（webkitdirectory）
  const dirInput = document.createElement('input');
  dirInput.type = 'file';
  dirInput.multiple = true;
  dirInput.setAttribute('webkitdirectory', '');
  dirInput.setAttribute('directory', '');
  style(dirInput, { display: 'none' });

  // 多文件选择（用于不支持文件夹选择的浏览器）
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.multiple = true;
  fileInput.accept = '.json,.moc3,.png,.jpg,.jpeg,.webp,.wav,.mp3';
  style(fileInput, { display: 'none' });

  const dirBtn = mkButton('选择模型文件夹');
  const fileBtn = mkButton('选择文件（多选）');
  const nextBtn = mkButton('切换内置模型');
  const clearBtn = mkButton('清除');

  // ビルトインモデル（Live2D オリジナルキャラクター）の著作権表示。
  // Free Material License Agreement §2.1.5 により、派生作品には
  // 指定の著作権表示を行う義務がある。
  const credit = document.createElement('div');
  credit.innerHTML =
    '内置模型为 Live2D 官方样例，版权归 Live2D Inc. 所有，' +
    '依 <a href="https://www.live2d.com/eula/live2d-sample-model-terms_en.html" ' +
    'target="_blank" rel="noopener" style="color:#8ab4f8">其使用条款</a> 使用。<br>' +
    '<span style="opacity:.75">This content uses sample data owned and copyrighted ' +
    'by Live2D Inc.</span>';
  style(credit, {
    marginTop: '8px',
    paddingTop: '8px',
    borderTop: '1px solid rgba(255,255,255,0.12)',
    fontSize: '11px',
    lineHeight: '1.5',
    opacity: '0.9',
  });

  const status = document.createElement('div');
  style(status, { marginTop: '10px', fontSize: '12px', wordBreak: 'break-all' });

  const log = document.createElement('div');
  style(log, {
    marginTop: '8px',
    paddingTop: '8px',
    borderTop: '1px solid rgba(255,255,255,0.12)',
    fontSize: '11px',
    fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace',
    opacity: '0.85',
    whiteSpace: 'pre-wrap',
    maxHeight: '200px',
    overflow: 'auto',
  });

  dirBtn.onclick = () => dirInput.click();
  fileBtn.onclick = () => fileInput.click();
  nextBtn.onclick = () => {
    // 内置模型之间切换（内置模型从官方 CDN 读取，不用虚拟 FS）
    VFS.unmount();
    const mgr = getManager();
    if (mgr && typeof mgr.nextScene === 'function') {
      mgr.nextScene();
      status.textContent = '已切换到下一个内置模型。';
    } else {
      status.textContent = '切换失败：拿不到渲染管理器。';
    }
  };
  clearBtn.onclick = () => {
    VFS.unmount();
    status.textContent = '已清除。';
    log.textContent = '';
  };

  panel.append(title, hint, dirBtn, fileBtn, nextBtn, clearBtn, status, log, credit);
  return { panel, fileInput, dirInput, status, log };
};

/** 校验模型 JSON 同目录下是否有 .moc3，缺失时返回原因 */
const diagnose = (modelJsonPath: string): string[] => {
  const warnings: string[] = [];
  const all = VFS.paths();
  const lower = all.map((p) => p.toLowerCase());

  if (!all.some((p) => p.toLowerCase().endsWith('.moc3'))) {
    warnings.push('⚠ 未找到 .moc3（可能没选中模型本体）');
  }
  if (!all.some((p) => /\.(png|jpe?g|webp)$/i.test(p))) {
    warnings.push('⚠ 未找到贴图图片');
  }
  const dir = modelJsonPath.includes('/')
    ? modelJsonPath.slice(0, modelJsonPath.lastIndexOf('/') + 1).toLowerCase()
    : '';
  if (dir && !lower.some((p) => p.startsWith(dir) && p.endsWith('.moc3'))) {
    warnings.push(`⚠ ${dir} 下没有 .moc3`);
  }
  return warnings;
};

/** 渲染管理器の最小インタフェース（公式 API の内部経路に依存する部分を一箇所に集約） */
type Live2DManagerLike = {
  loadUploadedModel: (p: string) => void;
  nextScene?: () => void;
};

/**
 * Subdelegate 経由で描画マネージャを取得する。
 * 公式 SDK に公開アクセサが無いため内部フィールドを辿るので、
 * 取得経路はこの関数に集約しておく（SDK 更新時の修正点を一箇所にする）。
 */
const getManager = (): Live2DManagerLike | null => {
  const delegate = LAppDelegate.getInstance() as unknown as {
    _subdelegates?: Array<{ getLive2DManager: () => Live2DManagerLike | null }>;
  };
  const subs = delegate._subdelegates;
  if (!subs || subs.length === 0) return null;
  return subs[0].getLive2DManager();
};

export const installUI = (): void => {
  const { panel, fileInput, dirInput, status, log } = buildPanel();
  document.body.appendChild(panel);

  const handle = (files: FileList | null): void => {
    if (!files || files.length === 0) return;

    const model3 = VFS.mountFiles(files);
    const lines: string[] = [];
    lines.push(`已登记文件数: ${VFS.count()}`);

    if (!model3) {
      status.textContent = `✗ 未找到 ${MODEL3_EXT}。请选择完整的模型文件夹。`;
      // 把已登记的文件列出来，便于排查
      log.textContent = VFS.paths().slice(0, 30).join('\n');
      return;
    }

    for (const w of diagnose(model3)) lines.push(w);
    lines.push(`✓ 已载入: ${model3}`);
    status.textContent = lines.join('\n');

    // 经由 Subdelegate 替换模型
    const mgr = getManager();
    if (mgr) {
      mgr.loadUploadedModel(model3);
      log.textContent = VFS.paths().slice(0, 40).join('\n');
      return;
    }
    status.textContent += '\n✗ 无法访问内部 API（缺少 getLive2DManager）';
  };

  dirInput.addEventListener('change', () => handle(dirInput.files));
  fileInput.addEventListener('change', () => handle(fileInput.files));

  // ドラッグ＆ドロップ（フォルダも可）
  panel.addEventListener('dragover', (e) => {
    e.preventDefault();
    style(panel, { outline: '2px dashed rgba(120,180,255,0.8)' });
  });
  panel.addEventListener('dragleave', () => style(panel, { outline: 'none' }));
  panel.addEventListener('drop', (e) => {
    e.preventDefault();
    style(panel, { outline: 'none' });
    const dt = e.dataTransfer;
    if (!dt) return;
    // DataTransferItem から File を集める（フォルダ展開はブラウザ依存）
    const files: File[] = [];
    for (const item of Array.from(dt.items ?? [])) {
      if (item.kind !== 'file') continue;
      const f = item.getAsFile();
      if (f) files.push(f);
    }
    if (files.length > 0) handle(files as unknown as FileList);
  });

  status.textContent = '尚未选择模型。请用上方按钮选择文件夹。';
};
