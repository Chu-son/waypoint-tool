# デザインシステム & コンポーネント設計方針

本ドキュメントは、ROS Waypoint ToolにおけるUIコンポーネントの設計、スタイリング、および共通部品の作成基準を定義するデザインシステムガイドラインです。開発時やリファクタリング時は必ず本方針に準拠してください。

---

## 1. ディレクトリ構造ルール

UI関連のコンポーネントは `src/components/ui/` に配置し、役割と再利用性に応じて以下のように整理します。詳細なファイル一覧は、常にコードの実態を参照してください。

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
| 1ファイル内でしか使わない分解要素 | そのファイル内のローカルコンポーネントとして定義（export しない） |

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
        icon: "h-10 w-10 p-0",
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

## 5. 新規コンポーネント追加時のチェックリスト

新しいコンポーネントを作成または切り出す際は、必ず以下の項目をチェックしてください。

* [ ] **再利用性の検証**: 既存の `common/` 内コンポーネントで十分に代替できないか？
* [ ] **位置の適切性**: 2ファイル以上で使われるか？（Yes → `common/`、No かつ特定ドメイン → 各サブフォルダ、1ファイル内のみ → ローカル配置）
* [ ] **デザイントークン**: Raw Tailwindカラー（`slate-*`等）を使用せず、`DESIGN_SYSTEM.md` に定義されたセマンティックなトークンを使用しているか？
* [ ] **className の結合**: `className` prop を受け取り、`cn()` で内部クラスと結合しているか？
* [ ] **DOM伝搬**: 最小粒度要素である場合、`forwardRef` を使って `ref` を渡しているか？
* [ ] **カタログ更新**: 新規共通コンポーネントの場合、`docs/COMPONENT_CATALOG.md` にエントリを追加したか？

---

## 6. 宣言的コンポーネント記述指針

本プロジェクトでは、Tailwind CSSのクラス文字列を直接JSXに長く並べる「命令的スタイリング」を避け、意味のある単位でコンポーネント化する「宣言的UI記述」を徹底します。

### ① 宣言的記述の原則
* **意図（What）を記述する**: JSX上では `<LayerCard>`, `<FieldLabel>`, `<AlertBox>` のように、「何を表示しているか」がひと目でわかるコンポーネント名を使用します。
* **実装（How）を閉じ込める**: Tailwind クラスによるレイアウトや装飾は、共通コンポーネント（`src/components/ui/common/`）またはファイル内のローカルサブコンポーネント内にカプセル化します。

### ② ローカルコンポーネント化の基準
以下に該当する場合は、ファイル外に切り出さずともファイル内ローカルコンポーネント（非export）として抽出し、メインコンポーネントのJSXをシンプルに保ってください。
1. ほぼ同じJSX構造や複雑なスタイリングが **2回以上出現する** 場合
2. JSXの単一ブロックが **40行を超える** 大きなカードや複雑な行要素である場合
3. 状態によるクラス切り替え（`cn(..., isActive && "...")` 等）が複雑な場合

### ③ 既存共通コンポーネント（`common/`）の積極活用
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

