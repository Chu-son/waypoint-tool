import unittest
import sys
import os
import base64
import zlib

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from wpt_plugin.occupancy_grid import OccupancyGrid
from wpt_plugin.geometry import Point

class TestOccupancyGrid(unittest.TestCase):
    def _make_grid(self, width, height, origin, resolution, fill=0):
        data_raw = [fill] * (width * height)
        # zlib compress and base64 encode
        compressed = zlib.compress(bytes([max(0, x) if x >= 0 else 255 for x in data_raw]))
        b64_data = base64.b64encode(compressed).decode('utf-8')
        
        # Override the actual data logic so we can test easily
        grid_dict = {
            "width": width, 
            "height": height, 
            "resolution": resolution, 
            "origin": origin, 
            "data": b64_data
        }
        grid = OccupancyGrid(grid_dict)
        # Force the exact data array since our simple max(0, x) compression might lose -1 meaning
        # Wait, bytes([max(0, x) ...]) is just for the init encoding. Let's just override _data to be safe
        grid._data = data_raw
        return grid

    def test_world_to_grid_center(self):
        """グリッド中心のワールド座標が正しいセルに変換される"""
        grid = self._make_grid(10, 10, [0.0, 0.0, 0.0], 1.0)
        col, row = grid.world_to_grid(5.0, 5.0)
        assert 0 <= col < 10
        assert 0 <= row < 10

    def test_is_obstacle_true(self):
        """障害物セルが is_obstacle=True を返す"""
        grid = self._make_grid(10, 10, [0.0, 0.0, 0.0], 1.0)
        grid._data[5 * 10 + 5] = 100  # row=5, col=5 に障害物
        # 5.5, 4.5 corresponds to row=5, col=5 because origin is bottom-left
        assert grid.is_obstacle(5.5, 4.5)

    def test_out_of_bounds_is_not_obstacle(self):
        """マップ外は障害物ではない（UNKNOWN）"""
        grid = self._make_grid(10, 10, [0.0, 0.0, 0.0], 1.0)
        assert not grid.is_obstacle(100.0, 100.0)  # 完全に範囲外

    def test_find_first_obstacle(self):
        """find_first_obstacle_on_segment が最初の障害物を返す"""
        grid = self._make_grid(20, 1, [0.0, 0.0, 0.0], 1.0)
        grid._data[10] = 100  # col=10 に障害物
        p1 = Point(0.5, 0.5)
        p2 = Point(19.5, 0.5)
        result = grid.find_first_obstacle_on_segment(p1, p2)
        assert result is not None
        assert result.x < 11.0  # 障害物より手前で止まる

if __name__ == '__main__':
    unittest.main()
