"""
Morphological Noise Filter Layer Generator
============================================
マップ上のモルフォロジー演算（Opening / Closing）により、
孤立した微小障害物ノイズの消去や障害物内の穴埋めを行い、
変更差分のみを白/黒・透過のオーバーレイマスクとして出力するプラグイン。
"""

import sys
import os
import math
from typing import Dict, Any, List, Tuple, Optional

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from wpt_plugin import MapLayerGenerator, OccupancyGrid, Point, Rectangle, encode_rgba_to_png_base64


class MorphologicalNoiseFilterGenerator(MapLayerGenerator):
    def generate_layer(self, context: Dict[str, Any]) -> Dict[str, Any]:
        grid = self.get_occupancy_grid(context)
        if grid is None:
            self.log("Occupancy grid not provided; returning empty layer.")
            return {
                "name": "Empty Noise Filter Layer",
                "image_base64": encode_rgba_to_png_base64(bytes(4), 1, 1),
                "info": {
                    "resolution": 0.05,
                    "origin": [0.0, 0.0, 0.0],
                    "width": 1,
                    "height": 1,
                },
                "blend_mode": "overwrite",
            }

        roi = self.get_interaction_rect(context, "roi_region")
        mode = str(self.get_property(context, "mode", "remove_obstacles")).strip()
        noise_size = float(self.get_property(context, "noise_size", 0.10))
        kernel_shape = str(self.get_property(context, "kernel_shape", "disk")).strip()
        layer_name = str(self.get_property(context, "layer_name", "Noise Filter Layer")).strip()

        width = grid.width
        height = grid.height
        res = grid.resolution
        origin = grid.origin

        # 1. カーネル半径（セル数）およびオフセットリストの計算
        radius_cells = max(1, int(round((noise_size / 2.0) / res)))
        kernel_offsets = self._build_kernel(kernel_shape, radius_cells)

        # 2. 処理対象セルマスク（is_target）および初期グリッド状態の構築
        is_target, initial_grid = self._initialize_grids(grid, roi, width, height)

        # 3. モルフォロジー演算の実行
        current_grid = [row[:] for row in initial_grid]

        if mode == "remove_obstacles":
            # Opening: Erosion -> Dilation
            current_grid = self._erode(current_grid, is_target, kernel_offsets, width, height)
            current_grid = self._dilate(current_grid, is_target, kernel_offsets, width, height)
        elif mode == "fill_holes":
            # Closing: Dilation -> Erosion
            current_grid = self._dilate(current_grid, is_target, kernel_offsets, width, height)
            current_grid = self._erode(current_grid, is_target, kernel_offsets, width, height)
        elif mode == "both":
            # Opening followed by Closing
            current_grid = self._erode(current_grid, is_target, kernel_offsets, width, height)
            current_grid = self._dilate(current_grid, is_target, kernel_offsets, width, height)
            current_grid = self._dilate(current_grid, is_target, kernel_offsets, width, height)
            current_grid = self._erode(current_grid, is_target, kernel_offsets, width, height)

        # 4. 差分マスクおよび RGBA 画像の生成
        rgba_bytes, removed_count, filled_count = self._generate_diff_rgba(
            initial_grid, current_grid, width, height
        )

        image_base64 = encode_rgba_to_png_base64(bytes(rgba_bytes), width, height)

        self.log(
            f"Morphological Noise Filter finished [mode={mode}, size={noise_size:.2f}m, "
            f"shape={kernel_shape}, radius={radius_cells}]: removed {removed_count} obstacles, filled {filled_count} holes."
        )

        return {
            "name": layer_name,
            "image_base64": image_base64,
            "info": {
                "resolution": float(res),
                "origin": [float(origin[0]), float(origin[1]), float(origin[2]) if len(origin) > 2 else 0.0],
                "width": int(width),
                "height": int(height),
            },
            "blend_mode": "overwrite",
        }

    def _build_kernel(self, kernel_shape: str, radius: int) -> List[Tuple[int, int]]:
        offsets = []
        r_sq = radius * radius
        for dr in range(-radius, radius + 1):
            for dc in range(-radius, radius + 1):
                if kernel_shape == "cross":
                    if dr == 0 or dc == 0:
                        offsets.append((dr, dc))
                elif kernel_shape == "square":
                    offsets.append((dr, dc))
                else:  # default: "disk"
                    if dr * dr + dc * dc <= r_sq:
                        offsets.append((dr, dc))
        return offsets

    def _initialize_grids(
        self, grid: OccupancyGrid, roi: Optional[Rectangle], width: int, height: int
    ) -> Tuple[List[List[bool]], List[List[int]]]:
        is_target = [[False for _ in range(width)] for _ in range(height)]
        initial_grid = [[-1 for _ in range(width)] for _ in range(height)]

        # ROI による行・列範囲の絞り込み（バウンディングボックス）
        min_r, max_r = 0, height - 1
        min_c, max_c = 0, width - 1

        if roi is not None:
            corners = roi.get_corners()
            corner_grid_pts = [grid.world_to_grid(p.x, p.y) for p in corners]
            cols = [p[0] for p in corner_grid_pts]
            rows = [p[1] for p in corner_grid_pts]
            min_c = max(0, min(cols))
            max_c = min(width - 1, max(cols))
            min_r = max(0, min(rows))
            max_r = min(height - 1, max(rows))

        for r in range(height):
            for c in range(width):
                raw_cell = grid.get_cell(r, c)
                if raw_cell == OccupancyGrid.OBSTACLE:
                    initial_grid[r][c] = 1
                elif raw_cell == OccupancyGrid.FREE:
                    initial_grid[r][c] = 0
                else:
                    initial_grid[r][c] = -1

                if min_r <= r <= max_r and min_c <= c <= max_c:
                    if initial_grid[r][c] != -1:
                        if roi is not None:
                            wx, wy = grid.grid_to_world(r, c)
                            if roi.contains(Point(wx, wy)):
                                is_target[r][c] = True
                        else:
                            is_target[r][c] = True

        return is_target, initial_grid

    def _erode(
        self,
        src_grid: List[List[int]],
        is_target: List[List[bool]],
        kernel_offsets: List[Tuple[int, int]],
        width: int,
        height: int,
    ) -> List[List[int]]:
        """障害物 (1) の収縮演算。カーネル内に Free (0) が存在する場合、中心の障害物を 0 に削る。"""
        dst = [row[:] for row in src_grid]
        for r in range(height):
            for c in range(width):
                if is_target[r][c] and src_grid[r][c] == 1:
                    # カーネル内に Free(0) セルがあるかチェック
                    has_free_neighbor = False
                    for dr, dc in kernel_offsets:
                        nr, nc = r + dr, c + dc
                        if 0 <= nr < height and 0 <= nc < width:
                            if src_grid[nr][nc] == 0:
                                has_free_neighbor = True
                                break
                    if has_free_neighbor:
                        dst[r][c] = 0
        return dst

    def _dilate(
        self,
        src_grid: List[List[int]],
        is_target: List[List[bool]],
        kernel_offsets: List[Tuple[int, int]],
        width: int,
        height: int,
    ) -> List[List[int]]:
        """障害物 (1) の膨張演算。カーネル内に Obstacle (1) が存在する場合、中心の Free (0) を 1 に埋める。"""
        dst = [row[:] for row in src_grid]
        for r in range(height):
            for c in range(width):
                if is_target[r][c] and src_grid[r][c] == 0:
                    # カーネル内に Obstacle(1) セルがあるかチェック
                    has_obstacle_neighbor = False
                    for dr, dc in kernel_offsets:
                        nr, nc = r + dr, c + dc
                        if 0 <= nr < height and 0 <= nc < width:
                            if src_grid[nr][nc] == 1:
                                has_obstacle_neighbor = True
                                break
                    if has_obstacle_neighbor:
                        dst[r][c] = 1
        return dst

    def _generate_diff_rgba(
        self,
        initial_grid: List[List[int]],
        final_grid: List[List[int]],
        width: int,
        height: int,
    ) -> Tuple[bytearray, int, int]:
        rgba_bytes = bytearray(width * height * 4)
        removed_count = 0
        filled_count = 0
        idx = 0

        for r in range(height):
            for c in range(width):
                init_val = initial_grid[r][c]
                final_val = final_grid[r][c]

                if init_val == 1 and final_val == 0:
                    # 障害物除去 -> Free (白: 254)
                    rgba_bytes[idx] = 254
                    rgba_bytes[idx + 1] = 254
                    rgba_bytes[idx + 2] = 254
                    rgba_bytes[idx + 3] = 255
                    removed_count += 1
                elif init_val == 0 and final_val == 1:
                    # 穴埋め -> Obstacle (黒: 0)
                    rgba_bytes[idx] = 0
                    rgba_bytes[idx + 1] = 0
                    rgba_bytes[idx + 2] = 0
                    rgba_bytes[idx + 3] = 255
                    filled_count += 1
                else:
                    # 変化なし または Unknown -> 完全透過
                    rgba_bytes[idx] = 0
                    rgba_bytes[idx + 1] = 0
                    rgba_bytes[idx + 2] = 0
                    rgba_bytes[idx + 3] = 0

                idx += 4

        return rgba_bytes, removed_count, filled_count


if __name__ == "__main__":
    MorphologicalNoiseFilterGenerator().run_from_stdin()
