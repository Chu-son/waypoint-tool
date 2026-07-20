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

本ツールは「疎結合な設計」を重視しています。

- **Frontend (Tauri WebView)**: 
  - React + TypeScript
  - 状態管理: **Zustand** (`src/stores/appStore.ts`)
  - 描画エンジン: **PixiJS** (`src/components/canvas/MapCanvas.tsx`)
  - スタイル: **Tailwind CSS v4**
- **Backend (Rust Core)**:
  - ファイル I/O, OS 連携, プラグイン実行。
  - フロントエンドとは Tauri の IPC (Command) で通信。

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
ロジックやコンポーネントの振る舞いをテストします。
```bash
npm run test
```
- `*.test.ts` / `*.test.tsx` を同じディレクトリに作成。

### バックエンド (Rust)
```bash
cd src-tauri
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

### キャンバス浮遊アクションバー (`FloatingActionBanner`)
特定の操作モード（例: 要素コピーモード、領域選択モードなど）でキャンバスエリア左上に浮遊表示されるバナー通知・アクションUIは、共通コンポーネント `FloatingActionBanner` (`src/components/ui/common/FloatingActionBanner.tsx`) を使用して実装します。

#### 特長・レイアウト原則
- **一貫したスタイリング**: ダークガラスモルフィズム (`bg-surface-panel/95 backdrop-blur-md`) とアクセントボーダー。
- **構造の統一**:
  - `icon` & `title` & `subtitle` & `valueDisplay`: 現在のモードと数値を表示。
  - `statusText`: 現在の対象や操作ガイド（例: `🎯 Waypoint [1] に適用中`）を明示。
  - `actions`: ボタン配列（`label`, `variant`, `disabled`, `onClick`）。

#### 使用例
```tsx
<FloatingActionBanner
  icon={<Copy size={16} />}
  title="X コピー中"
  subtitle="World"
  valueDisplay={1.2345}
  statusText={<span>🎯 Waypoint [1] に適用中</span>}
  actions={[
    { label: 'ペースト確定', variant: 'primary', onClick: handleConfirm },
    { label: '完了', variant: 'secondary', onClick: handleClose },
  ]}
/>
```

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

