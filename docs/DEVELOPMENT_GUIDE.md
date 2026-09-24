# 開発者ガイド (Development Guide)

本ドキュメントは、ROS Waypoint Tool のコア開発に携わる開発者およびコントリビューター向けのリファレンスです。

## 1. 開発環境のセットアップ

### 前提条件
- Node.js v18+
- Rust (latest stable)
- Linux の場合: `libwebkit2gtk-4.1-dev`, `build-essential`, `libxdo-dev` 等の Tauri 依存パッケージ。

### セットアップ手順
```bash
git clone <repository-url>
cd waypoint-tool
npm install
```

### 起動
```bash
# Vite + Tauri 開発サーバーの起動
npm run tauri dev
```

## 2. アーキテクチャ

本ツールの構成概要は以下の通りです。ディレクトリ構造、データフロー、およびスライス設計の詳細については [ARCHITECTURE.md](./ARCHITECTURE.md) を参照してください。

- **Frontend (Tauri WebView)**: React + TypeScript (状態管理: Zustand `appStore.ts`, 描画: PixiJS `MapCanvas.tsx`)
- **Backend (Rust Core)**: Tauri IPC 通信, ファイル I/O, プラグインプロセス実行

---

## 3. 命名規則 (Naming Conventions)

一貫性を保つため、以下の規則を厳守してください。

- **Frontend (`src/`)**:
  - React コンポーネント: `PascalCase` (例: `MapCanvas.tsx`)
  - Hooks / Stores / Utils: `camelCase` (例: `appStore.ts`)
  - 共通 UI クラス: Tailwind CSS のユーティリティクラスと `class-variance-authority` (`cva`) を組み合わせて管理します。独自のCSSプレフィックスは使用しません。
- **Backend (`src-tauri/`)**:
  - Rust ファイル・変数・関数: `snake_case` (Rust 標準)

## 4. テスト指針 (Testing)

### フロントエンド (Vitest)
ロジックやコンポーネントの **振る舞い** をテストします。書き方・モック方針・共通ヘルパーは 📖 [TESTING.md](./TESTING.md) を必ず参照してください。
```bash
npm run test           # 型チェック + 全テスト
npm run test:coverage  # カバレッジ付き（閾値あり）
```
- `*.test.ts` / `*.test.tsx` を同じディレクトリに作成。
- ストアはモックせず実物を使う（`src/test/` のヘルパーを利用）。

### 静的解析・フォーマット
```bash
npm run lint           # ESLint（層ルール・循環参照・Hooks 規約）
npm run format         # Prettier で整形
npm run check          # typecheck + lint + format:check + test:coverage（CI と同じ内容）
```
- CI（`.github/workflows/ci.yml`）で PR ごとに上記と Rust の `cargo fmt --check` / `cargo clippy -D warnings` / `cargo test` を実行します。リリースビルドは `.github/workflows/release.yml`（タグ push）が担当します（[バージョン管理とリリース](#バージョン管理とリリース) 参照）。
- 一括整形コミットは `.git-blame-ignore-revs` に登録済みです（`git config blame.ignoreRevsFile .git-blame-ignore-revs`）。

### バックエンド (Rust)
```bash
cd src-tauri
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```
- 各モジュールの末尾にある `#[cfg(test)]` ブロックに記述。

### Python SDK
```bash
cd python_sdk
python3 -m unittest discover tests
```

## 5. コントリビュートの流れ
1. Issue を確認、または作成する。
2. `feature/` または `fix/` ブロックでブランチを作成。
3. 命名規則とテスト指針に従って実装。
4. プルリクエストを作成し、レビューを受ける。

### バージョン管理とリリース

#### アプリ本体のバージョン

アプリのバージョンの正（Single Source of Truth）は **`package.json` の `version`** です。以下は `npm run version:bump` で同期されます。

| ファイル | 備考 |
|---|---|
| `package.json` | 正。`src-tauri/tauri.conf.json` の `version` は `"../package.json"` でこれを参照（インストーラ名・About 表示に反映） |
| `package-lock.json` | 2 箇所（ルートと `packages[""]`） |
| `src-tauri/Cargo.toml` / `Cargo.lock` | `CARGO_PKG_VERSION`（タイル取得の User-Agent）に使用 |

```bash
npm run version:bump -- 0.1.0   # 上記をまとめて更新
npm run version:check           # ファイル間の一致を検証（不一致なら exit 1）
npm run version:check v0.1.0    # タグ名との一致も検証
```

- SemVer（`X.Y.Z`）。1.0 未満は機能追加で MINOR、修正で PATCH を上げる。プレリリースは `0.2.0-rc.1` のようにハイフン付き。
- 手で個別のファイルのバージョンを書き換えず、必ずスクリプトを使うこと。

#### 独立してバージョニングするもの（アプリ版とは連動させない）

| 対象 | 場所 | 上げるタイミング |
|---|---|---|
| Python SDK | `python_sdk/wpt_plugin/__init__.py` の `__version__` | SDK の公開 API を変更したとき（同梱 SDK との差分表示に使用） |
| 各プラグイン | 各 `manifest.json`（Rust プラグインは `Cargo.toml` も） | そのプラグインを変更したとき（依存解決 `dependencyResolver.ts` が参照） |
| プロジェクトファイル形式 | `projectSerializer.ts` の `version`（整数） | 保存形式に後方互換のない変更をしたとき。※現状、読込時の検査・マイグレーションは未実装 |
| クリップボード形式 | `mapElementClipboard.ts` の `MAP_ELEMENT_CLIPBOARD_VERSION` | 内部形式を非互換に変更したとき |

#### リリース手順

1. `develop` で `npm run version:bump -- X.Y.Z` を実行し、PR で `main` へマージ。
2. `main` で `git tag vX.Y.Z && git push origin vX.Y.Z`。
3. `.github/workflows/release.yml` が起動し、タグと各ファイルのバージョン一致を検証したうえで Windows（`.msi` / NSIS `.exe`）と Ubuntu（`.deb` / `.AppImage` / `.rpm`）をビルドし、**ドラフト** Release に添付する。
4. GitHub の Releases でドラフトの内容を確認して Publish する。ハイフン付きタグは prerelease として作成される。

Actions タブから `workflow_dispatch` で手動実行することもできる（ファイル間の一致のみ検証し、ドラフト Release `vX.Y.Z` を作成）。コード署名は行っていないため、Windows では SmartScreen の警告が表示される。

## 6. キャンバスイベントの取り扱い (PixiJS & React)

PixiJS のキャンバスと React の DOM イベント間での「イベントバブリング」による二重処理を防ぐため、以下のルールを厳守してください。

- PixiJS の要素（`onPointerDown` 等）でイベントを捕捉し、そのイベントを背後のコンテナ（ReactのDOM側）に伝播させたくない場合は、単なる `e.stopPropagation()` だけでなく、**必ずネイティブイベントの伝播も停止させる**必要があります。
- 修正例:
  ```typescript
  onPointerDown={(e) => {
    e.stopPropagation(); // PixiJS内部の伝播を停止
    if (e.nativeEvent && typeof (e.nativeEvent as any).stopPropagation === 'function') {
      (e.nativeEvent as any).stopPropagation(); // React/DOMへの伝播を停止
    }
    // ... 処理 ...
  }}
  ```
- React側の `onPointerDown` ハンドラでも、他のインタラクション状態 (`interactionMode.current === 'none'`) を確認してから新規要素を作成するように防御的実装を心がけてください。

## 7. 汎用 UI パターン (UI Design Patterns)

キャンバス上部に表示される一時操作バナー `FloatingActionBanner` や各種 UI コンポーネントの一覧および詳細仕様については、[COMPONENT_CATALOG.md](./COMPONENT_CATALOG.md) を参照してください。

## 8. 座標変換と Math ユーティリティ (Transform & Coordinate Systems)

Waypoint やアンカー設定に伴う Quaternion, Yaw, 相対座標計算は `src/utils/transformUtils.ts` に集約しています。

### 主要関数

- **`quaternionToYaw(transform)`**:
  Transform オブジェクト（`qx, qy, qz, qw`）から Z 軸まわりの回転角 Yaw (rad) を返します。
- **`yawToQuaternion(yaw)`**:
  Yaw 角 (rad) から Z 軸回転の Quaternion オブジェクトを返します。
- **`calculateAnchorRelativeTransform(targetTransform, anchorTransform)`**:
  アンカーノードの Transform を基準（回転角 Yaw）とした、ターゲットノードの相対位置 (`relX, relY, relZ, relYaw`) を算出します。

#### 相対座標の算出式
アンカー位置 $(A_x, A_y, A_z)$、アンカー角度 $\theta_A$ に対し、対象位置 $(T_x, T_y, T_z)$ のアンカーローカル相対座標 $(R_x, R_y, R_z)$ は次式で計算します：

$$
\begin{pmatrix} R_x \\ R_y \end{pmatrix} =
\begin{pmatrix} \cos\theta_A & \sin\theta_A \\ -\sin\theta_A & \cos\theta_A \end{pmatrix}
\begin{pmatrix} T_x - A_x \\ T_y - A_y \end{pmatrix}
$$

$$R_z = T_z - A_z, \quad R_{yaw} = \text{normalize}(\theta_T - \theta_A)$$

