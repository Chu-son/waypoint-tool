# 開発者ガイド (Developer Guide)

ROS Waypoint Tool のアーキテクチャおよび機能拡張手順について解説します。

## アーキテクチャ構成
本ツールはTauriを採用し、RustによるバックエンドとReact+PixiJSによるフロントエンドで構成される「疎結合構成」となっています。

- **Frontend (Tauri WebView / UI)**:
  - React/TypeScriptベース (Viteビルド)
  - `src/stores/appStore.ts`: Zustand によるグローバルステート（UI情報, Waypointツリーの管理）
  - `src/components/canvas/MapCanvas.tsx`: PixiJS (WebGL) を活用した高性能な2D描画

- **Backend (Rust Core)**:
  - `src-tauri/src/models/`: Waypoint, Map, Options等のデータ構造定義（構造化・シリアライズ用）
  - `src-tauri/src/commands/`: `tauri::command` マクロを用いたIPCインターフェース。
  - `src-tauri/src/map/`, `io/`: PGM読み込み、JSON/YAML入出力などの各種ロジック

---

## 拡張機能の実装手順 (How to Add Features)

### 1. 新しい「カスタム属性オプション」を追加したい場合
フロントエンドの「Settings」画面にある **Option Schema** タブを操作することで、ユーザー自身でGUIから新しい属性（キー、型、デフォルト値）を動的に追加・編集できるようになっています。追加した属性はInspectorパネルに直ちに反映されます。コードを変更する必要はありません。

### 2. 新しい「ファイルエクスポート形式」を追加したい場合
既存の標準（YAML/JSON/CSV）以外の独自プラットフォーム・ロボット向けフォーマットを出力したい場合。
1. **フロントエンドの「Settings」UI機能**を利用することを推奨します。Settingsパネルの「Export Templates」タブから、Handlebarsテンプレート文字列をGUI上で定義するだけで、即座に新形式でのエクスポートが可能になります（Rust側の再コンパイルは不要です）。
2. Rustの出力コマンドとしてハードコードで追加したい場合は、`src-tauri/src/io/mod.rs` にロジックを追加し、`commands/mod.rs` でフロントエンドから呼び出せるように公開してください。

### 3. 「自動ジェネレータ（矩形パス生成など）」を追加したい場合
1. `src/types/store.ts` の `ObjectNode` に新しいジェネレータ用の `type` や `generatorParams` の定義を追加します。
2. そのパラメータを受け取り、Rust側に送るフロントUIを `PropertiesPanel.tsx` または `ToolPanel.tsx` に追加します。
3. 実際の「複数ポイントの座標群を計算するアルゴリズム」は、フロントエンドで行うか、または計算量が多い（マップの壁や障害物を回避する等）場合は Rust側 (`src-tauri/src/generator/`) に処理を委譲して結果の座標リストだけを受け取る構成にします。

### 4. 2Dキャンバスに表示するUIを追加したい場合
`src/components/canvas/MapCanvas.tsx` 内の `pixiGraphics` 描画ブロックにロジックを追加します。
PixiJSは高速なWebGL描画を行うため、数千ノードまではReactのRe-renderをフックとして描画（`draw={...}` 属性）してもパフィーマンスに影響を与えにくい設計になっています。さらに最適化が必要な場合は、Spriteのバッチ処理やParticle Containerを導入してください。

### 5. UIスタイルを追加・変更したい場合（Tailwind v4）
中規模開発での視認性と統一性を維持するため、フォームや操作系UIは `src/App.css` の共通クラスを優先して使用します。

- 主要クラス
  - 入力系: `ui-input`, `ui-input-sm`, `ui-select`, `ui-select-sm`, `ui-textarea`, `ui-checkbox`, `ui-range`
  - 操作系: `ui-btn`, `ui-btn-sm`, `ui-btn-md`, `ui-btn-primary`, `ui-btn-secondary`, `ui-btn-ghost`, `ui-btn-danger`, `ui-icon-btn`
  - タブ: `ui-tab`, `ui-tab-active`, `ui-tab-inactive`
- 運用ルール
  - 新規画面で同種のUI（input/select/button/tab）を追加する場合は、まず共通クラスで実装します。
  - 画面固有の見た目差分が必要な場合は、共通クラスに必要最小限のユーティリティを追加して調整します。
  - `@apply` では Tailwind 標準ユーティリティのみを使い、独自クラス同士の再適用は行いません（Tailwind v4制約）。
  - プルダウン可読性は `select option` / `datalist option` のベーススタイルで統一されるため、個別コンポーネントでの上書きを避けます。

---

## テストの実装と実行 (Testing)

プロジェクトの品質と保守性を保つため、ロジックの変更・追加時にはテストコードの実装を推奨します。

### フロントエンド (Vitest)
UI以外のロジック（ZustandのStoreやユーティリティ関数など）は、**Vitest** を使用してユニットテストを行います。
対象ファイルと同じディレクトリに `*.test.ts` を作成してください。
```bash
# フロントエンド・テストの実行
npm run test
```

### バックエンド (Rust)
Rust側のデータ処理（マップパース、ファイルI/Oなど）は標準の **Cargo** テスト機構を使用します。
各ファイルの末尾に `#[cfg(test)]` モジュールを作成し、ユニットテストを記述してください（例: `src-tauri/src/io/mod.rs` 内にテストブロックを追加）。
```bash
# バックエンド・テストの実行
cd src-tauri
cargo test
```
