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
- `category`: プラグインのカテゴリを指定（省略時は `"waypoint_generator"`）。
  - `"waypoint_generator"`: ウェイポイント列を生成するプラグイン（デフォルト）。
  - `"map_layer_generator"`: オーバーレイ用のマップレイヤー画像を生成するプラグイン。
  - `"path_calculator"`: ウェイポイント間を障害物回避等で補間するパス計算プラグイン。
- `inputs`: キャンバス上での操作入力を定義。
  - `type: "point"`: 座標と向き（Yaw）をクリックで指定。
  - `type: "points"`: 複数座標のリスト（点群）。キャンバスクリックで追加、ドラッグで移動、右クリック/リスト操作で削除。
    - `min_points`: 最小点数（省略可）。
    - `max_points`: 最大点数（省略可、デフォルト 50）。
    - `allow_yaw`: 各点に向き（Yaw）を持たせるか（デフォルト `false`）。
  - `type: "rectangle"`: 範囲をドラッグで指定。
  - `type: "waypoint"`: 既存のウェイポイントを選択。
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

組み込みの `wpt_plugin` パッケージを利用することを推奨します。SDK には、座標計算を容易にする幾何学クラスや基底クラスが含まれています。

### 1) ウェイポイント生成 (`WaypointGenerator`)
```python
from wpt_plugin import WaypointGenerator, Point, RobotFootprint

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

### 2) マップレイヤー生成 (`MapLayerGenerator`)
マップ上の指定位置や占有格子データを元に、透過PNGオーバーレイレイヤーを生成します。
走行可能領域の抽出や、モルフォロジー演算（Opening/Closing）によるノイズ除去・穴埋めマスクなどの用途に利用できます。

```python
from wpt_plugin import MapLayerGenerator, OccupancyGrid, Point

class DrivableAreaGenerator(MapLayerGenerator):
    def generate_layer(self, context):
        seeds = self.get_interaction_points(context, "seed_points") or [Point(0, 0)]
        grid = self.get_occupancy_grid(context)
        
        # 2値マスク (1: 描画, 0: 透過) からレイヤーを生成
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


### 3) パス計算 (`PathCalculator`)
ウェイポイント間をA*/ダイクストラ等のアルゴリズムで補間し、各区間のポリラインを出力します。
```python
from wpt_plugin import PathCalculator

class DijkstraCalculator(PathCalculator):
    # 基底クラスの calculate_path / find_segment_path / find_dijkstra_path を利用
    pass

if __name__ == "__main__":
    DijkstraCalculator().run_from_stdin()
```

### 4) 占有格子データ仕様とセマンティック API (`OccupancyGrid`)

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

### 利用可能な幾何学クラス・ヘルパー
- `Point(x, y, yaw)`: 座標と向き。`to_world()` メソッドで変換可能。
- `Line(p1, p2)`: 線分。長さの取得や交点判定が可能。
- `Rectangle(center, width, height, yaw)`: 矩形。頂点の取得や点の内包判定が可能。
- `Ray(origin, yaw, bidirectional)`: 仮想無限線。線分や矩形との交点取得に便利。
- `RobotFootprint(type, radius, length, width, offset_x, offset_y, points)`: ロボットの形状・寸法。
- `OccupancyGrid(data)`: 占有格子マップクラス（ROS Nav2互換）。
- `find_dijkstra_path(grid, start_pos, goal_pos, safety_margin, step_size)`: 障害物回避ダイクストラ / A*探索ヘルパー。
- `encode_rgba_to_png_base64(width, height, rgba_bytes)`: 純粋Pythonによる高速PNG Base64エンコーダー。

## 6. プラグインの登録
1. アプリの Settings > Plugins タブを開きます。
2. 「Add Custom Plugin」をクリックし、プラグインディレクトリを選択します。
3. 自動的にリストに追加され、それぞれのカテゴリ（ジェネレーター、マップレイヤー生成、パス計算）に応じて利用可能になります。

