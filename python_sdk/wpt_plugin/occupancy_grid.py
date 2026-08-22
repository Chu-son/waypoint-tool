"""
OccupancyGrid - 占有格子マップクラス
ROS Nav2 互換の占有度値（0=空き, 100=障害物, -1=不明）を持つ。
"""
import math
from typing import Optional, Dict, Any, TYPE_CHECKING

if TYPE_CHECKING:
    from .geometry import Point
    from .footprint import RobotFootprint


class OccupancyGrid:
    """占有格子マップを表すクラス。

    context["occupancy_grid"] の辞書から構築する。
    座標系は ROS 標準（origin = 画像左下のワールド座標）に準拠。
    """

    FREE = 0
    OBSTACLE = 100
    UNKNOWN = -1

    def __init__(self, data: Dict[str, Any]):
        self.width: int = data["width"]
        self.height: int = data["height"]
        self.resolution: float = data["resolution"]
        self.origin: list = data["origin"]   # [x, y, yaw]

        # Load cell value definitions from protocol metadata if present
        cell_vals = data.get("cell_values", {})
        self.FREE: int = cell_vals.get("free", 0)
        self.OBSTACLE: int = cell_vals.get("obstacle", 100)
        self.UNKNOWN: int = cell_vals.get("unknown", -1)

        import base64
        import zlib
        import struct
        raw_bytes = zlib.decompress(base64.b64decode(data["data"]))
        # Decompress signed 8-bit integers (int8: -128..127) so 0xFF becomes -1 (UNKNOWN)
        self._data: list = list(struct.unpack(f"{len(raw_bytes)}b", raw_bytes))

    def get_cell(self, row: int, col: int) -> int:
        """セル値を返す。範囲外は UNKNOWN (-1) として扱う。"""
        if row < 0 or row >= self.height or col < 0 or col >= self.width:
            return self.UNKNOWN
        return self._data[row * self.width + col]

    def is_free_cell(self, row: int, col: int) -> bool:
        """指定のグリッドセルが自由空間（Free）かどうかを判定。"""
        return self.get_cell(row, col) == self.FREE

    def is_obstacle_cell(self, row: int, col: int) -> bool:
        """指定のグリッドセルが障害物（Obstacle）かどうかを判定。"""
        return self.get_cell(row, col) == self.OBSTACLE

    def is_unknown_cell(self, row: int, col: int) -> bool:
        """指定のグリッドセルが不明領域（Unknown）かどうかを判定。"""
        return self.get_cell(row, col) == self.UNKNOWN

    def is_free(self, world_x: float, world_y: float) -> bool:
        """ワールド座標が自由空間（Free）かどうかを判定。"""
        col, row = self.world_to_grid(world_x, world_y)
        return self.is_free_cell(row, col)

    def is_obstacle(self, world_x: float, world_y: float) -> bool:
        """ワールド座標が障害物（Obstacle）かどうかを判定。"""
        col, row = self.world_to_grid(world_x, world_y)
        return self.is_obstacle_cell(row, col)

    def is_unknown(self, world_x: float, world_y: float) -> bool:
        """ワールド座標が不明領域（Unknown）かどうかを判定。"""
        col, row = self.world_to_grid(world_x, world_y)
        return self.is_unknown_cell(row, col)

    def world_to_grid(self, world_x: float, world_y: float):
        """ワールド座標 → (col, row) のグリッドインデックスに変換。"""
        ox, oy = self.origin[0], self.origin[1]
        col = math.floor((world_x - ox) / self.resolution)
        row = self.height - 1 - math.floor((world_y - oy) / self.resolution)
        return col, row

    def grid_to_world(self, row: int, col: int):
        """(row, col) → ワールド座標 (x, y) のセル中心を返す。"""
        ox, oy = self.origin[0], self.origin[1]
        world_x = ox + (col + 0.5) * self.resolution
        world_y = oy + (self.height - 1 - row + 0.5) * self.resolution
        return world_x, world_y

    def find_first_obstacle_on_segment(
        self,
        p1: "Point",
        p2: "Point",
        inflation_radius: float = 0.0,
    ) -> Optional["Point"]:
        """p1 → p2 の線分上で最初に出現する障害物のワールド座標を返す。

        ロボットの幅に相当する inflation_radius 分だけ線分を膨らませた矩形帯を
        resolution ステップでスキャンし、最初の障害物セルのサンプル点を返す。

        Returns:
            最初の障害物のワールド座標（サンプル点位置）、なければ None
        """
        from .geometry import Point as Pt

        dist = p1.distance_to(p2)
        if dist < 1e-9:
            return None

        # 進行方向の単位ベクトルと直交ベクトル
        dx = (p2.x - p1.x) / dist
        dy = (p2.y - p1.y) / dist
        perp_x, perp_y = -dy, dx

        step = self.resolution * 0.5
        num_steps = int(dist / step) + 1
        inflation_steps = max(0, math.ceil(inflation_radius / self.resolution))

        for i in range(num_steps):
            t = min(i * step, dist)
            sx = p1.x + dx * t
            sy = p1.y + dy * t

            for k in range(-inflation_steps, inflation_steps + 1):
                cx = sx + perp_x * k * self.resolution
                cy = sy + perp_y * k * self.resolution
                if self.is_obstacle(cx, cy):
                    return Pt(sx, sy)

        return None

    def is_footprint_colliding(
        self,
        footprint: 'RobotFootprint',
        x: float,
        y: float,
        yaw: float,
        padding: float = 0.0,
    ) -> bool:
        """Check if the robot footprint placed at pose (x, y, yaw) intersects with any obstacle cell.

        Args:
            footprint: RobotFootprint instance.
            x: Robot center X in world coordinates.
            y: Robot center Y in world coordinates.
            yaw: Robot orientation yaw in radians.
            padding: Extra safety inflation margin in meters (default 0.0).

        Returns:
            True if any occupied cell intersects with the footprint area, False otherwise.
        """
        bounding_radius = footprint.get_bounding_radius() + padding
        min_world_x = x - bounding_radius
        max_world_x = x + bounding_radius
        min_world_y = y - bounding_radius
        max_world_y = y + bounding_radius

        min_col, max_row = self.world_to_grid(min_world_x, min_world_y)
        max_col, min_row = self.world_to_grid(max_world_x, max_world_y)

        # Clamp to grid bounds
        min_col = max(0, min_col)
        max_col = min(self.width - 1, max_col)
        min_row = max(0, min_row)
        max_row = min(self.height - 1, max_row)

        for r in range(min_row, max_row + 1):
            for c in range(min_col, max_col + 1):
                if self.get_cell(r, c) == self.OBSTACLE:
                    cell_x, cell_y = self.grid_to_world(r, c)

                    if footprint.type == "circular":
                        if math.hypot(cell_x - x, cell_y - y) <= (footprint.radius + padding):
                            return True
                    elif footprint.type == "rectangular":
                        # Transform cell into robot local frame
                        dx = cell_x - x
                        dy = cell_y - y
                        cos_yaw = math.cos(-yaw)
                        sin_yaw = math.sin(-yaw)
                        lx = dx * cos_yaw - dy * sin_yaw
                        ly = dx * sin_yaw + dy * cos_yaw

                        half_l = (footprint.length / 2.0) + padding
                        half_w = (footprint.width / 2.0) + padding
                        if (abs(lx - footprint.offset_x) <= half_l and abs(ly - footprint.offset_y) <= half_w):
                            return True
                    elif footprint.type == "polygon":
                        if footprint.is_point_inside(cell_x, cell_y, x, y, yaw):
                            return True
                        # If padding is set, also check distance to polygon vertices
                        if padding > 0:
                            world_pts = footprint.to_world(x, y, yaw)
                            for wpt in world_pts:
                                if math.hypot(cell_x - wpt.x, cell_y - wpt.y) <= padding:
                                    return True

        return False

