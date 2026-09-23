import { ExportTargetItem } from '../types/store';

export interface ExportVariableContext {
  now?: Date;
  projectName?: string;
  name?: string; // テンプレート名やマップ領域名
}

/**
 * 相対パスを正規化し、先頭スラッシュの除去およびパストラバーサル（..）の排除を行う
 */
export function normalizeRelativePath(rawPath: string): string {
  if (!rawPath) return '';
  // スラッシュ・バックスラッシュをスラッシュに統一
  let normalized = rawPath.replace(/\\/g, '/');
  // 先頭のスラッシュを除去
  normalized = normalized.replace(/^\/+/, '');
  // 各セグメントから '..' を除去し、Windowsファイル名禁止文字 (:*?"<>|) を安全な '_' にサニタイズ
  const segments = normalized
    .split('/')
    .filter((seg) => seg && seg !== '.' && seg !== '..')
    .map((seg) => seg.replace(/[:*?"<>|]/g, '_'));
  return segments.join('/');
}

/**
 * ファイル名として使用できない危険な文字を置換
 */
export function sanitizeFilenamePart(part: string): string {
  return part.replace(/[\\/:*?"<>|]/g, '_');
}

/**
 * 2桁ゼロ埋めヘルパー
 */
function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * パターン文字列内の変数（{{yyyymmdd}}, {{project_name}}, {{name}} 等）を展開
 */
export function resolveExportPattern(pattern: string, context: ExportVariableContext): string {
  if (!pattern) return '';
  const now = context.now || new Date();
  const year = now.getFullYear().toString();
  const month = pad2(now.getMonth() + 1);
  const day = pad2(now.getDate());
  const hours = pad2(now.getHours());
  const minutes = pad2(now.getMinutes());
  const seconds = pad2(now.getSeconds());

  const yyyymmdd_hhmmss = `${year}${month}${day}_${hours}${minutes}${seconds}`;
  const yyyymmdd = `${year}${month}${day}`;
  const hhmmss = `${hours}${minutes}${seconds}`;
  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hours}-${minutes}-${seconds}`;

  const projectName = sanitizeFilenamePart(context.projectName || 'untitled');
  const name = context.name ? sanitizeFilenamePart(context.name) : '';

  let result = pattern;

  // 1. 複合変数の置換 (大文字小文字不問)
  result = result.replace(/\{\{yyyymmdd_hhmmss\}\}/gi, yyyymmdd_hhmmss);
  result = result.replace(/\{\{yyyymmdd\}\}/gi, yyyymmdd);
  result = result.replace(/\{\{hhmmss\}\}/gi, hhmmss);
  result = result.replace(/\{\{date\}\}/gi, dateStr);
  result = result.replace(/\{\{time\}\}/gi, timeStr);

  // 2. 明示的エイリアスの置換 (大文字小文字不問)
  result = result.replace(/\{\{year\}\}/gi, year);
  result = result.replace(/\{\{month\}\}/gi, month);
  result = result.replace(/\{\{day\}\}/gi, day);
  result = result.replace(/\{\{hour\}\}/gi, hours);
  result = result.replace(/\{\{minute\}\}/gi, minutes);
  result = result.replace(/\{\{min\}\}/gi, minutes);
  result = result.replace(/\{\{second\}\}/gi, seconds);
  result = result.replace(/\{\{sec\}\}/gi, seconds);

  // 3. 単一変数の置換 (月 MM と 分 mm は大文字小文字を厳格に区別)
  result = result.replace(/\{\{MM\}\}/g, month); // 大文字MM = 月 (Month: 01-12)
  result = result.replace(/\{\{mm\}\}/g, minutes); // 小文字mm = 分 (Minute: 00-59)
  result = result.replace(/\{\{yyyy\}\}/gi, year); // 年 (4桁)
  result = result.replace(/\{\{dd\}\}/gi, day); // 日 (01-31)
  result = result.replace(/\{\{hh\}\}/gi, hours); // 時 (00-23)
  result = result.replace(/\{\{ss\}\}/gi, seconds); // 秒 (00-59)

  // 4. プロジェクト名・名称コンテキストの置換
  result = result.replace(/\{\{project_name\}\}/gi, projectName);
  result = result.replace(/\{\{projectName\}\}/gi, projectName);
  result = result.replace(/\{\{name\}\}/gi, name);

  return normalizeRelativePath(result);
}

export interface TreeFileNode {
  type: 'file';
  name: string;
  relativePath: string;
  fullPath: string;
  item: ExportTargetItem;
  sourceLabel: string;
  isPairSecondary?: boolean; // ROS Standard の .yaml や ウェイポイントの .png など
}

export interface TreeDirectoryNode {
  type: 'directory';
  name: string;
  relativePath: string;
  children: (TreeDirectoryNode | TreeFileNode)[];
}

export interface ResolvedExportFile {
  item: ExportTargetItem;
  relativePath: string;
  fullPath: string;
  fileName: string;
  sourceLabel: string;
  isPairSecondary?: boolean;
}

/**
 * アイテム一覧を展開し、出力予定の全ファイルパス一覧を生成
 */
export function resolveExportFiles(
  items: ExportTargetItem[],
  context: {
    now: Date;
    projectName: string;
    rootDir: string;
    availableRegions: { id: string; name: string }[];
    templates: { id: string; name: string; extension: string }[];
    defaultFormats: { id: string; name: string; extension: string }[];
  },
): ResolvedExportFile[] {
  const result: ResolvedExportFile[] = [];
  const normalizedRoot = context.rootDir.replace(/\\/g, '/').replace(/\/+$/, '');

  for (const item of items) {
    if (item.type === 'map_all_regions') {
      // 全マップ領域を展開（領域が存在しない場合は出力対象外）
      const regionsToExport = context.availableRegions;
      if (regionsToExport.length === 0) {
        continue;
      }

      for (const reg of regionsToExport) {
        // パターン内に {{name}} がない場合は自動的に付加
        let pattern = item.relativePathPattern;
        if (!/\{\{name\}\}/i.test(pattern)) {
          const lastSlash = Math.max(pattern.lastIndexOf('/'), pattern.lastIndexOf('\\'));
          if (lastSlash > -1) {
            pattern = `${pattern.substring(0, lastSlash)}/{{name}}_${pattern.substring(lastSlash + 1)}`;
          } else {
            pattern = `{{name}}_${pattern}`;
          }
        }

        const resolvedRelPath = resolveExportPattern(pattern, {
          now: context.now,
          projectName: context.projectName,
          name: reg.name,
        });

        // 拡張子調整
        const ext = item.mapFormat === 'png_only' ? 'png' : 'pgm';
        const baseWithoutExt = resolvedRelPath.replace(/\.(pgm|png|yaml)$/i, '');
        const primaryRelPath = `${baseWithoutExt}.${ext}`;
        const fileName = primaryRelPath.split('/').pop() || primaryRelPath;
        const fullPath = normalizedRoot ? `${normalizedRoot}/${primaryRelPath}` : primaryRelPath;

        result.push({
          item,
          relativePath: primaryRelPath,
          fullPath,
          fileName,
          sourceLabel: `Map: ${reg.name} (${item.mapFormat === 'png_only' ? 'PNG' : 'PGM'})`,
        });

        if (item.mapFormat === 'ros_standard') {
          const yamlRelPath = `${baseWithoutExt}.yaml`;
          const yamlFileName = yamlRelPath.split('/').pop() || yamlRelPath;
          const yamlFullPath = normalizedRoot ? `${normalizedRoot}/${yamlRelPath}` : yamlRelPath;
          result.push({
            item,
            relativePath: yamlRelPath,
            fullPath: yamlFullPath,
            fileName: yamlFileName,
            sourceLabel: `Map YAML: ${reg.name}`,
            isPairSecondary: true,
          });
        }
      }
    } else if (item.type === 'map_region') {
      const reg = context.availableRegions.find((r) => r.id === item.sourceId);
      if (!reg) {
        continue;
      }
      const resolvedRelPath = resolveExportPattern(item.relativePathPattern, {
        now: context.now,
        projectName: context.projectName,
        name: reg.name,
      });
      const ext = item.mapFormat === 'png_only' ? 'png' : 'pgm';
      const baseWithoutExt = resolvedRelPath.replace(/\.(pgm|png|yaml)$/i, '');
      const primaryRelPath = `${baseWithoutExt}.${ext}`;
      const fileName = primaryRelPath.split('/').pop() || primaryRelPath;
      const fullPath = normalizedRoot ? `${normalizedRoot}/${primaryRelPath}` : primaryRelPath;

      result.push({
        item,
        relativePath: primaryRelPath,
        fullPath,
        fileName,
        sourceLabel: `Map: ${reg.name} (${item.mapFormat === 'png_only' ? 'PNG' : 'PGM'})`,
      });

      if (item.mapFormat === 'ros_standard') {
        const yamlRelPath = `${baseWithoutExt}.yaml`;
        const yamlFileName = yamlRelPath.split('/').pop() || yamlRelPath;
        const yamlFullPath = normalizedRoot ? `${normalizedRoot}/${yamlRelPath}` : yamlRelPath;
        result.push({
          item,
          relativePath: yamlRelPath,
          fullPath: yamlFullPath,
          fileName: yamlFileName,
          sourceLabel: `Map YAML: ${reg.name}`,
          isPairSecondary: true,
        });
      }
    } else {
      // ウェイポイント出力
      let tmplName = 'Waypoints';
      let tmplExt = 'yaml';
      if (item.type === 'waypoint_template') {
        const t = context.templates.find((x) => x.id === item.sourceId);
        if (t) {
          tmplName = t.name;
          tmplExt = t.extension;
        }
      } else {
        const f = context.defaultFormats.find((x) => x.id === item.sourceId);
        if (f) {
          tmplName = f.name;
          tmplExt = f.extension;
        }
      }

      let resolvedRelPath = resolveExportPattern(item.relativePathPattern, {
        now: context.now,
        projectName: context.projectName,
        name: tmplName,
      });

      // 拡張子が付いていない場合は自動付与
      if (!/\.[a-zA-Z0-9]+$/.test(resolvedRelPath)) {
        resolvedRelPath = `${resolvedRelPath}.${tmplExt}`;
      }

      const fileName = resolvedRelPath.split('/').pop() || resolvedRelPath;
      const fullPath = normalizedRoot ? `${normalizedRoot}/${resolvedRelPath}` : resolvedRelPath;

      result.push({
        item,
        relativePath: resolvedRelPath,
        fullPath,
        fileName,
        sourceLabel: `Waypoints: ${tmplName}`,
      });

      if (item.includeMapImage) {
        const pngRelPath = resolvedRelPath.replace(/\.[a-zA-Z0-9]+$/, '.png');
        const pngFileName = pngRelPath.split('/').pop() || pngRelPath;
        const pngFullPath = normalizedRoot ? `${normalizedRoot}/${pngRelPath}` : pngRelPath;
        result.push({
          item,
          relativePath: pngRelPath,
          fullPath: pngFullPath,
          fileName: pngFileName,
          sourceLabel: `Map Shot (PNG)`,
          isPairSecondary: true,
        });
      }
    }
  }

  return result;
}

/**
 * ResolvedExportFile 一覧からディレクトリツリーを構築
 */
export function buildExportTreePreview(files: ResolvedExportFile[]): (TreeDirectoryNode | TreeFileNode)[] {
  const rootNodes: (TreeDirectoryNode | TreeFileNode)[] = [];

  for (const file of files) {
    const parts = file.relativePath.split('/');
    if (parts.length === 1) {
      rootNodes.push({
        type: 'file',
        name: parts[0],
        relativePath: file.relativePath,
        fullPath: file.fullPath,
        item: file.item,
        sourceLabel: file.sourceLabel,
        isPairSecondary: file.isPairSecondary,
      });
      continue;
    }

    let currentChildren = rootNodes;
    let currentRelPath = '';

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      currentRelPath = currentRelPath ? `${currentRelPath}/${part}` : part;

      let dirNode = currentChildren.find((n): n is TreeDirectoryNode => n.type === 'directory' && n.name === part);

      if (!dirNode) {
        dirNode = {
          type: 'directory',
          name: part,
          relativePath: currentRelPath,
          children: [],
        };
        currentChildren.push(dirNode);
      }

      currentChildren = dirNode.children;
    }

    const fileName = parts[parts.length - 1];
    currentChildren.push({
      type: 'file',
      name: fileName,
      relativePath: file.relativePath,
      fullPath: file.fullPath,
      item: file.item,
      sourceLabel: file.sourceLabel,
      isPairSecondary: file.isPairSecondary,
    });
  }

  return rootNodes;
}
