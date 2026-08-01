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
