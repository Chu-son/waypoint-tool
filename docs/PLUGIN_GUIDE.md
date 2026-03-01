# プラグイン開発ガイド (Plugin Guide)

ROS Waypoint Tool は、外部スクリプト（Python / WASM）をプラグインとして呼び出すことで、独自の経路生成アルゴリズム（ジェネレーター）を追加できます。

## 1. アーキテクチャ

ツール本体とプラグインは、OS の標準入出力 (stdin/stdout) を介して JSON 形式で通信します。これにより、プラグイン側で複雑な依存関係を持つ必要がなく、言語を問わず（標準的には Python) 実装が可能です。

## 2. 構造

各プラグインは以下の最小構成を持つディレクトリです。

```
my_plugin/
├── manifest.json   # メタデータとUIの定義
└── main.py         # 実際のロジック（実行ファイル）
```

## 3. manifest.json の定義

`manifest.json` では、プラグインの名前、入力方法、およびプロパティを定義します。

### 主なフィールド
- `inputs`: キャンバス上での操作入力を定義。
  - `type: "point"`: 座標と向きをクリックで指定。
  - `type: "rectangle"`: 範囲をドラッグで指定。
- `properties`: UI に表示されるパラメータ（数値、文字列、真偽値等）。
  - `interaction_hints`: キャンバス上にプレビュー図形を描画するためのヒント情報。
- `needs`: マップ画像や現在の Waypoint リストなどの追加情報を要求する場合に指定。

## 4. インタラクションヒント (Interaction Hints)

プラグイン側からキャンバス上の描画を制御するための仕組みです。プロパティにヒントを紐付けることで、コアコードの修正なしに視認性の高い UI を実現できます。

例: 走査の開始コーナーを指定するドロップダウンに対し、キャンバス上に「ここから開始します」という矢印を表示する。

## 5. Python SDK の利用

組み込みの `wpt_plugin.py` をインポートして利用することを推奨します。

```python
from wpt_plugin import WaypointGenerator

class MyGenerator(WaypointGenerator):
    def generate(self, context):
        # パラメータの取得
        spacing = self.get_property(context, "spacing", 1.0)
        # Waypoint の生成
        points = []
        # ... ロジック ...
        return points

if __name__ == "__main__":
    MyGenerator().run_from_stdin()
```

## 6. プラグインの登録
1. アプリの Settings > Plugins タブを開きます。
2. 「Add Custom Plugin」をクリックし、プラグインディレクトリを選択します。
3. 自動的にリストに追加され、ジェネレーターとして利用可能になります。
