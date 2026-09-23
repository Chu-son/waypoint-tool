# テスト方針 (Testing Guide)

本ドキュメントは、本プロジェクトのフロントエンドテスト（Vitest + Testing Library）の方針と書き方を定めます。
テストは **リファクタリングを安全に行うための安全網** です。内部実装を変えても、利用者から見た振る舞いが同じならテストは通り続けなければなりません。

## 1. 基本原則：振る舞いを検証し、実装を検証しない

| 検証する（Do） | 検証しない（Don't） |
|---|---|
| ストアの **結果状態**（`getAppState().nodes['a'].transform.x === 15`） | どのストアアクションが呼ばれたか（`expect(mockUpdateNode).toHaveBeenCalledWith(...)`） |
| 画面に **表示される内容**（テキスト・入力値・ボタンの有効/無効） | `className`・内部 state・コンポーネント構造 |
| **境界に渡したペイロード**（`BackendAPI.saveProject` の保存先パス、`runPlugin` に渡したコンテキスト） | 内部関数の呼び出し回数や順序 |
| Undo 1 回で戻る、Escape で元に戻る、などの **ユーザーから見た保証** | テーマの hex 値など、それ自体が仕様でない定数 |

> 目安：「この実装をまったく別の書き方に置き換えても、このテストは通るか？」 通らないなら実装を検証している。

## 2. ストアは本物を使う

- `vi.mock('.../stores/appStore')` は **禁止**（ESLint `no-restricted-syntax` で error）。
- 各テストは `resetAppStore(state)` で初期状態に戻してから必要な状態だけを与える。
- アクションはテストの Arrange として直接呼んでよい（例：`act(() => getAppState().selectNodes(['a']))`）。選択など複数フィールドを同期させるものは `setState` で直接書き込まず、アクション経由で作る。

```tsx
import { renderWithStore } from '../../test/render';
import { getAppState, PAST_WELCOME } from '../../test/store';
import { makeWaypoint, makeTransform, waypointTree } from '../../test/fixtures';

it('Delete removes the selected waypoints', () => {
  renderWithStore(<ShortcutManager />, { ...PAST_WELCOME, ...waypointTree([makeWaypoint('a'), makeWaypoint('b')]) });
  act(() => getAppState().selectNodes(['a']));

  fireEvent.keyDown(window, { key: 'Delete' });

  expect(getAppState().rootNodeIds).toEqual(['b']);
});
```

## 3. モックはプロセス境界だけ

| 対象 | 方法 |
|---|---|
| Tauri IPC / ファイルダイアログ | `vi.spyOn(BackendAPI, 'runPlugin').mockResolvedValue(...)` / `vi.spyOn(DialogAPI, 'ask')`。jsdom では `src/api` が自動で Mock 実装を選ぶため `vi.mock('../../api')` は不要 |
| PixiJS（WebGL） | `vi.mock('pixi.js', () => import('../../test/mocks/pixi').then((m) => m.pixiJsMock))`（`@pixi/react` も同様） |
| ブラウザ API（`alert` / `confirm` / クリップボード等） | `vi.spyOn(window, 'confirm')` など。クリップボードは user-event が提供するスタブを使う |
| 時刻・乱数 | 必要な場合のみ `vi.useFakeTimers()` 等 |

- `@tauri-apps/*` を直接モックするのは、まだ `src/api` を経由していない箇所の暫定措置に限る。
- lucide アイコンや子コンポーネントなど、**アプリ内部のモジュールはモックしない**。
- `restoreMocks: true` を設定済みのため、`vi.spyOn` はテストごとに自動で元に戻る。

## 4. 画面要素の取得と操作

- 優先順：`getByRole`（name 付き）→ `getByLabelText` → `getByText` / `getByDisplayValue` → `getByTitle`。
- `getByTestId`・`querySelector`・`className` は最後の手段。アクセシブルな名前が無い要素は、テストのために testid を足すのではなく **`aria-label` 等を付けて UI 側を改善** する。
- 操作は `@testing-library/user-event`（`renderWithStore` が返す `user`）を推奨。入力欄の最終値だけが重要な場合は `fireEvent.change` でもよい。
- キャンバス（PixiJS）は jsdom 上で属性付きの不活性な要素として描画される。ビューポートへの pointer イベントと、`pixicontainer[x=..][y=..]` による「その座標に描かれたもの」の特定でツール操作を検証する（`MapCanvasInteractions.test.tsx` 参照）。

## 5. 共通テスト基盤 (`src/test/`)

| ファイル | 用途 |
|---|---|
| `setup.ts` | jest-dom 拡張、pointer capture のポリフィル |
| `store.ts` | `resetAppStore(overrides)`, `getAppState()`, `PAST_WELCOME`（初回起動モーダルを閉じた状態） |
| `render.tsx` | `renderWithStore(ui, state)` → `{ user, ...render結果 }` |
| `fixtures.ts` | `makeWaypoint` / `makeGroup` / `waypointTree` / `makeTransform` / 各種アノテーション / `makeMapLayer` / `makeManualCustomLayer` / `makePlugin` |
| `mocks/pixi.tsx` | PixiJS スタブ、描画呼び出しを記録する `createGraphicsRecorder()` |

テストデータはファクトリで作り、**テストの意図に関係するフィールドだけ** を上書きする。

## 6. テストの種類と配置

| 種類 | 対象 | 書き方 |
|---|---|---|
| 純粋関数 | `utils/`, `stores/migrations/` | 入力と期待値の表（`it.each`）で網羅 |
| ストア | `stores/slices/` | 実ストアに対してアクションを実行し結果状態を検証 |
| コンポーネント統合 | `components/` | 実ストア + ユーザー操作 + 境界スタブ。**最も価値が高い** |
| E2E スモーク | アプリ全体 | （今後）Playwright + Mock backend |

- テストファイルは対象と同じディレクトリに `*.test.ts(x)` として置く。
- テスト名は「何をすると、どうなるか」を振る舞いとして書く（例：`'undoes a drag in one step'`）。

## 7. リファクタリング時の手順

1. 対象の振る舞いテストが無ければ、**先に現在の振る舞いを固定するテスト（特性テスト）を書く**。
2. テストが通る状態でリファクタリングする。移動だけのコミットとロジック変更のコミットは分ける。
3. テストの修正が import パス以外に必要になったら、振る舞いが変わっていないかを疑う。
4. 既存の不具合を見つけた場合は、正しい振る舞いのテストを書いて失敗を確認してから修正する。仕様が不明なら `it.todo` に理由を書いて残す。

## 8. カバレッジ

- `npm run test:coverage` で計測。`vite.config.ts` の `coverage.thresholds` は **下げてはならない**（ラチェット運用）。カバレッジが上がったら閾値も引き上げる。
- カバレッジは目的ではなく、振る舞いが検証されていない領域を見つけるための指標として使う。

## 9. 実行コマンド

```bash
npm test               # 型チェック + 全テスト
npm run test:watch     # ウォッチモード
npm run test:coverage  # カバレッジ付き
npm run check          # typecheck + lint + format + coverage（CI と同じ）
```
