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
### 主なフィールド
- `primary_output`: プラグインの主要出力タイプ（UIでの配置タブやフィルタに使用）。
  - `"waypoints"`: ウェイポイントを主に出力（デフォルト）。
  - `"custom_layer"`: カスタムレイヤー画像を主に出力（Map Layers タブ）。
  - `"annotations"`: アノテーショングループを主に出力（Annotations タブ）。
  - `"path_calculator"`: ウェイポイント間パス補間（Path Router メニュー）。
- `category`: 旧仕様互換カテゴリ（`"waypoint_generator"` | `"map_layer_generator"` | `"path_calculator"`）。
- `inputs`: キャンバス上での操作入力を定義。
  - `type: "point"`: 座標と向き（Yaw）をクリックで指定。
  - `type: "points"`: 複数座標のリスト（点群）。キャンバスクリックで追加、ドラッグで移動、右クリック/リスト操作で削除。
    - `min_points`: 最小点数（省略可）。
    - `max_points`: 最大点数（省略可、デフォルト 50）。
    - `allow_yaw`: 各点に向き（Yaw）を持たせるか（デフォルト `false`）。
  - `type: "rectangle"`: 範囲をドラッグで指定。
  - `type: "waypoint"`: 既存のウェイポイントを選択。
  - `type: "annotation"`: プロジェクト内の参照用アノテーションオブジェクトを選択。
    - `object_type`: 受け付けたいアノテーションの種類（`"point"`, `"oriented_point"`, `"line"`, `"rect"`, `"circle"`, `"any"`。デフォルト `"any"`）。
    - `multiple`: 複数選択を許可するか（`true` の場合は配列、`false` の場合は単一オブジェクト）。
  - `type: "custom_layer"`: プロジェクト内のカスタムレイヤー（手動描画またはプラグイン生成レイヤー）を選択。
    - `multiple`: 複数選択を許可するか（`true` の場合はプルダウン選択＋追加リストUI、`false` の場合は単一選択プルダウン）。
- `properties`: UI に表示されるパラメータ（数値、文字列、真偽値等）。
  - `interaction_hints`: キャンバス上にプレビュー図形を描画するためのヒント情報。
- `needs`: アプリ本体から追加情報（マップや選択中のポイントなど）を要求する場合に指定。現在サポートされている値は以下の通りです：
  - `"selected_points"`: ユーザーが選択している Waypoint のインデックスリスト (`context["selected_points"]`) を注入します。
  - `"occupancy_grid"`: 現在表示されているマップ画像から占有格子データを生成し (`context["occupancy_grid"]`) 注入します。
  - `"occupancy_grid_in_region"`: `inputs` で指定した `rectangle` の範囲内のみの占有格子データを生成し注入します（全体を生成するより高速です）。
  - `"robot_footprint"`: プロジェクト設定で定義されたロボットの形状・寸法データ (`context["robot_footprint"]`) を注入します。

## 4. インタラクションヒント (Interaction Hints)

プラグイン側からキャンバス上の描画を制御するための仕組みです。プロパティにヒントを紐付けることで、コアコードの修正なしに視認性の高い UI を実現できます。

例: 走査の開始コーナーを指定するドロップダウンに対し、キャンバス上に「ここから開始します」という矢印を表示する。

## 5. Python SDK の利用

組み込みの `wpt_plugin` パッケージを利用することを推奨します。SDK には、座標計算を容易にする幾何学クラス、統合ジェネレーター基底クラス、および結果ビルダーが含まれています。

### 1) 統合ジェネレーター (`PluginGenerator` & `PluginResult`) - 推奨
`PluginGenerator` と `PluginResult` を使用すると、**ウェイポイント、カスタムレイヤー、アノテーション、および計算メタデータ（`plugin_data`）を同時に1回の実行で出力**できます。

```python
from wpt_plugin import PluginGenerator, PluginResult, Point

class MultiOutputSearchPlugin(PluginGenerator):
    def generate(self, context):
        res = PluginResult()
        
        # 1. ウェイポイントの生成・追加
        waypoints = [
            self.make_waypoint(0.0, 0.0, 0.0),
            self.make_waypoint(2.0, 0.0, 0.0),
            self.make_waypoint(2.0, 2.0, 1.57),
        ]
        res.add_waypoints(waypoints, name="Search Route", plugin_data={"total_length": 4.0})

        # 2. カスタムレイヤー（探索エリアマスク等）の追加
        mask = [[1 if (r + c) % 2 == 0 else 0 for c in range(50)] for r in range(50)]
        res.add_custom_layer(
            name="Explored Mask",
            mask=mask,
            origin=[0.0, 0.0, 0.0],
            resolution=0.05,
            color_rgba=(59, 130, 246, 150),
            plugin_data={"coverage_rate": 78.5}
        )

        # 3. アノテーション（危険領域や検索境界等）の追加
        res.add_annotations([
            self.make_annotation_rect(1.0, 1.0, 2.5, 2.5, name="Search Boundary", color="#ef4444"),
            self.make_annotation_point(0.0, 0.0, name="Base Point"),
        ], name="Boundary Annotations")

        # 4. 全体共通の内部データ (JSON Viewerで確認可能、他プラグインへ入力連携)
        res.set_plugin_data({
            "algorithm": "Grid Coverage Search v2",
            "estimated_time_sec": 120.5,
            "waypoints_count": len(waypoints)
        })

        return res

if __name__ == "__main__":
    MultiOutputSearchPlugin().run_from_stdin()
```

### 2) 従来形式のウェイポイント生成 (`WaypointGenerator` / リスト返却)
既存プラグインとの後方互換性も完全に維持されています。

```python
from wpt_plugin import WaypointGenerator, Point

class MyGenerator(WaypointGenerator):
    def generate(self, context):
        start = self.get_interaction_point(context, "start_point")
        if not start:
            return []

        count = self.get_property(context, "count", 5)
        spacing = self.get_property(context, "spacing", 1.0)

        points = []
        for i in range(count):
            p = Point(i * spacing, 0).to_world(start.x, start.y, start.yaw)
            points.append(self.make_waypoint(p.x, p.y, p.yaw))
            
        return points

if __name__ == "__main__":
    MyGenerator().run_from_stdin()
```

### 3) 従来形式のマップレイヤー生成 (`MapLayerGenerator`)
```python
from wpt_plugin import MapLayerGenerator, OccupancyGrid, Point

class DrivableAreaGenerator(MapLayerGenerator):
    def generate_layer(self, context):
        seeds = self.get_interaction_points(context, "seed_points") or [Point(0, 0)]
        grid = self.get_occupancy_grid(context)
        
        mask = [[1 if (r + c) % 2 == 0 else 0 for c in range(100)] for r in range(100)]
        return self.create_layer_from_mask(
            mask,
            origin=[-2.5, -2.5, 0.0],
            resolution=0.05,
            name="Drivable Area Layer",
            blend_mode="overwrite",
            color_rgba=(34, 197, 94, 160)
        )

if __name__ == "__main__":
    DrivableAreaGenerator().run_from_stdin()
```

### 4) パス計算 (`PathCalculator`)
ウェイポイント間をA*/ダイクストラ等のアルゴリズムで補間し、各区間のポリラインを出力します。
```python
from wpt_plugin import PathCalculator

class DijkstraCalculator(PathCalculator):
    # 基底クラスの calculate_path / find_segment_path / find_dijkstra_path を利用
    pass

if __name__ == "__main__":
    DijkstraCalculator().run_from_stdin()
```

### 5) 占有格子データ仕様とセマンティック API (`OccupancyGrid`)

アプリ本体からプラグインへ渡される占有格子データ (`context["occupancy_grid"]`) は、ROS 2 Nav2 標準に準拠した signed 8-bit (`int8`) 配列として zlib 圧縮・Base64 エンコードされて渡されます。

#### セルの値定義 (Cell Values Specification)
| 定数 | 値 | 意味 | 備考 |
| :--- | :--- | :--- | :--- |
| `grid.FREE` | `0` | **自由空間 (Free Space)** | 通行可能なエリア |
| `grid.OBSTACLE` | `100` | **障害物 (Obstacle)** | 衝突エリア（進入禁止） |
| `grid.UNKNOWN` | `-1` | **不明領域 (Unknown Space)** | 未計測エリア（プラグインの `allow_unknown` 設定に従う） |

#### セマンティック判定メソッド (Recommended APIs)
プラグイン開発者がセルの生数値を直接比較せず、意図を安全かつ可読性高く記述できるよう、以下のメソッドが提供されています：

```python
# ワールド座標 (x, y) での判定
grid.is_free(x, y)          # 自由空間であれば True
grid.is_obstacle(x, y)      # 障害物であれば True
grid.is_unknown(x, y)       # 不明領域（またはマップ範囲外）であれば True

# グリッドセル座標 (row, col) での判定
grid.is_free_cell(r, c)     # 自由空間であれば True
grid.is_obstacle_cell(r, c) # 障害物であれば True
grid.is_unknown_cell(r, c)  # 不明領域（または範囲外）であれば True

# 座標変換
col, row = grid.world_to_grid(x, y)
world_x, world_y = grid.grid_to_world(row, col)
```

### 6) プラグイン間データ連携 (`plugin_data` Pipeline)
他プラグインの出力結果（レイヤーやアノテーション）を入力として受け取った際、`self.get_plugin_data(obj)` ヘルパーで内部計算結果を取得できます。

```python
class PathFollowerPlugin(PluginGenerator):
    def generate(self, context):
        layer = self.get_custom_layer(context, "cost_layer")
        layer_data = self.get_plugin_data(layer)
        if layer_data:
            coverage = layer_data.get("coverage_rate", 0)
            self.log(f"Cost layer coverage: {coverage}%")
        ...
```

### 利用可能な幾何学クラス・ヘルパー
- `Point(x, y, yaw)`: 座標と向き。`to_world()` メソッドで変換可能。
- `Line(p1, p2)`: 線分。長さの取得や交点判定が可能。
- `Rectangle(center, width, height, yaw)`: 矩形。頂点の取得や点の内包判定が可能。
- `Circle(center, radius)`: 円形。点の内包判定が可能。
- `Ray(origin, yaw, bidirectional)`: 仮想無限線。線分や矩形との交点取得に便利。
- `RobotFootprint(type, radius, length, width, offset_x, offset_y, points)`: ロボットの形状・寸法。
- `OccupancyGrid(data)`: 占有格子マップクラス（ROS Nav2互換）。
- `PluginResult()`: 複数オブジェクト出力用ビルダー（`add_waypoints`, `add_custom_layer`, `add_annotations`, `set_plugin_data`）。
- `find_dijkstra_path(grid, start_pos, goal_pos, safety_margin, step_size)`: 障害物回避ダイクストラ / A*探索ヘルパー。
- `self.get_annotation(context, input_id)` / `self.get_annotations(context, input_id)`: アノテーション入力オブジェクトの取得ヘルパー。
- `self.get_custom_layer(context, input_id)` / `self.get_custom_layers(context, input_id)`: カスタムレイヤー入力データの取得ヘルパー。
- `self.get_plugin_data(obj)`: オブジェクト（レイヤー/アノテーション等）に紐付く `plugin_data` を安全に取得するヘルパー。
- `self.get_custom_layer_grid(custom_layer)`: カスタムレイヤーに占有格子データが含まれる場合に `OccupancyGrid` を返すヘルパー。
- `encode_rgba_to_png_base64(width, height, rgba_bytes)`: 純粋Pythonによる高速PNG Base64エンコーダー。

## 6. プラグインの登録
1. アプリの Settings > Plugins タブを開きます。
2. 「Add Custom Plugin」をクリックし、プラグインディレクトリを選択します。
3. 自動的にリストに追加され、それぞれのカテゴリ（ジェネレーター、マップレイヤー生成、パス計算）に応じて利用可能になります。

