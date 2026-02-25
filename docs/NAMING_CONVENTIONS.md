# 命名規則 (Naming Conventions)

本プロジェクト（ROS Waypoint Tool）におけるファイルおよびディレクトリの命名基準を定義します。

## フロントエンド (React / TypeScript)

フロントエンド (`/src`) 側では、ReactおよびTypeScriptの一般的なベストプラクティスに従います。

### コンポーネントファイル (`.tsx`)
- **PascalCase** を使用します。（例: `MapCanvas.tsx`, `PropertiesPanel.tsx`, `ToolPanel.tsx`）
- Reactコンポーネントをエクスポートするファイルは必ずこの規則に従い、コンポーネント名とファイル名を一致させます。

### フック、ユーティリティ、APIラッパー、ストア (`.ts`, `.js`)
- **camelCase** を使用します。（例: `appStore.ts`, `backend.ts`, `useWaypointLogic.ts`, `mathUtils.ts`）
- クラス定義を含むファイルの場合は `PascalCase` を許容しますが、シングルトンインスタンスや関数のエクスポートが主体の場合は `camelCase` を使用します。

### スタイルシート (`.css`)
- **kebab-case** または **camelCase** (必要に応じて)。（例: `index.css`, `App.css`）

### 共通UIクラス（Tailwind）
- 画面横断で使う共通クラスは `ui-` プレフィックスを使用します。（例: `ui-input`, `ui-select`, `ui-btn-primary`）
- 状態表現は用途ベースで命名します。（例: `-primary`, `-secondary`, `-ghost`, `-danger`, `-active`, `-inactive`）
- 1画面専用の見た目クラスを追加するより、既存の `ui-*` クラスを優先して再利用してください。

### データ型定義ファイル (`.d.ts` / `.ts`)
- `types/` 配下に配置し、ドメインに基づく名前を小文字でつけます。（例: `store.ts`, `rosTypes.d.ts`）

## バックエンド (Rust / Tauri)

バックエンド (`/src-tauri/src`) では、Rustの標準的な命名規則に従い、ほぼすべてを **snake_case** で記述します。

### モジュール・構造体ファイル (`.rs`)
- ファイル名、ディレクトリ名ともに **snake_case** を使用します。（例: `map_loader.rs`, `options.rs`, `file_io.rs`）
- Rustコンパイラ自身が推奨するフォーマット(`cargo fmt`準拠)に従います。

---

## その他のディレクトリ名・アセット名
- ディレクトリ名（フォルダ名）は、フロントエンド・バックエンド問わず、一貫して **kebab-case** または **snake_case**（小文字＋ハイフンまたはアンダースコア。基本的にハイフンを推奨）で統一します。
  - 例: `components/ui`, `src-tauri`
- 画像やアイコンなどのアセットファイルも小文字を使用し、単語の区切りにはハイフンかアンダースコアを使用します。（例: `waypoint-icon.png`, `app_logo.svg`）
