"""
OccupancyGrid - 占有格子マップクラス
ROS Nav2 互換の占有度値（0=空き, 100=障害物, -1=不明）を持つ。
"""
import math
from typing import Optional, Dict, Any, TYPE_CHECKING

if TYPE_CHECKING:
    from .geometry import Point


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
        import base64
        import zlib
        self._data: list = list(zlib.decompress(base64.b64decode(data["data"])))

    def get_cell(self, row: int, col: int) -> int:
        """セル値を返す。範囲外は UNKNOWN として扱う。"""
        if row < 0 or row >= self.height or col < 0 or col >= self.width:
            return self.UNKNOWN
        return self._data[row * self.width + col]

    def is_obstacle(self, world_x: float, world_y: float) -> bool:
        """ワールド座標が障害物かどうかを判定。"""
        col, row = self.world_to_grid(world_x, world_y)
        return self.get_cell(row, col) == self.OBSTACLE

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
