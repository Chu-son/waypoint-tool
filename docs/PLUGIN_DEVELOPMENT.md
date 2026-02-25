# プラグイン開発ガイド (Plugin Development Guide)

本ドキュメントは、Waypoint Tool のカスタム Generator プラグインを開発するためのガイドです。

## 1. アーキテクチャ概要

Waypoint Tool は、外部の経路生成アルゴリズムを **プラグイン** として呼び出します。通信方式には OS の標準入出力（stdin/stdout）を介した JSON メッセージングを採用しています。

```
┌────────────────┐   JSON (stdin)    ┌──────────────────┐
│  Waypoint Tool │ ── context ──────► │  Plugin Script   │
│  (Rust/Tauri)  │                    │  (Python/Wasm)   │
│                │ ◄── waypoints ──── │                  │
└────────────────┘   JSON (stdout)    └──────────────────┘
```

**メリット:**
- HTTP サーバーや RPC ライブラリが不要（軽量）
- Python、Rust(Wasm) など言語を問わず実装可能
- プロセス分離によるサンドボックス型セキュリティ

## 2. プラグインのディレクトリ構成

各プラグインは独立したディレクトリとして構成され、以下のファイルを含みます:

```
my_generator/
├── manifest.json   # 必須: プラグインのメタデータ宣言
└── main.py         # 必須: エントリーポイントスクリプト
```

### 配置場所

| 種類 | パス | 備考 |
|------|------|------|
| 組み込み | `python_sdk/<plugin_name>/` | アプリバイナリにバンドル |
| ユーザー | `<AppData>/plugins/<plugin_name>/` | Settings で追加 |
| カスタム | 任意のパス | Settings > Plugins > Add Custom で指定 |

## 3. manifest.json スキーマ

```json
{
    "name": "My Generator",
    "version": "1.0.0",
    "description": "このプラグインの説明文",
    "type": "python",
    "executable": "main.py",
    "inputs": [
        {
            "id": "start_point",
            "label": "Start Point",
            "type": "point"
        }
    ],
    "needs": [],
    "properties": [
        {
            "name": "spacing",
            "label": "Point Spacing (m)",
            "type": "float",
            "default": 1.0
        }
    ]
}
```

### フィールド一覧

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `name` | string | ✅ | プラグインの表示名 |
| `version` | string | | セマンティックバージョン |
| `description` | string | | プラグインの簡潔な説明文。PluginParamsPanel に表示されます |
| `type` | string | ✅ | `"python"` または `"wasm"` |
| `executable` | string | ✅ | 実行ファイル名（manifest.json と同じディレクトリ基準の相対パス） |
| `inputs` | array | | [インタラクション入力](#4-インタラクション入力-inputs)の配列 |
| `needs` | array | | 追加のコンテキストデータ要求（`"map_image"`, `"waypoints"` 等） |
| `properties` | array | | [プロパティ](#5-プロパティ-properties)（パラメータ）の配列 |

## 4. インタラクション入力 (inputs)

`inputs` 配列で宣言された入力は、ユーザーが MapCanvas 上で直接操作して定義するデータです。フロントエンドは各入力タイプに応じた操作 UI を自動生成します。

### 入力タイプ一覧

| タイプ | manifest値 | ユーザー操作 | データ形式 |
|--------|-----------|-------------|-----------|
| **Point** | `"point"` | クリックで配置、ドラッグでヨー角設定 | `{"x", "y", "qx", "qy", "qz", "qw"}` |
| **Rectangle** | `"rectangle"` | ドラッグで描画、コーナー/回転ハンドル調整 | `{"center": {"x","y"}, "width", "height", "yaw"}` |
| **Polygon** | `"polygon"` | 順次クリックで頂点定義 | *(将来対応)* |
| **Path** | `"path"` | 連続ポイント列 | *(将来対応)* |
| **Node Select** | `"node_select"` | 既存 Waypoint の選択 | *(将来対応)* |

### 複数入力のサポート

一つのプラグインが `inputs` 配列に **複数の入力** を宣言できます:

```json
{
    "inputs": [
        {"id": "start_point", "label": "Start Point", "type": "point"},
        {"id": "sweep_rect", "label": "Sweep Area", "type": "rectangle"}
    ]
}
```

フロントエンドは以下の動作を行います:
- **ステップインジケータ**: 入力数に応じて Step 1/2/3... の UI を表示
- **自動遷移**: 現在の入力が完了すると、次の未設定入力に自動的に切り替え
- **任意ステップへの移動**: ステップボタンをクリックして任意の入力に戻れる

## 5. プロパティ (properties)

`properties` 配列で宣言したパラメータは、PluginParamsPanel に入力フォームとして自動生成されます。

### プロパティタイプ一覧

| タイプ | manifest値 | UI コンポーネント |
|--------|-----------|-----------------|
| 浮動小数点 | `"float"` | Number input (`step="any"`) |
| 整数 | `"integer"` | Number input (`step="1"`) |
| 真偽値 | `"boolean"` | Checkbox |
| 文字列 | `"string"` | Text input |
| 選択肢 | `"string"` + `"options"` | Select dropdown |

### 選択肢プロパティの例

```json
{
    "name": "start_corner",
    "label": "Start Corner",
    "type": "string",
    "default": "Bottom-Left",
    "options": ["Bottom-Left", "Bottom-Right", "Top-Left", "Top-Right"]
}
```

## 6. 出力フォーマット (Output Format)

プラグインは生成した Waypoint を **JSON 配列** として stdout に出力します。各 Waypoint は **`transform` 形式** を使用してください:

```json
[
    {
        "transform": {
            "x": 1.0,
            "y": 2.0,
            "qx": 0.0,
            "qy": 0.0,
            "qz": 0.0,
            "qw": 1.0
        },
        "options": {
            "generated_by": "MyGenerator",
            "custom_flag": true
        }
    }
]
```

### transform フィールド

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `x` | float | X 座標（メートル） |
| `y` | float | Y 座標（メートル） |
| `qx` | float | クォータニオン X（通常 0） |
| `qy` | float | クォータニオン Y（通常 0） |
| `qz` | float | クォータニオン Z = sin(yaw / 2) |
| `qw` | float | クォータニオン W = cos(yaw / 2) |

> **Note:** `options` は任意のメタデータ辞書で、生成元プラグイン名やインデックスなどを自由に格納できます。

## 7. Python プラグインの作成手順

### Step 1: ディレクトリとファイルの作成

```bash
mkdir my_generator
touch my_generator/manifest.json
touch my_generator/main.py
```

### Step 2: manifest.json の記述

```json
{
    "name": "My Generator",
    "version": "1.0.0",
    "description": "カスタム Waypoint ジェネレーターの説明",
    "type": "python",
    "executable": "main.py",
    "inputs": [
        {"id": "start_point", "label": "Start Point", "type": "point"}
    ],
    "needs": [],
    "properties": [
        {"name": "count", "label": "Number of Points", "type": "integer", "default": 5},
        {"name": "spacing", "label": "Spacing (m)", "type": "float", "default": 1.0}
    ]
}
```

### Step 3: main.py の実装

```python
import sys
import os
import math

# SDK のインポート（組み込みプラグインの場合）
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from wpt_plugin import WaypointGenerator


class MyGenerator(WaypointGenerator):
    """カスタム Waypoint ジェネレーター。"""

    def generate(self, context):
        # 1. インタラクション入力の取得
        start = self.get_interaction_data(context, "start_point")
        if not start:
            return []

        base_x = float(start.get("x", 0.0))
        base_y = float(start.get("y", 0.0))
        yaw = self.quaternion_to_yaw(start)

        # 2. プロパティの取得
        count = int(self.get_property(context, "count", default=5))
        spacing = float(self.get_property(context, "spacing", default=1.0))

        # 3. Waypoint の計算と出力構築
        waypoints = []
        for i in range(count):
            wx = base_x + i * spacing * math.cos(yaw)
            wy = base_y + i * spacing * math.sin(yaw)
            waypoints.append(self.make_waypoint(
                wx, wy, yaw,
                options={"generated_by": "MyGenerator", "index": i}
            ))

        self.log(f"Generated {len(waypoints)} waypoints.")
        return waypoints


if __name__ == "__main__":
    MyGenerator().run_from_stdin()
```

### Step 4: テストの実行

```bash
# 空入力テスト（エラーなく空配列が返ることを確認）
echo '' | python my_generator/main.py

# コンテキストを渡してテスト
echo '{"properties":{"count":3,"spacing":1.0},"interaction_data":{"start_point":{"x":0,"y":0,"qx":0,"qy":0,"qz":0,"qw":1}}}' | python my_generator/main.py
```

### Step 5: Waypoint Tool への登録

- **開発中**: `python_sdk/` ディレクトリに配置すると自動検出されます
- **ユーザー追加**: Settings > Plugins > 「Add Custom Plugin」から my_generator のフォルダを指定

## 8. Python SDK リファレンス (`wpt_plugin.py`)

### WaypointGenerator クラス

| メソッド | 説明 |
|---------|------|
| `generate(context)` | **必須オーバーライド**。Waypoint リストを返す |
| `run_from_stdin()` | stdin/stdout 通信を処理するエントリーポイント |
| `get_property(context, name, default)` | プロパティ値の安全な取得 |
| `get_interaction_data(context, input_id)` | インタラクション入力データの取得 |
| `quaternion_to_yaw(point_data)` | クォータニオン → ヨー角変換 |
| `yaw_to_quaternion(yaw)` | ヨー角 → クォータニオン変換 |
| `make_waypoint(x, y, yaw, options, precision)` | 標準形式の Waypoint 辞書を構築 |
| `log(message)` | stderr へのデバッグログ出力 |

### 重要な注意事項

- **stdout は JSON 通信チャネル**: `print()` をデバッグに使わないこと。`self.log()` を使用
- **エラー時は stderr + 非ゼロ終了**: `run_from_stdin()` が自動処理
- **出力バリデーション**: `run_from_stdin()` が自動で `_validate_output()` を実行

## 9. WASM プラグインの作成（概要）

WASM プラグインは [wasmtime](https://wasmtime.dev/) CLI を介して実行されます。

```json
{
    "name": "My Wasm Plugin",
    "type": "wasm",
    "executable": "plugin.wasm",
    "inputs": [],
    "properties": []
}
```

- stdin から JSON コンテキストを読み取り、stdout に JSON 配列を出力する WASI 対応バイナリを用意してください
- `wasmtime` がシステムの PATH に存在する必要があります
- Python SDK と同じ入出力フォーマット（transform 形式）を使用します

## 10. リファレンス実装

組み込みプラグイン `sweep_generator` がリファレンス実装として整備されています。新しいプラグインを作成する際は、このプラグインの構造に倣ってください:

- **`python_sdk/sweep_generator/manifest.json`**: manifest のベストプラクティス
- **`python_sdk/sweep_generator/main.py`**: Step 1〜5 のコメント付き実装例
