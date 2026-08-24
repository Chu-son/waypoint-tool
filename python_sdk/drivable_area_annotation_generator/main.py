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
            if isinstance(a, dict) and "x" in a and "y" in a:
                seeds.append(Point(float(a["x"]), float(a["y"])))
        
        # フォールバック: 単一アノテーション入力または interaction_point
        if not seeds:
            single = self.get_annotation(context, "seed_annotations")
            if single and isinstance(single, dict) and "x" in single and "y" in single:
                seeds.append(Point(float(single["x"]), float(single["y"])))

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

        max_radius_sq = max_radius * max_radius

        for s in seeds:
            scol, srow = grid.world_to_grid(s.x, s.y)
            if not is_cell_traversable(srow, scol) or blocked[srow][scol]:
                # シードが障害物近傍にある場合、近隣3x3セルで空いているセルを探す
                found = False
                for dr in [-1, 0, 1]:
                    for dc in [-1, 0, 1]:
                        nr, nc = srow + dr, scol + dc
                        if is_cell_traversable(nr, nc) and not blocked[nr][nc]:
                            srow, scol = nr, nc
                            found = True
                            break
                    if found:
                        break

            if is_cell_traversable(srow, scol) and not blocked[srow][scol]:
                if (srow, scol) not in visited:
                    visited.add((srow, scol))
                    queue.append((srow, scol, s.x, s.y))
                    mask[srow][scol] = 1

        # 3. 4近傍 Multi-source BFS による走行可能領域の拡張
        while queue:
            r, c, seed_wx, seed_wy = queue.popleft()
            for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nr, nc = r + dr, c + dc
                if (nr, nc) not in visited and 0 <= nr < height and 0 <= nc < width:
                    if is_cell_traversable(nr, nc) and not blocked[nr][nc]:
                        n_wx, n_wy = grid.grid_to_world(nc, nr)
                        if (n_wx - seed_wx) ** 2 + (n_wy - seed_wy) ** 2 <= max_radius_sq:
                            visited.add((nr, nc))
                            mask[nr][nc] = 1
                            queue.append((nr, nc, seed_wx, seed_wy))

        # 4. オプション: Dilation（膨張）処理
        if dilation_cells > 0:
            dilated = [row[:] for row in mask]
            for r in range(height):
                for c in range(width):
                    if mask[r][c] == 1:
                        for dr in range(-dilation_cells, dilation_cells + 1):
                            for dc in range(-dilation_cells, dilation_cells + 1):
                                nr, nc = r + dr, c + dc
                                if 0 <= nr < height and 0 <= nc < width:
                                    if is_cell_traversable(nr, nc):
                                        dilated[nr][nc] = 1
            mask = dilated

        self.log(
            f"Generated drivable area layer from {len(seeds)} annotation seed(s) "
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

