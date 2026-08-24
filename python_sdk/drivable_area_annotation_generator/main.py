"""
Drivable Area from Annotations
==============================
アノテーション機能で配置された複数の Point オブジェクトをシード座標として取得し、
そこから走行可能領域をFlood-fill探索してマップオーバーレイレイヤーを生成するプラグイン。
"""

import sys
import os
import math
from collections import deque

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from wpt_plugin import MapLayerGenerator, OccupancyGrid, Point


class DrivableAreaAnnotationGenerator(MapLayerGenerator):
    def generate_layer(self, context):
        # 1. アノテーションから Point オブジェクトの座標を抽出
        annos = self.get_annotations(context, "seed_annotations")
        seeds = []
        for a in annos:
            if isinstance(a, dict):
                if "x" in a and "y" in a:
                    seeds.append(Point(float(a["x"]), float(a["y"])))
                elif "cx" in a and "cy" in a:
                    seeds.append(Point(float(a["cx"]), float(a["cy"])))
                elif "x1" in a and "y1" in a:
                    seeds.append(Point(float(a["x1"]), float(a["y1"])))
                elif "center" in a and isinstance(a["center"], dict):
                    seeds.append(Point(float(a["center"].get("x", 0.0)), float(a["center"].get("y", 0.0))))
        
        # フォールバック: 単一アノテーション入力または interaction_point
        if not seeds:
            single = self.get_annotation(context, "seed_annotations")
            if single and isinstance(single, dict):
                if "x" in single and "y" in single:
                    seeds.append(Point(float(single["x"]), float(single["y"])))
                elif "cx" in single and "cy" in single:
                    seeds.append(Point(float(single["cx"]), float(single["cy"])))
                elif "x1" in single and "y1" in single:
                    seeds.append(Point(float(single["x1"]), float(single["y1"])))
                elif "center" in single and isinstance(single["center"], dict):
                    seeds.append(Point(float(single["center"].get("x", 0.0)), float(single["center"].get("y", 0.0))))

        if not seeds:
            seeds = [Point(0.0, 0.0)]

        grid = self.get_occupancy_grid(context)
        footprint = self.get_robot_footprint(context)

        max_radius = float(self.get_property(context, "max_radius", 10.0))
        use_robot_footprint = bool(self.get_property(context, "use_robot_footprint", True))
        extra_margin = float(self.get_property(context, "extra_margin", 0.05))
        allow_unknown = bool(self.get_property(context, "allow_unknown", False))
        dilation_cells = int(self.get_property(context, "dilation_cells", 0))
        layer_color = str(self.get_property(context, "layer_color", "#22c55e")).strip()
        fill_opacity = float(self.get_property(context, "fill_opacity", 0.6))

        # Parse color hex and opacity
        hex_str = layer_color.lstrip("#")
        if len(hex_str) == 6:
            r = int(hex_str[0:2], 16)
            g = int(hex_str[2:4], 16)
            b = int(hex_str[4:6], 16)
        else:
            r, g, b = 34, 197, 94
        alpha = max(0, min(255, int(fill_opacity * 255)))
        color_rgba = (r, g, b, alpha)

        # Calculate required clearance from obstacles
        robot_radius = 0.0
        if use_robot_footprint and footprint is not None:
            robot_radius = footprint.get_bounding_radius()

        clearance = robot_radius + max(0.0, extra_margin)

        if grid is None:
            # マップがない場合は全シードを内包する仮想グリッドを作成
            res = 0.05
            min_x = min(s.x for s in seeds) - max_radius - 1.0
            max_x = max(s.x for s in seeds) + max_radius + 1.0
            min_y = min(s.y for s in seeds) - max_radius - 1.0
            max_y = max(s.y for s in seeds) + max_radius + 1.0

            width = max(100, int(math.ceil((max_x - min_x) / res)))
            height = max(100, int(math.ceil((max_y - min_y) / res)))
            origin = [min_x, min_y, 0.0]
            mask = [[0 for _ in range(width)] for _ in range(height)]
            max_radius_sq = max_radius * max_radius

            for row_idx in range(height):
                world_y = min_y + (row_idx + 0.5) * res
                for col_idx in range(width):
                    world_x = min_x + (col_idx + 0.5) * res
                    for s in seeds:
                        if (world_x - s.x) ** 2 + (world_y - s.y) ** 2 <= max_radius_sq:
                            mask[row_idx][col_idx] = 1
                            break

            return self.create_layer_from_mask(
                mask,
                origin=origin,
                resolution=res,
                name="Drivable Area (Annotations)",
                blend_mode="overwrite",
                color_rgba=color_rgba,
            )

        width = grid.width
        height = grid.height
        res = grid.resolution
        origin = grid.origin

        def is_cell_traversable(r_pos: int, c_pos: int) -> bool:
            if r_pos < 0 or r_pos >= height or c_pos < 0 or c_pos >= width:
                return False
            if grid.is_obstacle_cell(r_pos, c_pos):
                return False
            if not allow_unknown:
                return grid.is_free_cell(r_pos, c_pos)
            return True

        def is_inflation_source(r_pos: int, c_pos: int) -> bool:
            if grid.is_obstacle_cell(r_pos, c_pos):
                return True
            if not allow_unknown and grid.is_unknown_cell(r_pos, c_pos):
                return True
            return False

        # 1. 障害物および進入禁止境界からのクリアランス（インフレーション）マップを構築
        clearance_cells = int(math.ceil(clearance / res)) if clearance > 0 else 0
        blocked = [[False for _ in range(width)] for _ in range(height)]

        if clearance_cells > 0:
            clearance_sq = clearance_cells * clearance_cells
            visited_inflated = [[False for _ in range(width)] for _ in range(height)]
            dist_queue = deque()

            for row_idx in range(height):
                for col_idx in range(width):
                    if is_inflation_source(row_idx, col_idx):
                        dist_queue.append((row_idx, col_idx, row_idx, col_idx))
                        visited_inflated[row_idx][col_idx] = True
                        blocked[row_idx][col_idx] = True

            while dist_queue:
                cr, cc, orgr, orgc = dist_queue.popleft()
                for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    nr, nc = cr + dr, cc + dc
                    if 0 <= nr < height and 0 <= nc < width and not visited_inflated[nr][nc]:
                        if (nr - orgr) ** 2 + (nc - orgc) ** 2 <= clearance_sq:
                            visited_inflated[nr][nc] = True
                            blocked[nr][nc] = True
                            dist_queue.append((nr, nc, orgr, orgc))
        else:
            for row_idx in range(height):
                for col_idx in range(width):
                    if is_inflation_source(row_idx, col_idx):
                        blocked[row_idx][col_idx] = True

        # 2. 全シード位置の特定と初期キュー投入
        mask = [[0 for _ in range(width)] for _ in range(height)]
        visited = set()
        queue = deque()

        for seed in seeds:
            seed_c, seed_r = grid.world_to_grid(seed.x, seed.y)
            seed_c = max(0, min(width - 1, seed_c))
            seed_r = max(0, min(height - 1, seed_r))

            # シードが障害物クリアランス内の場合、近傍の非ブロック・通行可能セルを探索
            start_r, start_c = seed_r, seed_c
            if blocked[seed_r][seed_c] or not is_cell_traversable(seed_r, seed_c):
                found_free = False
                for radius in range(1, max(clearance_cells + 2, 10)):
                    for dr in range(-radius, radius + 1):
                        for dc in range(-radius, radius + 1):
                            nr, nc = seed_r + dr, seed_c + dc
                            if 0 <= nr < height and 0 <= nc < width:
                                if not blocked[nr][nc] and is_cell_traversable(nr, nc):
                                    start_r, start_c = nr, nc
                                    found_free = True
                                    break
                        if found_free:
                            break
                    if found_free:
                        break

            if not blocked[start_r][start_c] and is_cell_traversable(start_r, start_c):
                if (start_r, start_c) not in visited:
                    queue.append((start_r, start_c, seed_r, seed_c))
                    visited.add((start_r, start_c))

        max_radius_cells_sq = (max_radius / res) ** 2

        # 3. BFS Flood-fill 走行可能領域拡張 (Multi-source BFS)
        while queue:
            curr_r, curr_c, org_r, org_c = queue.popleft()
            mask[curr_r][curr_c] = 1

            for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nr, nc = curr_r + dr, curr_c + dc
                if 0 <= nr < height and 0 <= nc < width:
                    if (nr, nc) not in visited and not blocked[nr][nc]:
                        # 起点シードからの距離制限チェック
                        dist_sq = (nr - org_r) ** 2 + (nc - org_c) ** 2
                        if dist_sq <= max_radius_cells_sq:
                            if is_cell_traversable(nr, nc):
                                visited.add((nr, nc))
                                queue.append((nr, nc, org_r, org_c))

        # 4. オプション：Dilation（領域膨張）
        if dilation_cells > 0:
            dilated_mask = [row[:] for row in mask]
            for r_idx in range(height):
                for c_idx in range(width):
                    if mask[r_idx][c_idx] == 1:
                        for dr in range(-dilation_cells, dilation_cells + 1):
                            for dc in range(-dilation_cells, dilation_cells + 1):
                                if dr * dr + dc * dc <= dilation_cells * dilation_cells:
                                    nr, nc = r_idx + dr, c_idx + dc
                                    if 0 <= nr < height and 0 <= nc < width:
                                        if not blocked[nr][nc] and is_cell_traversable(nr, nc):
                                            dilated_mask[nr][nc] = 1
            mask = dilated_mask

        seed_desc = f"{len(seeds)} annotation seed(s)" if len(seeds) > 1 else f"annotation seed ({seeds[0].x:.2f}, {seeds[0].y:.2f})"
        self.log(
            f"Generated drivable area layer from {seed_desc} "
            f"[clearance={clearance:.2f}m, allow_unknown={allow_unknown}, color={layer_color}, opacity={fill_opacity:.2f}]"
        )

        return self.create_layer_from_mask(
            mask,
            origin=origin,
            resolution=res,
            name="Drivable Area (Annotations)",
            blend_mode="overwrite",
            color_rgba=color_rgba,
        )


if __name__ == "__main__":
    DrivableAreaAnnotationGenerator().run_from_stdin()

