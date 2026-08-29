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
<div className="bg-surface-panel/40 backdrop-blur-sm border border-border-base/30 rounded-2xl p-4 shadow-subtle hover:border-border-base/60 transition-all group overflow-hidden relative">

// ✅ 推奨: 意味を持つコンポーネントに切り出す、あるいは適切なラッパーを使用する
<LayerCard> ... </LayerCard>
```

---

## 3. デザイントークン使用ガイド（Raw Tailwindカラー禁止）

> [!CAUTION]
> `slate-*`, `blue-*`, `gray-*` などの **Raw Tailwind カラーを UI コンポーネントに直接指定することを禁止**します。テーマの切り替え時に色が追従しなくなります。

必ず以下の対応表に基づき、セマンティックなデザイントークンを使用してください。

### カラートークン対応表

| 用途 | ✅ デザイントークン | ❌ Raw Tailwind（禁止例） |
|---|---|---|
| 基本テキスト | `text-text-base` | `text-slate-200`, `text-white` |
| サブテキスト・ラベル | `text-text-muted` | `text-slate-400`, `text-gray-400` |
| 背景（パネル） | `bg-surface-panel` | `bg-slate-800`, `bg-gray-800` |
| 背景（ベース） | `bg-surface-base` | `bg-slate-900` |
| ホバー背景 | `bg-surface-hover` | `bg-slate-700` |
| ボーダー | `border-border-base` | `border-slate-700`, `border-slate-800` |
| プライマリカラー | `text-primary-base`, `bg-primary-base` | `text-blue-500`, `bg-blue-600` |
| プライマリホバー | `bg-primary-hover` | `bg-blue-700` |
| プライマリ半透明 | `bg-primary-base/10`, `bg-primary-base/20` | `bg-blue-900/50` |
| 危険操作（削除等） | `text-danger-base`, `bg-danger-base` | `text-red-500` |
| アンバー（アンカー関連） | `text-amber-400`, `bg-amber-950/20` | （アンカー状態の表現のみ使われる場合） |
| エメラルド（プラグイン・生成関連） | `text-emerald-400`, `bg-emerald-500/20` | （生成ノードの表現のみ使われる場合） |

---

## 4. コンポーネントAPI設計ルール

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
        "text-center py-12 text-text-muted/60 text-sm bg-surface-panel/30 rounded-2xl border-2 border-dashed border-border-base/40 animate-pulse",
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
          "w-full rounded border border-border-base bg-surface-base px-3 py-2 text-sm text-text-base outline-none transition-colors focus:border-border-focus focus:ring-2 focus:ring-border-focus/20 disabled:cursor-not-allowed disabled:opacity-60",
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
  "inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-primary-base/20 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-primary-base text-white hover:bg-primary-hover shadow-lg shadow-primary-base/20",
        secondary: "bg-surface-panel border border-border-base text-text-base hover:bg-surface-hover",
        ghost: "text-text-muted hover:text-text-base hover:bg-surface-hover/50",
        danger: "bg-danger-base text-white hover:bg-danger-hover shadow-lg shadow-danger-base/20",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        icon: "h-10 w-10",
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

## 5. 新規UI作成・リファクタリングのチェックリスト

コンポーネントを新規作成またはリファクタリングする際は、以下のステップに従ってください。

1. **共通部品の有無を確認**: `src/components/ui/common/` に同等の部品が存在しないか確認する。
2. **デザイントークン遵守**: ハードコードされた色（`text-white`, `bg-slate-800` 等）がないかチェックする。
3. **インラインスタイルの排除**: `style={{ ... }}` によるレイアウト指定を避け、Tailwindクラスまたは `cva` に集約する（動的な座標・サイズ計算を除く）。
4. **アクセシビリティ & キーボード操作**: ボタンには適切な `title` や `aria-label` を付与し、フォーカスリング（`focus:ring-2`）を担保する。
5. **Storybook/カタログ更新**: 作成したコンポーネントの役割を [`docs/COMPONENT_CATALOG.md`](./COMPONENT_CATALOG.md) に追記する。

---

## 6. 既存共通コンポーネント（`common/`）の積極活用

以下のパターンではインラインの `<div className="...">` を使わず、必ず `common/` 内の既存コンポーネントを適用してください。

| パターン | 使用する `common/` コンポーネント |
|---|---|
| フォーム項目（ラベル＋入力要素の並び） | `FormField`, `InlineFieldRow`, `LabeledNumericInput` |
| セクションタイトル・大文字見出し | `FieldLabel`, `SectionDivider` |
| 警告・エラー・情報メッセージ枠 | `AlertBox` (variant: info, warning, danger) |
| 空データ・選択なし状態の表示 | `EmptyState` |
| ファイル・ディレクトリ参照入力 | `BrowseInput` |
| トグルスイッチ | `ToggleSwitch` |

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

## 7. レスポンシブ & アダプティブ設計ガイドライン

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
