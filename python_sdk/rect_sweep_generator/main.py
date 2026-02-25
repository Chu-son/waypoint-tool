"""
Rect Sweep Generator プラグイン
================================

回転可能な矩形領域内で蛇行走査（boustrophedon）パスを生成するプラグイン。
矩形はユーザーが MapCanvas 上でドラッグして描画し、コーナー/回転ハンドルで
サイズと向きを調整できます。
"""

import sys
import os
import math

# SDK のインポート
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from wpt_plugin import WaypointGenerator


class RectSweepGenerator(WaypointGenerator):
    """矩形領域内でジグザグ走査パスを生成するプラグイン。

    矩形は center (中心座標)、width、height、yaw (回転角) で定義されます。
    ローカル座標系で走査線を計算し、ワールド座標系に変換して出力します。

    Manifest で宣言する入力:
        - sweep_rect (type: rectangle): ドラッグで矩形を描画

    Manifest で宣言するプロパティ:
        - num_lines (int): 平行走査線の本数
        - snake_pattern (bool): 蛇行パターンのオン/オフ
        - start_corner (string): 開始コーナー（Bottom-Left / Top-Right 等）
        - sweep_direction (string): 走査方向（Horizontal / Vertical）
    """

    def generate(self, context):
        # インタラクション入力: 矩形データの取得
        rect_data = self.get_interaction_data(context, "sweep_rect")
        if not rect_data:
            return []

        # 矩形パラメータの抽出
        center = rect_data.get("center", {})
        cx = float(center.get("x", 0.0))
        cy = float(center.get("y", 0.0))
        width = float(rect_data.get("width", 10.0))
        height = float(rect_data.get("height", 10.0))
        yaw = float(rect_data.get("yaw", 0.0))

        if width < 0.01 or height < 0.01:
            return []

        # プロパティの取得
        num_lines = max(2, int(self.get_property(context, "num_lines", default=5)))
        snake = bool(self.get_property(context, "snake_pattern", default=True))
        start_corner = str(self.get_property(context, "start_corner", default="Bottom-Left"))
        sweep_direction = str(self.get_property(context, "sweep_direction", default="Horizontal"))

        half_w = width / 2.0
        half_h = height / 2.0

        cos_a = math.cos(yaw)
        sin_a = math.sin(yaw)

        def to_world(lx, ly):
            """ローカル矩形座標（原点=中心）→ ワールド座標への変換。"""
            wx = cx + lx * cos_a - ly * sin_a
            wy = cy + lx * sin_a + ly * cos_a
            return wx, wy

        # 走査軸とステップ軸の決定
        is_horizontal = sweep_direction == "Horizontal"
        sweep_half = half_w if is_horizontal else half_h
        step_half = half_h if is_horizontal else half_w

        # 開始コーナーによる符号の決定
        x_sign = -1.0 if "Left" in start_corner else 1.0
        y_sign = 1.0 if "Bottom" in start_corner else -1.0

        if is_horizontal:
            sweep_start_sign = x_sign
            step_start_sign = y_sign
        else:
            sweep_start_sign = y_sign
            step_start_sign = x_sign

        line_spacing = (2.0 * step_half) / (num_lines - 1) if num_lines > 1 else 0

        waypoints = []

        for i in range(num_lines):
            step_pos = step_start_sign * step_half - step_start_sign * i * line_spacing
            is_reverse = snake and (i % 2 == 1)

            s_start = sweep_start_sign * sweep_half
            s_end = -sweep_start_sign * sweep_half
            if is_reverse:
                s_start, s_end = s_end, s_start

            # ローカル XY 座標への変換
            if is_horizontal:
                start_lx, start_ly = s_start, step_pos
                end_lx, end_ly = s_end, step_pos
            else:
                start_lx, start_ly = step_pos, s_start
                end_lx, end_ly = step_pos, s_end

            # 進行方向のヨー角を計算
            travel_dx = end_lx - start_lx
            travel_dy = end_ly - start_ly
            travel_local_angle = math.atan2(travel_dy, travel_dx)
            travel_yaw = yaw + travel_local_angle
            travel_yaw = math.atan2(math.sin(travel_yaw), math.cos(travel_yaw))

            # 始点
            ws_x, ws_y = to_world(start_lx, start_ly)
            waypoints.append(self.make_waypoint(
                ws_x, ws_y, travel_yaw,
                options={
                    "generated_by": "RectSweepGenerator",
                    "sweep_line_id": i,
                    "position": "start",
                },
            ))

            # 終点
            we_x, we_y = to_world(end_lx, end_ly)
            waypoints.append(self.make_waypoint(
                we_x, we_y, travel_yaw,
                options={
                    "generated_by": "RectSweepGenerator",
                    "sweep_line_id": i,
                    "position": "end",
                },
            ))

        self.log(f"Generated {len(waypoints)} waypoints in rect sweep.")
        return waypoints


if __name__ == "__main__":
    RectSweepGenerator().run_from_stdin()
