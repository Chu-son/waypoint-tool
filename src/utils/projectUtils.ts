/**
 * ファイルパスからプロジェクト名（拡張子 .wptroj を除いたファイル名）を抽出します。
 * パスが存在しない場合はフォールバック名（デフォルト: 'Untitled'）を返します。
 *
 * @param path プロジェクトファイルのフルパスまたは相対パス
 * @param fallback パスが存在しない場合のプロジェクト名（デフォルト: 'Untitled'）
 */
export function extractProjectName(path: string | null | undefined, fallback = 'Untitled'): string {
  if (!path) return fallback;
  const trimmed = path.trim();
  if (!trimmed) return fallback;
  const fileName = trimmed.split(/[/\\]/).pop() || trimmed;
  const name = fileName.replace(/\.wptroj$/i, '');
  return name || fallback;
}

/**
 * OSウィンドウタイトル用の文字列を組み立てます。
 * 例: "my_route * - Waypoint Tool", "my_route - Waypoint Tool"
 *
 * @param projectName 表示対象のプロジェクト名
 * @param isDirty 未保存の変更が存在するかどうか
 * @param brandName アプリケーションのブランド名
 */
export function formatWindowTitle(projectName: string, isDirty: boolean, brandName: string): string {
  const dirtyIndicator = isDirty ? ' *' : '';
  return `${projectName}${dirtyIndicator} - ${brandName}`;
}
