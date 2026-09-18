/**
 * 用于模型上传的虚拟文件系统。
 *
 * 把上传的文件注册为 Blob URL，
 * 直接复用官方渲染管线（fetch(`${dir}${file}`)）。
 * 这样就能在不把模型数据放进仓库的前提下完成渲染。
 */

/** 规范化后的文件表: 相对路径 → Blob URL */
const fileMap = new Map<string, string>();

/** 当前模型的根目录（相对路径的基点） */
let currentRoot = '';

export const getCurrentRoot = (): string => currentRoot;

const normalize = (p: string): string =>
  p.replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\/{2,}/g, '/');

/**
 * 从 FileList / DataTransfer 构建虚拟文件系统。
 * 优先用 webkitRelativePath（文件夹选择时），没有则用 name。
 * @returns model3.json 的相对路径（找到时）
 */
export const mountFiles = (files: FileList | File[]): string | null => {
  unmount();
  const list = Array.from(files as ArrayLike<File>);

  for (const f of list) {
    const rel = normalize((f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name);
    if (!rel) continue;
    fileMap.set(rel, URL.createObjectURL(f));
  }

  // model3.json を探す。複数ある場合は最も浅い階層のものを選ぶ。
  const candidates = [...fileMap.keys()].filter((k) => k.toLowerCase().endsWith('.model3.json'));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));

  const model3 = candidates[0];
  // ルートは model3.json のあるディレクトリ
  currentRoot = model3.includes('/') ? model3.slice(0, model3.lastIndexOf('/') + 1) : '';
  return model3;
};

/** 释放已注册的 Blob URL */
export const unmount = (): void => {
  for (const url of fileMap.values()) URL.revokeObjectURL(url);
  fileMap.clear();
  currentRoot = '';
};

/**
 * 取出虚拟 FS 上的文件。
 *
 * 先试完全匹配，若无则仅在「仅凭文件名可唯一确定」时
 * 做回退。后者是为无法使用文件夹选择、只能多选单个文件的
 * 情况（webkitRelativePath 为空）准备的兜底；当同名文件有多个时，
 * 为避免误解析而返回 undefined。
 */
export const resolve = (path: string): string | undefined => {
  const key = normalize(path);
  const exact = fileMap.get(key);
  if (exact) return exact;

  const base = key.split('/').pop();
  if (!base) return undefined;

  let found: string | undefined;
  for (const [k, url] of fileMap) {
    if (k.split('/').pop() !== base) continue;
    if (found !== undefined) return undefined; // 同名が複数 → 解決しない
    found = url;
  }
  return found;
};

/** 已登记文件数（供 UI 显示） */
export const count = (): number => fileMap.size;

/** 已登记的相对路径列表（调试用） */
export const paths = (): string[] => [...fileMap.keys()].sort();

/**
 * テクスチャなど Image.src / Audio.src 用に実 URL を返す。
 *
 * 公式パイプラインはテクスチャを `new Image().src = path` で読むため、
 * fetch の差し替えでは仮想 FS を経由しない。パスが仮想 FS にあれば
 * blob URL を返し、無ければ元のパスをそのまま返す（通常のモデルは
 * 従来どおり相対パスで読まれる）。
 */
export const resolveAssetUrl = (path: string): string => {
  const hit = resolve(path) ?? resolve(path.replace(/^\/+/, ''));
  return hit ?? path;
};

/**
 * 优先虚拟 FS、回退到原生 fetch 的 fetch 实现。
 *
 * 官方管线只调用全局 fetch，因此替换这里即可。
 * 注意: 把该函数赋给 window.fetch 后，若内部再调用全局 fetch，
 * 会调用自身造成无限递归。因此原始的 fetch 必须在模块
 * 加载时先捕获为 originalFetch。
 */
export const originalFetch: typeof fetch =
  typeof window !== 'undefined' && window.fetch
    ? window.fetch.bind(window)
    : ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args)) as typeof fetch;

export const vfsFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  // blob: / data: / http(s): 直接放行（Core、着色器等）
  if (/^(blob:|data:|https?:)/i.test(url)) return originalFetch(input, init);

  // 相对路径优先走虚拟 FS（完全匹配 → 仅文件名唯一解析）
  const hit = resolve(url) ?? resolve(url.replace(/^\/+/, ''));
  if (hit) return originalFetch(hit, init);

  return originalFetch(input, init);
};
