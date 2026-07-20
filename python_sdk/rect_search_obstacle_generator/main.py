"""
Rect Search Generator
======================

回転可能な矩形領域内でジグザグ走査パスを生成するプラグイン。
"""

import sys
import os
import math

# SDK のインポート
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from wpt_plugin import WaypointGenerator, Point, normalize_yaw, Line, Ray


class RectSearchObstacleGenerator(WaypointGenerator):
    """矩形領域内でジグザグ走査パスを生成し、障害物を回避するプラグイン。
    """

    def generate(self, context):
        rect = self.get_interaction_rect(context, "sweep_rect")
        if not rect:
            return []

        if rect.width < 0.01 or rect.height < 0.01:
            return []

        # プロパティの取得
        num_lines = max(2, int(self.get_property(
            context, "num_lines", default=5)))
        start_corner = str(self.get_property(
            context, "start_corner", default="Bottom-Left"))
        sweep_direction = str(self.get_property(
            context, "sweep_direction", default="Horizontal"))
        inflation_radius = float(self.get_property(
            context, "inflation_radius", default=0.3))

        grid = self.get_occupancy_grid(context)
        if grid:
            self.log("Occupancy Grid is available.")
            self.log(
                f"Grid size: {grid.width}x{grid.height}, Resolution: {grid.resolution}, Origin: {grid.origin}")
        else:
            self.log("Occupancy Grid is NOT available. Will generate full path.")

        # 1. 矩形の頂点を取得 (0:BL, 1:BR, 2:TR, 3:TL)
        corners = rect.get_corners()

        # 2. 基準となる辺 (Reference Line) を決定
        is_horizontal = (sweep_direction == "Horizontal")
        is_left = "Left" in start_corner
        is_bottom = "Bottom" in start_corner

        if is_horizontal:
            if is_left:
                ref_line = Line(corners[0], corners[3]) if is_bottom else Line(
                    corners[3], corners[0])
                perp_clockwise = is_bottom
            else:
                ref_line = Line(corners[1], corners[2]) if is_bottom else Line(
                    corners[2], corners[1])
                perp_clockwise = not is_bottom
        else:
            if is_bottom:
                ref_line = Line(corners[0], corners[1]) if is_left else Line(
                    corners[1], corners[0])
                perp_clockwise = not is_left
            else:
                ref_line = Line(corners[3], corners[2]) if is_left else Line(
                    corners[2], corners[3])
                perp_clockwise = is_left

        perp_yaw = ref_line.perpendicular_yaw(clockwise=perp_clockwise)

        waypoints = []

        for i in range(num_lines):
            t = 0.0 if num_lines <= 1 else i / (num_lines - 1)
            L_pt = Point(
                ref_line.p1.x + t * (ref_line.p2.x - ref_line.p1.x),
                ref_line.p1.y + t * (ref_line.p2.y - ref_line.p1.y)
            )

            ray = Ray(L_pt, perp_yaw)
            hits = rect.intersect_ray(ray)

            R_pt = None
            max_dist = -1.0
            for h in hits:
                d = L_pt.distance_to(h)
                if d > max_dist:
                    max_dist = d
                    R_pt = h

            if not R_pt or max_dist < 0.001:
                continue

            ux = (R_pt.x - L_pt.x) / max_dist
            uy = (R_pt.y - L_pt.y) / max_dist

            # --- Step 2: 始点 w_start の決定 (常に L 側から走査) ---
            w_start = L_pt  # グリッドなし → L_ptをそのまま使用

            if grid:
                step = grid.resolution
                num_steps_scan = int(max_dist / step) + 1
                inflation_steps = max(0, int(inflation_radius / step))
                perp_x, perp_y = -uy, ux
                w_start = None  # 安全点が見つかるまで None

                for k in range(num_steps_scan + 1):
                    t_dist = min(k * step, max_dist)
                    px = L_pt.x + ux * t_dist
                    py = L_pt.y + uy * t_dist

                    is_safe = True
                    for inf_k in range(-inflation_steps, inflation_steps + 1):
                        cx = px + perp_x * inf_k * step
                        cy = py + perp_y * inf_k * step
                        if grid.is_obstacle(cx, cy):
                            is_safe = False
                            break

                    if is_safe:
                        w_start = Point(px, py)
                        break  # 最初の安全点が見つかったら終了

                if w_start is None:
                    self.log(f"Line {i}: entirely blocked, skipping.")
                    continue

            # --- Step 3: 終点 w_end の決定 (w_start から R_pt 方向) ---
            w_end = R_pt
            hit_obstacle = False

            if grid:
                obs_R = grid.find_first_obstacle_on_segment(
                    w_start, R_pt, inflation_radius=inflation_radius)
                if obs_R:
                    w_end = obs_R
                    hit_obstacle = True
                    self.log(f"Line {i}: obstacle found, path truncated.")

            # --- Step 4: 長さチェック ---
            if w_start.distance_to(w_end) < 0.05:
                self.log(f"Line {i}: segment too short, skipping.")
                continue

            # --- ウェイポイント出力 (常に L→R = perp_yaw) ---
            waypoints.append(self.make_waypoint(
                w_start.x, w_start.y, perp_yaw,
                options={"generated_by": "RectSearchObstacleGenerator",
                         "line_id": i, "position": "start"},
            ))
            waypoints.append(self.make_waypoint(
                w_end.x, w_end.y, perp_yaw,
                options={"generated_by": "RectSearchObstacleGenerator",
                         "line_id": i, "position": "end",
                         "hit_obstacle": hit_obstacle},
            ))

        self.log(
            f"Generated {len(waypoints)} waypoints in zigzag search with obstacle avoidance.")
        return waypoints


if __name__ == "__main__":
    RectSearchObstacleGenerator().run_from_stdin()
