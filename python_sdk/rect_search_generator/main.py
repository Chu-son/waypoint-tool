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


class RectSearchGenerator(WaypointGenerator):
    """矩形領域内でジグザグ走査パスを生成するプラグイン。
    """

    def generate(self, context):
        rect = self.get_interaction_rect(context, "sweep_rect")
        if not rect:
            return []

        if rect.width < 0.01 or rect.height < 0.01:
            return []

        # プロパティの取得
        num_lines = max(2, int(self.get_property(context, "num_lines", default=5)))
        start_corner = str(self.get_property(context, "start_corner", default="Bottom-Left"))
        sweep_direction = str(self.get_property(context, "sweep_direction", default="Horizontal"))

        # 1. 矩形の頂点を取得 (0:BL, 1:BR, 2:TR, 3:TL)
        corners = rect.get_corners()
        
        # 2. 基準となる辺 (Reference Line) を決定
        is_horizontal = (sweep_direction == "Horizontal")
        is_left = "Left" in start_corner
        is_bottom = "Bottom" in start_corner
        
        if is_horizontal:
            if is_left:
                ref_line = Line(corners[0], corners[3]) if is_bottom else Line(corners[3], corners[0])
                perp_clockwise = is_bottom
            else:
                ref_line = Line(corners[1], corners[2]) if is_bottom else Line(corners[2], corners[1])
                perp_clockwise = not is_bottom
        else:
            if is_bottom:
                ref_line = Line(corners[0], corners[1]) if is_left else Line(corners[1], corners[0])
                perp_clockwise = not is_left
            else:
                ref_line = Line(corners[3], corners[2]) if is_left else Line(corners[2], corners[3])
                perp_clockwise = is_left

        perp_yaw = ref_line.perpendicular_yaw(clockwise=perp_clockwise)

        waypoints = []
        for i in range(num_lines):
            t = i / (num_lines - 1)
            start_pt = Point(
                ref_line.p1.x + t * (ref_line.p2.x - ref_line.p1.x),
                ref_line.p1.y + t * (ref_line.p2.y - ref_line.p1.y)
            )
            
            ray = Ray(start_pt, perp_yaw)
            hits = rect.intersect_ray(ray)
            
            end_pt = None
            max_dist = -1.0
            for h in hits:
                d = start_pt.distance_to(h)
                if d > max_dist:
                    max_dist = d
                    end_pt = h
            
            if not end_pt or max_dist < 0.001:
                continue

            # 進行方向
            line_yaw = perp_yaw
            # 常にジグザグ走査（偶数行ごとに反転）
            is_reverse = (i % 2 == 1)
            
            w_start, w_end = start_pt, end_pt
            if is_reverse:
                w_start, w_end = end_pt, start_pt
                line_yaw = normalize_yaw(perp_yaw + math.pi)

            waypoints.append(self.make_waypoint(
                w_start.x, w_start.y, line_yaw,
                options={
                    "generated_by": "RectSearchGenerator",
                    "line_id": i,
                    "position": "start",
                },
            ))

            waypoints.append(self.make_waypoint(
                w_end.x, w_end.y, line_yaw,
                options={
                    "generated_by": "RectSearchGenerator",
                    "line_id": i,
                    "position": "end",
                },
            ))

        self.log(f"Generated {len(waypoints)} waypoints in zigzag search.")
        return waypoints


if __name__ == "__main__":
    RectSearchGenerator().run_from_stdin()
