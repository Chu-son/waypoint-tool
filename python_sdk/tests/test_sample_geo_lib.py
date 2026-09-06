"""
Tests for sample_geo_lib library plugin
"""

import math
import os
import sys
import unittest

_lib_dir = os.path.join(os.path.dirname(__file__), "..", "sample_geo_lib")
sys.path.insert(0, _lib_dir)

from sample_geo_lib import polygon_area, smooth_trajectory, path_length


class TestSampleGeoLib(unittest.TestCase):
    def test_polygon_area_square(self):
        # 2x2 square: area should be 4.0
        square = [(0.0, 0.0), (2.0, 0.0), (2.0, 2.0), (0.0, 2.0)]
        self.assertAlmostEqual(polygon_area(square), 4.0, places=5)

    def test_polygon_area_triangle(self):
        # Right triangle with base 3, height 4: area 6.0
        triangle = [(0.0, 0.0), (3.0, 0.0), (0.0, 4.0)]
        self.assertAlmostEqual(polygon_area(triangle), 6.0, places=5)

    def test_polygon_area_degenerate(self):
        self.assertEqual(polygon_area([]), 0.0)
        self.assertEqual(polygon_area([(1.0, 1.0)]), 0.0)
        self.assertEqual(polygon_area([(1.0, 1.0), (2.0, 2.0)]), 0.0)

    def test_smooth_trajectory_endpoints_preserved(self):
        pts = [(0.0, 0.0), (5.0, 10.0), (10.0, 0.0)]
        smoothed = smooth_trajectory(pts, alpha=0.25, iterations=2)
        self.assertGreater(len(smoothed), len(pts))
        self.assertEqual(smoothed[0], (0.0, 0.0))
        self.assertEqual(smoothed[-1], (10.0, 0.0))

    def test_smooth_trajectory_short(self):
        pts = [(1.0, 2.0), (3.0, 4.0)]
        self.assertEqual(smooth_trajectory(pts), [(1.0, 2.0), (3.0, 4.0)])

    def test_path_length(self):
        # (0,0) -> (3,0) [length 3] -> (3,4) [length 4] => total length 7.0
        pts = [(0.0, 0.0), (3.0, 0.0), (3.0, 4.0)]
        self.assertAlmostEqual(path_length(pts), 7.0, places=5)
        self.assertEqual(path_length([]), 0.0)
        self.assertEqual(path_length([(1.0, 1.0)]), 0.0)


if __name__ == "__main__":
    unittest.main()
