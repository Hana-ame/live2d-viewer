/**
 * ZIP 読み込み（ブラウザ内で完結）。
 *
 * なぜ必要か: モデルフォルダの選択は `webkitdirectory` に依存しているが、
 * iOS Safari など一部のブラウザが対応していない。ZIP なら通常のファイル選択
 * だけでフォルダ構造を渡せるため、モバイルでもモデルを読み込める。
 *
 * 実装方針: 外部ライブラリを足さず、中央ディレクトリを自前で走査して
 * `DecompressionStream('deflate-raw')` で伸長する。ZIP の圧縮方式は
 * 0（無圧縮）と 8（deflate）のみ扱う。
 *
 * セキュリティ: 展開結果はメモリ上に留まり、どこにも送信しない。
 * ただし ZIP 爆弾（小さな圧縮ファイルが巨大に伸びる）でタブが落ちうるため、
 * 合計展開サイズに上限を設ける。
 */

/** 1 エントリあたりの展開上限（これ以上は異常とみなして中断） */
const MAX_ENTRY_BYTES = 256 * 1024 * 1024; // 256 MB

/** 全エントリ合計の展開上限 */
const MAX_TOTAL_BYTES = 1024 * 1024 * 1024; // 1 GB

/** 展開結果の 1 ファイル */
export type ZipEntry = {
  /** ZIP 内でのパス（フォルダ区切りは '/'） */
  path: string;
  /** 中身 */
  file: File;
};

/** 解析に失敗した理由を呼び出し側へ渡すためのエラー */
export class ZipError extends Error {}

const u16 = (v: DataView, o: number): number => v.getUint16(o, true);
const u32 = (v: DataView, o: number): number => v.getUint32(o, true);

/**
 * ZIP 内のファイル名をデコードする。
 *
 * ZIP 仕様では general purpose bit 11（0x0800）が立っていれば UTF-8。
 * 立っていない場合は歴史的に CP437 だが、日本語環境の ZIP は Shift_JIS で
 * 書かれたものも多い。UTF-8 として妥当ならそれを、そうでなければ
 * Shift_JIS を試し、どちらも駄目なら置換文字つきで返す。
 */
const decodeName = (bytes: Uint8Array, utf8Flag: boolean): string => {
  if (utf8Flag) {
    return new TextDecoder('utf-8').decode(bytes);
  }
  // UTF-8 として厳密に解釈できるか試す
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    /* 次の候補へ */
  }
  try {
    return new TextDecoder('shift_jis').decode(bytes);
  } catch {
    /* 最後の手段 */
  }
  return new TextDecoder('utf-8').decode(bytes);
};

/** 中央ディレクトリの 1 エントリ */
type CentralEntry = {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
  isDirectory: boolean;
};

/**
 * 中央ディレクトリを走査してエントリ表を得る。
 * ZIP は末尾の EOCD（End of Central Directory）から辿るのが正攻法。
 */
const readCentralDirectory = (
  view: DataView,
  buf: Uint8Array<ArrayBuffer>
): CentralEntry[] => {
  const len = buf.length;
  // EOCD は末尾 22 バイト以上、コメント最大 65535 バイト
  const searchStart = Math.max(0, len - 22 - 0xffff);
  let eocd = -1;
  for (let i = len - 22; i >= searchStart; i--) {
    if (u32(view, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError('EOCD が見つかりません（ZIP ではない可能性）');

  const count = u16(view, eocd + 10);
  let offset = u32(view, eocd + 16);

  // ZIP64 は扱わない（モデル用途では 4 GB を超えないため）
  if (offset === 0xffffffff || count === 0xffff) {
    throw new ZipError('ZIP64 形式は未対応です（4 GB 超の ZIP）');
  }

  const entries: CentralEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (offset + 46 > len || u32(view, offset) !== 0x02014b50) {
      throw new ZipError(`中央ディレクトリ ${i} 番目のヘッダが不正です`);
    }
    const flag = u16(view, offset + 8);
    const method = u16(view, offset + 10);
    const compressedSize = u32(view, offset + 20);
    const uncompressedSize = u32(view, offset + 24);
    const nameLen = u16(view, offset + 28);
    const extraLen = u16(view, offset + 30);
    const commentLen = u16(view, offset + 32);
    const localHeaderOffset = u32(view, offset + 42);

    const nameBytes = buf.subarray(offset + 46, offset + 46 + nameLen);
    const name = decodeName(nameBytes, (flag & 0x0800) !== 0);

    entries.push({
      name,
      method,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
      isDirectory: name.endsWith('/'),
    });

    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
};

/** 1 エントリを伸長してバイト列を返す */
const extractEntry = async (
  view: DataView,
  buf: Uint8Array<ArrayBuffer>,
  entry: CentralEntry
): Promise<Uint8Array<ArrayBuffer>> => {
  const lho = entry.localHeaderOffset;
  if (lho + 30 > buf.length || u32(view, lho) !== 0x04034b50) {
    throw new ZipError(`ローカルヘッダが不正: ${entry.name}`);
  }
  // ローカルヘッダ側の名前長・拡張領域長は中央ディレクトリと異なりうる
  const nameLen = u16(view, lho + 26);
  const extraLen = u16(view, lho + 28);
  const dataStart = lho + 30 + nameLen + extraLen;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > buf.length) {
    throw new ZipError(`データが範囲外: ${entry.name}`);
  }
  const compressed = buf.subarray(dataStart, dataEnd);

  if (entry.uncompressedSize > MAX_ENTRY_BYTES) {
    throw new ZipError(
      `展開後のサイズが上限を超えています: ${entry.name} (${entry.uncompressedSize} B)`
    );
  }

  if (entry.method === 0) {
    // 無圧縮
    return compressed.slice();
  }
  if (entry.method !== 8) {
    throw new ZipError(
      `未対応の圧縮方式 (method=${entry.method}): ${entry.name}`
    );
  }

  // deflate（ZIP の method 8 は raw deflate。zlib ヘッダは付かない）
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([compressed]).stream().pipeThrough(ds);
  const out = new Uint8Array(await new Response(stream).arrayBuffer());

  if (out.byteLength !== entry.uncompressedSize) {
    throw new ZipError(
      `展開サイズが一致しません: ${entry.name} ` +
        `(期待 ${entry.uncompressedSize} / 実際 ${out.byteLength})`
    );
  }
  return out;
};

/** MIME を拡張子から推定する（テクスチャを Blob として正しく扱うため） */
const mimeOf = (path: string): string => {
  const ext = path.toLowerCase().split('.').pop() ?? '';
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'json':
      return 'application/json';
    case 'moc3':
      return 'application/octet-stream';
    case 'wav':
      return 'audio/wav';
    case 'mp3':
      return 'audio/mpeg';
    default:
      return 'application/octet-stream';
  }
};

/**
 * ZIP を展開して File の配列にする。
 *
 * `onProgress` には (処理済み件数, 全件数) が渡る。大きなモデルでは
 * 1 ファイルずつ伸長するため、UI 側で進捗を出せる。
 */
export const unzipToFiles = async (
  zipFile: File | Blob,
  onProgress?: (done: number, total: number) => void
): Promise<ZipEntry[]> => {
  const buf = new Uint8Array(await zipFile.arrayBuffer());
  const view = new DataView(buf.buffer);

  const central = readCentralDirectory(view, buf).filter((e) => !e.isDirectory);

  // 合計サイズの事前検査（ZIP 爆弾対策）。宣言値を信頼して早期に弾く。
  const declaredTotal = central.reduce((a, e) => a + e.uncompressedSize, 0);
  if (declaredTotal > MAX_TOTAL_BYTES) {
    throw new ZipError(
      `展開後の合計が上限を超えています (${(declaredTotal / 1048576).toFixed(1)} MB)`
    );
  }

  const out: ZipEntry[] = [];
  let done = 0;
  let total = 0;

  for (const entry of central) {
    const bytes = await extractEntry(view, buf, entry);
    total += bytes.byteLength;
    if (total > MAX_TOTAL_BYTES) {
      throw new ZipError('展開中に合計サイズが上限を超えました');
    }
    // ファイル名だけを取り出す（ZIP 内の先頭フォルダは基点として落とす）
    const name = entry.name.split('/').pop() ?? entry.name;
    const blob = new Blob([bytes], { type: mimeOf(entry.name) });
    out.push({ path: entry.name, file: new File([blob], name) });
    onProgress?.(++done, central.length);
  }

  return out;
};

/**
 * 展開したエントリの共通基点ディレクトリを求める。
 *
 * 「モデル名/」で始まる 1 階層だけを落とし、`webkitRelativePath` 相当の
 * 相対パスを作るために使う。複数の基点がある場合は何もしない。
 */
export const commonRoot = (entries: ZipEntry[]): string => {
  if (entries.length === 0) return '';
  const firstSeg = (p: string): string => {
    const i = p.indexOf('/');
    return i < 0 ? '' : p.slice(0, i + 1);
  };
  const root = firstSeg(entries[0].path);
  if (root === '') return '';
  for (const e of entries) {
    if (firstSeg(e.path) !== root) return '';
  }
  return root;
};
