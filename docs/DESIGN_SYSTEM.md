# デザインシステム & コンポーネント設計方針

本ドキュメントは、ROS Waypoint ToolにおけるUIコンポーネントの設計、スタイリング、および共通部品の作成基準を定義するデザインシステムガイドラインです。開発時やリファクタリング時は必ず本方針に準拠してください。

---

## 1. ディレクトリ構造ルール

UI関連のコンポーネントは `src/components/ui/` に配置し、役割と再利用性に応じて以下のように整理します。詳細なファイル一覧は、常にコードの実体を参照してください。

```
src/components/ui/
├── common/         # アプリ横断で使う汎用UI部品（2ファイル以上で共通利用）
├── settings/       # SettingsModal タブ専用コンポーネント群
├── properties/     # PropertiesPanel 専用コンポーネント群
└── *.tsx           # パネル、トップメニュー、モーダルなど大きな単一画面部品
```

### 配置の判断基準

| 条件 | 配置先 |
|---|---|
| 2ファイル以上で共通利用される汎用UI | `common/` に新規作成 |
| 特定の機能領域（Settings等）のみで使う中間部品 | `settings/`, `properties/` 等の該当ディレクトリ内に追加 |
| 1ファイル内でしか使わない末端要素 | そのファイル内のローカルコンポーネントとして定義（export しない） |

---

## 2. スタイリングルール

### 基本方針
Tailwind CSSのクラス文字列を直接JSXに長く書くことは、可読性を著しく下げるため避けてください。

* **`cva` (class-variance-authority)**: バリアント（primary/secondary/danger等）やサイズ（sm/md/lg等）の組み合わせを多く持つコンポーネントに使用します（例: `Button`, `Panel`）。
* **`cn()` ユーティリティ**: 単純なラッパーや、状態に応じた条件付きクラスの結合に使用します（例: `Input`, `Label`, `FormField`）。
* **インラインクラスの制限**: 1〜2クラス程度のレイアウト微調整（例: `mt-2`, `w-full`）を除き、複雑なスタイル指定をJSX内にインラインで大量記述（インラインクラス直書き）することを禁止します。

```tsx
// ❌ 禁止: 長いインラインクラス（可読性が低く、再利用できない）
<div className="bg-surface-panel/40 backdrop-blur-sm border border-border-base/30 rounded-lg p-4 shadow-subtle hover:border-border-base/60 transition-all group overflow-hidden relative">

// ✅ 推奨: 意味を持つコンポーネントに切り出す、あるいは適切なラッパーを使用する
<LayerCard> ... </LayerCard>
```

---

## 3. デザイントークン使用ガイド（Raw Tailwindカラー禁止）

> [!CAUTION]
> `slate-*`, `blue-*`, `gray-*` などの **Raw Tailwind カラーを UI コンポーネントに直接指定することを禁止**します。テーマの切り替え時に色が追従しなくなります。

必ず以下の対応表に基づき、セマンティックなデザイントークンを使用してください。

### カラートークン対応表 (Dark & Light)

| 用途 | ✅ デザイントークン | Linear Dark 値 | Linear Light 値 | ❌ Raw Tailwind（禁止例） |
|---|---|---|---|---|
| 基本テキスト | `text-text-base` | `#f7f8f8` | `#17171a` (Deep Charcoal) | `text-slate-200`, `text-white` |
| サブテキスト・ラベル | `text-text-muted` | `#8a8f98` | `#686b74` (Medium Grey) | `text-slate-400`, `text-gray-400` |
| 反転テキスト (ボタン等) | `text-text-inverse` | `#ffffff` | `#ffffff` | `text-black` |
| 背景（ベース/キャンバス） | `bg-surface-base` | `#090a0c` (Charcoal Black) | `#f7f8f9` (Off-white) | `bg-slate-900` |
| 背景（パネル/モーダル） | `bg-surface-panel` | `#121316` (Deep Charcoal) | `#ffffff` (Pure White) | `bg-slate-800`, `bg-gray-800` |
| ホバー背景 | `bg-surface-hover` | `rgba(255, 255, 255, 0.05)` | `#f0f1f4` (`rgba(0,0,0,0.04)`) | `bg-slate-700` |
| ボーダー | `border-border-base` | `rgba(255, 255, 255, 0.08)` | `#e2e4e8` (`rgba(0,0,0,0.08)`) | `border-slate-700`, `border-slate-800` |
| フォーカス枠線 | `border-border-focus` | `#5e6ad2` | `#5e6ad2` | `border-blue-500` |
| プライマリカラー | `text-primary-base`, `bg-primary-base` | `#5e6ad2` (Linear Indigo) | `#5e6ad2` (Linear Indigo) | `text-blue-500`, `bg-blue-600` |
| プライマリホバー | `bg-primary-hover` | `#6f7be8` (明るく) | `#4b55c0` (深く・暗く) | `bg-blue-700` |
| プライマリ半透明 | `bg-primary-base/10`, `bg-primary-base/20` | `rgba(94, 106, 210, 0.1~0.2)` | `rgba(94, 106, 210, 0.1~0.2)` | `bg-blue-900/50` |
| 危険操作（削除等） | `text-danger-base`, `bg-danger-base` | `#b91c1c` / `#ef4444` | `#dc2626` | `text-red-500` |
| アンカー・グループ | `text-accent-anchor`, `bg-accent-anchor` | `#fbbf24` | `#d97706` | `text-amber-400`, `bg-amber-950/20` |
| プラグイン・生成ノード | `text-accent-generator`, `bg-accent-generator` | `#34d399` | `#059669` | `text-emerald-400`, `bg-emerald-500/20` |
| リファレンスレイヤー | `text-accent-reference`, `bg-accent-reference` | `#c084fc` | `#7c3aed` | `text-purple-400`, `bg-purple-500/20` |
| 自動化・スクリプト | `text-accent-automation`, `bg-accent-automation` | `#22d3ee` | `#0891b2` | `text-cyan-400`, `bg-cyan-500/20` |
| 成功ステータス | `text-status-success`, `bg-status-success` | `#10b981` | `#16a34a` | `text-emerald-500` |
| 警告ステータス | `text-status-warning`, `bg-status-warning` | `#f59e0b` | `#d97706` | `text-amber-500` |
| 占有グリッド (Free) | `text-occupancy-free`, `bg-occupancy-free` | `#34d399` | `#059669` | `text-emerald-400` |
| 占有グリッド (Obstacle) | `text-occupancy-obstacle`, `bg-occupancy-obstacle` | `#fb7185` | `#e11d48` | `text-rose-400` |
| 占有グリッド (Unknown) | `text-occupancy-unknown`, `bg-occupancy-unknown` | `#c084fc` | `#7c3aed` | `text-purple-400` |

### Linear Light Theme 設計原則
1. **ブランドカラーの共通化**: ダーク・ライト共通で `primaryBase: #5e6ad2` (Linear Indigo) を基軸とし、ツール全体の統一感を担保します。
2. **ホバーの反転設計**: ダークモードでは明るく変化（`#6f7be8`）させるのに対し、ライトモードでは白背景上での押し込み感と視認性を保つため**一段深く（暗く: `#4b55c0`）**します。
3. **計算されたオフホワイト階層**: 眩しさを抑え長時間の作業負荷を軽減するため、キャンバス基底に `#f7f8f9`、浮き上がるパネルに純白 `#ffffff`、静かなホバーに `#f0f1f4` を採用。
4. **深いチャコールブラック**: 生の純黒（`#000000`）を避け、`#17171a`（ベーステキスト）および `#686b74`（ミューテッド）で洗練された高級感と高コントラストを両立。
5. **テーマ切り替えと永続化**: SettingsModal（General タブ）のテーマセレクターから即座に Dark / Light の切り替えが可能であり、Zustand の `persist` ミドルウェアによってローカルストレージへ安全に永続化されます。
6. **アクセントテーマ自由選択**: ライトモード時もダークモードと同様に各アクセントカラー（Indigo, Emerald, Ocean, Amber, Purple, Midnight）を自由に選択可能です。Linear Light のクリーンな白・オフホワイト階層と、各色に対応したコントラスト最適化済みのホバー色（例: Emerald では `#059669`）が自動合成されます。
7. **CAD / RViz 方式の高コントラストキャンバス**: UIがライトモードであっても、ROS 2D占有グリッドマップ（空き領域が白 254）や明るいウェイポイントの視認性を最大化するため、キャンバス描画領域は常に視認性の高いダークチャコール（`CANVAS_SURFACE_BASE` = `#090a0c`）を維持します（CAD・RViz・Foxglove・Blender方式）。

---

## 4. Linear Style ガイドライン (デスクトップ高密度・角丸・タイポグラフィ)

本プロジェクトのUIは **Linear Style**（精密で落ち着いたプロフェッショナルなダークテーマツール感）に準拠します。

### ① デスクトップ高密度 (32px Desktop Density)
一般的なWebアプリの 40px/48px スケールではなく、**32px を基準とするデスクトッププロフェッショナルスケール**を採用します。

| 要素 | 基本 (`default`) | 小型 (`sm`) | 極小 (`xs` / `icon-sm`) |
|---|---|---|---|
| ボタン (`Button`) | `h-8 px-3 text-[13px] rounded-md` | `h-7 px-2.5 text-xs rounded-md` | `h-6 px-2 text-[11px] rounded` |
| アイコンボタン | `h-8 w-8 rounded-md` | `h-7 w-7 rounded-md` | `h-6 w-6 rounded` |
| 入力欄 (`Input`) | `h-8 px-2.5 text-[13px] rounded-md` | `h-7 px-2 text-xs rounded-md` | - |
| セレクト (`Select`) | `h-8 px-2.5 text-[13px] rounded-md` | `h-7 px-2 text-xs rounded-md` | - |
| 参照入力 (`BrowseInput`) | `h-8 text-[13px]` | `h-7 text-xs` | - |

### ② 角丸階層ルール (Border Radius Hierarchy)
> [!CAUTION]
> **`rounded-2xl` 以上の過度な角丸は全面禁止**です（モバイルアプリ的なバブル感を排除し、ソリッドで洗練された印象を維持するため）。

- **`rounded-md` (6px)**: ボタン、入力欄、セレクト、ツールバーアイテム、ツリービュー項目、Kbdバッジ
- **`rounded-lg` (8px)**: パネル内カード（`OptionCard`, `LayerCard` 等）、ドロップダウンポップオーバー、サブグループ枠
- **`rounded-xl` (12px)**: フローティングアクションバナー（`FloatingActionBanner`）、モーダルダイアログ（`Modal`）、全画面オーバーレイ枠

### ③ タイポグラフィ & フォントフィーチャー
- フォントスタック: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;` (`@fontsource/inter` バンドル)
- CSS `font-feature-settings`: `"cv02", "cv03", "cv04", "cv11", "tnum"`
  - `tnum`（等幅数字）により、座標値や角度、インデックスのリアルタイム変化に伴うUIの横揺れを防止。
  - `cv02`, `cv03`, `cv04`, `cv11` により、Interの文字判別性（小文字 `l` と数字 `1`、数字 `0` とアルファベット `O` など）を最大化。

### ④ 絵文字の全面禁止と Lucide React アイコン統一
> [!CAUTION]
> UIラベル、ボタン、リスト項目内で **OS絵文字（`🎯`, `⚓`, `📁`, `📍`, `⚙️` 等）を直接使用することは全面禁止**です。OSやプラットフォームによって色や形状が乖離し、デザインシステムの一貫性を損ねます。

- 目的・用途に応じた Lucide React アイコン（`<Target />`, `<Anchor />`, `<Folder />`, `<MapPin />`, `<Layers />` 等）を必ず使用してください。
- ツールチップが必要なアイコンには `<span title="説明"><Icon size={14} /></span>` のように親要素で `title` を付与します。

### ⑤ ショートカットキー表記 (`<Kbd>`)
- キーボードショートカットのキーキャップ表示には、生テキスト（`"Esc"`, `"[Shift]"`）やローカル `<kbd>` を使わず、共通コンポーネント [`<Kbd>`](file:///home/chuson/develop/waypoint-tool/src/components/ui/common/Kbd.tsx) を使用してください。
- 例: `<Kbd>Esc</Kbd>`, `<Kbd>Ctrl</Kbd><Kbd>Z</Kbd>`

### ⑥ PixiJS キャンバスデザイン定数 (`canvasConstants.ts`)
キャンバスレイヤー側の描画色も UI デザイントークンと厳密に同期させるため、[`canvasConstants.ts`](file:///home/chuson/develop/waypoint-tool/src/components/canvas/canvasConstants.ts) で定義された共通定数を使用してください。

- `CANVAS_ACCENT_COLOR` (`0x5e6ad2` / `#5e6ad2`): 選択状態、矩形選択枠、スナップガイド、回転ハンドル
- `CANVAS_SURFACE_BASE` (`0x090a0c` / `#090a0c`): キャンバス描画領域の背景。ライトモード時もCAD・RVizプロツール同様に高コントラストを維持するためダークチャコールが適用されます。
- `CANVAS_PREVIEW_COLOR` (`0x8a8f98` / `#8a8f98`): 生成プレビューや下書き状態
- キャンバスレイヤー内でのハードコード色（`0x3b82f6` や `0x1e293b` 等）の直書きは禁止です。

---

## 5. コンポーネントAPI設計ルール

### ① `className` Props の伝搬
すべての共通コンポーネントおよび再利用コンポーネントは、呼び出し側からレイアウト調整ができるよう `className` を props として受け取り、内部クラスと `cn()` で結合してください。

```tsx
interface EmptyStateProps {
  message: string;
  className?: string;
}

export function EmptyState({ message, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "text-center py-8 px-4 text-text-muted/70 text-xs bg-surface-panel/20 rounded-lg border border-border-base",
        className
      )}
    >
      {message}
    </div>
  );
}
```

### ② `forwardRef` の適用
HTMLのネイティブ要素（`<input>`, `<select>`, `<button>`等）をラップする最小粒度コンポーネントは、Reactの `React.forwardRef` を使用して `ref` を正しく伝搬させてください。

```tsx
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "w-full rounded-md border border-border-base bg-surface-base px-2.5 h-8 text-[13px] text-text-base outline-none transition-colors focus:border-border-focus focus:ring-1 focus:ring-border-focus/30 disabled:cursor-not-allowed disabled:opacity-60",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
```

### ③ 複数バリエーションを持つ場合の `cva` 定義
外観に多くのバリエーションが存在する（`variant` や `size` 等）場合は、`class-variance-authority` を使用して定義します。

```tsx
import { cva } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-all focus:outline-none focus:ring-1 focus:ring-border-focus/40 disabled:opacity-50 disabled:pointer-events-none select-none",
  {
    variants: {
      variant: {
        primary: "bg-primary-base text-text-base hover:bg-primary-hover active:bg-primary-active border border-primary-hover/30 shadow-sm",
        secondary: "bg-surface-panel border border-border-base text-text-base hover:bg-surface-hover hover:border-border-base/80 shadow-sm",
        ghost: "text-text-muted hover:text-text-base hover:bg-surface-hover",
        danger: "bg-danger-base text-text-base hover:bg-danger-hover border border-danger-hover/30 shadow-sm",
        outline: "border border-border-base text-text-base hover:bg-surface-hover",
      },
      size: {
        default: "h-8 px-3 text-[13px]",
        sm: "h-7 px-2.5 text-xs",
        xs: "h-6 px-2 text-[11px] rounded",
        icon: "h-8 w-8 p-0 shrink-0",
        "icon-sm": "h-7 w-7 p-0 shrink-0",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "default",
    },
  }
);
```

---

## 6. 新規UI作成・リファクタリングのチェックリスト

コンポーネントを新規作成またはリファクタリングする際は、以下のステップに従ってください。

1. **共通部品の有無を確認**: `src/components/ui/common/` に同等の部品が存在しないか確認する。
2. **デザイントークン遵守**: ハードコードされた色（`text-white`, `bg-slate-800` 等）がないかチェックする。
3. **インラインスタイルの排除**: `style={{ ... }}` によるレイアウト指定を避け、Tailwindクラスまたは `cva` に集約する（動的な座標・サイズ計算を除く）。
4. **アクセシビリティ & キーボード操作**: ボタンには適切な `title` や `aria-label` を付与し、フォーカスリング（`focus:ring-2`）を担保する。
5. **Storybook/カタログ更新**: 作成したコンポーネントの役割を [`docs/COMPONENT_CATALOG.md`](./COMPONENT_CATALOG.md) に追記する。

---

## 7. 既存共通コンポーネント（`common/`）の積極活用

以下のパターンではインラインの `<div className="...">` を使わず、必ず `common/` 内の既存コンポーネントを適用してください。

| パターン | 使用する `common/` コンポーネント |
|---|---|
| フォーム項目（ラベル＋入力要素の並び） | `FormField`, `InlineFieldRow`, `LabeledNumericInput` |
| セクションタイトル・大文字見出し | `FieldLabel`, `SectionDivider` |
| 警告・エラー・情報メッセージ枠 | `AlertBox` (variant: info, warning, danger) |
| 空データ・選択なし状態の表示 | `EmptyState` |
| ファイル・ディレクトリ参照入力 | `BrowseInput` |
| トグルスイッチ | `ToggleSwitch` |
| キーボードショートカット・キーキャップ表示 | `Kbd` |

```tsx
// ❌ 悪い例: div とインラインクラスによる命令的記述
<div className="space-y-1">
  <span className="text-xs font-bold text-text-muted uppercase tracking-widest block">Output Path</span>
  <div className="flex gap-2">
    <input className="w-full rounded border border-border-base bg-surface-base px-3 py-2 text-sm" value={path} readOnly />
    <button className="px-3 py-2 bg-surface-panel border rounded text-xs">Browse</button>
  </div>
</div>

// ✅ 良い例: common/ 部品を活用した宣言的記述
<FormField label="Output Path">
  <BrowseInput value={path} onBrowse={handleBrowse} />
</FormField>
```

---

## 8. レスポンシブ & アダプティブ設計ガイドライン

本アプリケーションはデスクトップ（Tauri）上で動作し、左右のサイドパネル（左 180〜600px、右 200〜800px）が開閉・リサイズされるため、中央キャンバス領域の有効幅が動的に大きく変化します（約 300px 〜 2500px+）。

すべてのUIコンポーネントは、以下の5大原則およびカテゴリ別設計方針・注意点に準拠してください。

### ① レスポンシブ設計の5大原則

1. **コンテナ幅動的監視 (Container-Relative Responsive / `useResponsiveContainer`)**:
   - ビューポート幅（`100vw`）メディアクエリ（`md:`, `xl:` 等）は、ウィンドウ全体の解像度のみに反応し、左右パネル開閉に伴う中央キャンバスの狭小化を検知できません。
   - 中央キャンバス上のUIは、共通フック `useResponsiveContainer` を用いて**親コンテナ（中央キャンバス `parentElement`）の実際の利用可能幅（px）を動的に監視**し、以下の3段階ティアで表示を切り替えてください：
     - **`compact` (幅 < 800px / パネル展開時・狭画面)**: **完全アイコンのみ表示**（テキスト完全非表示、28x28px 正方形ボタン）、タイトル短縮、不要なラベル非表示。
     - **`normal` (幅 800px 〜 1080px)**: 短縮テキスト（例: `Point`, `Oriented`, `Line`）。
     - **`wide` (幅 >= 1080px)**: フルテキスト（例: `丸 (Point)`, `三角 (Oriented)`）。
2. **単一行（`flex-nowrap`）の徹底と縦折り返し禁止**:
   - 単一行フローティングバー（`FloatingActionBanner` 等）内で子コンテナに `flex-wrap` を指定してはなりません（複数行に折り返された要素と縦中央配置 `items-center` の決定ボタンが上下・左右で直接重なるため）。
   - 必ず `flex-nowrap` で統一し、各要素に `shrink-0` を適用した上で、幅が不足した場合は `overflow-x-auto` による安全な横スクロールを行わせてください。
3. **重要アクションの可視性保証 (Guaranteed Action Visibility)**:
   - 「完了」「確定」「削除」などの決定アクションボタン群には必ず `flex-shrink-0 ml-auto` を付与し、どんなに狭い画面幅でも操作完了ボタンが画面外に押し出されないようにしてください。
4. **`min-w-0` と `truncate` の徹底**:
   - `flex` アイテム（テキストや入力欄）は、デフォルトで `min-width: auto` となるため横にはみ出しやすい。必ず `min-w-0` を付与し、長い文字列には `truncate`（または `break-words`）を適用してください。
5. **ポップオーバー・ドロップダウン親コンテナの `overflow` 禁則事項**:
   - `TopMenu` やドロップダウンメニュー、コンテキストメニューなど、親コンテナの下や外側にポップオーバーを展開するUIコンポーネントの親要素には、絶対に `overflow-hidden` や `overflow-x-auto` を設定してはなりません（展開されたメニューが親境界でクリップされ開かなくなるため）。

---

### ② フローティングオーバーレイ設計方針 (Floating Overlays)

`FloatingActionBanner` や各種編集モード用オーバーレイ（アノテーション・マップ編集・エレメントコピー等）は以下を満たすこと：

```tsx
// ✅ 推奨パターン: useResponsiveContainer による動的ティア連動
export function CustomEditOverlay() {
  const { containerRef, isCompact, isWide } = useResponsiveContainer<HTMLDivElement>({
    compact: 800,
    normal: 1080,
  });

  return (
    <FloatingActionBanner
      ref={containerRef}
      icon={<EditIcon size={16} />}
      title={isCompact ? '編集' : 'オブジェクト編集モード'}
      subtitle={isCompact ? undefined : 'ドラッグまたはクリックで配置'}
      statusText={
        <div className="flex items-center gap-1.5 px-1 flex-nowrap shrink-0">
          <div className="flex items-center gap-0.5 bg-surface-base/60 p-0.5 rounded-lg border border-border-base/30 flex-shrink-0">
            {tools.map((t) => (
              <Button
                key={t.id}
                size="sm"
                className={`h-7 text-xs ${isCompact ? 'w-7 p-0 justify-center' : 'px-2 gap-1'}`}
                title={t.label}
              >
                {t.icon}
                {!isCompact && <span>{isWide ? t.label : t.shortLabel}</span>}
              </Button>
            ))}
          </div>
        </div>
      }
      actions={[
        {
          label: '完了',
          icon: <Check size={14} />,
          variant: 'primary',
          onClick: handleDone,
        },
      ]}
    />
  );
}
```

---

### ③ サイドパネル内UI・ツリーリスト設計方針 (Panels & Tree Items)

- パネル幅は 180px まで狭められるため、パネル内のリストアイテムやプロパティ項目は固定幅（`w-[300px]` など）を持たせず、`w-full min-w-0` で伸縮させること。
- **ツリーリスト行（`AnnotationTree`, `WaypointTree` 等）の重なり防止**:
  - 行コンテナ: `group relative flex items-center justify-between gap-1 py-1.5 pr-1.5 rounded-lg text-xs overflow-hidden`
  - 左側コンテンツ領域: `flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden`
  - 名前テキスト: `truncate min-w-0 flex-1 font-medium text-text-base`
  - バッジ類: 狭幅パネルでは非表示または短縮（`hidden xs:inline-block sm:inline-block`）
  - 右側操作ボタングループ: `flex items-center gap-0.5 shrink-0 ml-1`
  - インデントパディングのクランプ: 深い階層でも文字領域を確保するため、`style={{ paddingLeft: `${Math.min(depth * 10 + 6, 32)}px` }}` などで最大インデント幅を制限すること。

---

### ④ モーダル設計方針 (Modals)

- モーダル全体は `w-[90vw] max-w-* max-h-[90vh] flex flex-col` を基本とし、ヘッダー・フッターを固定、コンテンツ領域のみを `overflow-y-auto flex-1` とすること。
- モーダルコンテンツのパディングは固定値（`p-8`）を避け、レスポンシブクラス（`p-4 sm:p-6 md:p-8`）を使用すること。
- サイドバー付きモーダル（`SettingsModal` 等）は、狭画面でサイドバーとコンテンツが無理なく収まるようにサイドバー幅を `w-40 sm:w-52 md:w-56`、タブボタンを `truncate` に対応させること。

---

## 6. 新規カラーテーマ追加規約 (Linear Style Theme Authoring Guide)

今後開発者やユーザーが新しいテーマを追加・提案する際は、以下の**「Linear Style 5つの黄金律」**に必ず準拠してください。

### 新テーマ追加のための 5 つの黄金律

1. **基底サーフェス彩度制限律 (Saturation < 5%)**:
   - `surfaceBase` と `surfacePanel` は彩度 (Saturation) を 5% 未満のディープチャコール (明度 3〜8%) に抑えること。画面全体が原色に染まる「ネオンテーマ」やベタ塗りカラー背景は禁止します。
2. **文字ニュートラル不変律 (Neutral Text Invariance)**:
   - `textBase` (`#f7f8f8`) および `textMuted` (`#8a8f98`) はすべてのダークテーマで同一のニュートラル値を保つこと。テーマのアクセントカラーを本文テキストに着色（緑文字、紫文字など）してはなりません。
3. **1px ヘアライン半透明枠線律**:
   - `borderBase` は原則透過アルファ `rgba(255, 255, 255, 0.08)` を使用し、太いベタ塗り枠線や高彩度の枠線を避けること。
4. **アクセントコントラスト律 (WCAG AA 準拠)**:
   - `primaryBase` は `surfaceBase` に対して十分なコントラスト比（4.5:1 以上）を持つこと。ホバー状態はダークモードでは明度を持ち上げ、ライトモードでは明度を深める（暗くする）こと。
5. **キャンバス・PixiJS 整合性**:
   - キャンバス描画領域の背景色は、ROSマップ（白領域=254）とのハイコントラストを担保するため常にダークチャコール（`CANVAS_SURFACE_BASE` = `0x090a0c`）を維持します（CAD・RViz方式。`customUiConfig` で明示的に `surfaceBase` が指定された場合を除く）。選択枠・ハンドルは `primaryBase` と調和させること。

### 確定プリセット一覧表

| プリセット名 | 表示名 | メイン色 (Primary) | ホバー色 (Hover) | 基底背景 (surfaceBase) | パネル背景 (surfacePanel) | 枠線 (borderBase) |
|---|---|---|---|---|---|---|
| **`default`** | Linear Indigo | `#5e6ad2` | `#6f7be8` | `#090a0c` | `#121316` | `rgba(255, 255, 255, 0.08)` |
| **`emerald`** (`roomba`) | Emerald | `#10b981` | `#34d399` | `#080c0a` | `#101512` | `rgba(255, 255, 255, 0.08)` |
| **`ocean`** | Ocean | `#0ea5e9` | `#38bdf8` | `#080a0f` | `#0f131a` | `rgba(255, 255, 255, 0.08)` |
| **`amber`** | Amber | `#f59e0b` | `#fbbf24` | `#0c0a09` | `#161311` | `rgba(255, 255, 255, 0.08)` |
| **`purple`** | Purple | `#8b5cf6` | `#a78bfa` | `#09080e` | `#121018` | `rgba(255, 255, 255, 0.08)` |
| **`midnight`** | Midnight (OLED) | `#06b6d4` | `#22d3ee` | `#000000` | `#0c0c0d` | `rgba(255, 255, 255, 0.08)` |
| **`light`** | Linear Light | `#5e6ad2` | `#4b55c0` | `#f7f8f9` | `#ffffff` | `#e2e4e8` |

### テーマ追加時のチェックリスト
- [ ] `src/utils/themePresets.ts` の `THEME_PRESETS` に定義を追加したか
- [ ] ダークテーマの場合、`DARK_THEME_PRESETS` メタデータ配列に項目を追加したか
- [ ] `textBase` は `#f7f8f8`、`textMuted` は `#8a8f98` に保たれているか
- [ ] `borderBase` は `rgba(255, 255, 255, 0.08)` に設定されているか
- [ ] `src/utils/themePresets.test.ts` でテストを追加・実行したか

