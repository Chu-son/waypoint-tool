# テスト指針 (Testing Guidelines)

テスト実装者向けの指針をまとめます。

---

## テスト方針

- **要件ベース・振る舞い駆動** — `REQUIREMENTS.md` の機能要件に紐づくテストを重視する
- **実装詳細テスト禁止** — DOM構造・CSS class・内部関数の呼び出し順など、実装の変更で壊れるテストは書かない
- **1テスト1振る舞い** — 各テストは1つの振る舞いのみを検証する

---

## テストツールと実行方法

| レイヤ | フレームワーク | 実行コマンド |
|---|---|---|
| フロントエンド | Vitest + @testing-library/react | `npm run test` |
| バックエンド (Rust) | cargo test (組み込み) | `cd src-tauri && cargo test` |
| Python SDK | unittest (標準ライブラリ) | `cd python_sdk && python3 -m unittest discover -s tests -v` |

---

## テストの命名規則

### TypeScript / TSX (Vitest)
```typescript
describe('コンポーネント名 UI', () => {
  it('振る舞いの説明（英語）', () => { ... });
});
```

### Rust
```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_機能の説明() { ... }
}
```

### Python
```python
class Testクラス名(unittest.TestCase):
    def test_振る舞いの説明(self):
        ...
```

---

## モックの指針

### フロントエンド
- **Tauri API** — `vi.mock('@tauri-apps/plugin-dialog')` / `vi.mock('../../api/backend')` で常にモックする
- **Zustand Store** — `useAppStore.setState()` でテスト前に状態をセットし、テスト後に `useAppStore.getState()` で検証する
- **PixiJS / WebGL** — Canvas描画ロジックのテストは避ける。振る舞い（ストア更新、イベントハンドリング）のみテストする

### バックエンド (Rust)
- **ファイルシステム** — `tempfile::TempDir` を使って一時ディレクトリでテストする
- **外部プロセス** — `wasmtime` や `python3` の実行はテストしない

### Python SDK
- **stdin/stdout** — `sys.stdin`, `sys.stdout` を `io.StringIO` で差し替えてモックする
- **importlib** — 複数の `main.py` が存在するため、`importlib.util.spec_from_file_location` で一意にインポートする

---

## テスト追加時の手順

1. `REQUIREMENTS.md` で対象の要件番号を特定する
2. テスト項目を `implementation_plan.md` の該当テーブルに追記する
3. テストコードを書く（上記の命名・モック規則に従う）
4. `npm run test` / `cargo test` / `python3 -m unittest` で全テストが通ることを確認する
5. コメントで要件番号を記載する（例: `// --- 要件2: Waypoint編集 ---`）

---

## ファイル構成

```
# フロントエンド
src/
  stores/appStore.test.ts          # ストア状態管理
  App.test.tsx                     # アプリ全体の統合テスト
  components/ui/
    PropertiesPanel.test.tsx        # プロパティ編集
    SettingsModal.test.tsx          # 設定モーダル
    WaypointTree.test.tsx           # ツリー表示
    ExportModal.test.tsx            # エクスポートUI
    ToolPanel.test.tsx              # ツールパネル
    LayerPanel.test.tsx             # レイヤーパネル

# バックエンド (Rust)
src-tauri/src/
  models/mod.rs          # #[cfg(test)] mod tests
  models/options.rs      # #[cfg(test)] mod tests
  io/mod.rs              # #[cfg(test)] mod tests
  map/mod.rs             # #[cfg(test)] mod tests
  plugins/manager.rs     # #[cfg(test)] mod tests
  plugins/models.rs      # #[cfg(test)] mod tests

# Python SDK
python_sdk/tests/
  test_wpt_plugin.py             # SDK基底クラス
  test_line_generator.py         # LineGenerator
  test_sweep_generator.py        # SweepPathGenerator
  test_rect_sweep_generator.py   # RectSweepGenerator
```
