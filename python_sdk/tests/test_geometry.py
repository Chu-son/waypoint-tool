import unittest
import math
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from wpt_plugin.geometry import Point, Line, Rectangle, Ray
from wpt_plugin.utils import normalize_yaw

class TestGeometry(unittest.TestCase):
    def test_point_distance(self):
        p1 = Point(0, 0)
        p2 = Point(3, 4)
        self.assertEqual(p1.distance_to(p2), 5.0)

    def test_point_to_world(self):
        # Rotate (1, 0) by 90 degrees around (10, 20)
        p = Point(1, 0, 0)
        base_x, base_y, base_yaw = 10, 20, math.pi / 2
        w = p.to_world(base_x, base_y, base_yaw)
        self.assertAlmostEqual(w.x, 10.0)
        self.assertAlmostEqual(w.y, 21.0)
        self.assertAlmostEqual(w.yaw, math.pi / 2)

    def test_line_intersect(self):
        l1 = Line(Point(0, 5), Point(10, 5))
        l2 = Line(Point(5, 0), Point(5, 10))
        ipt = l1.intersect_line(l2)
        self.assertIsNotNone(ipt)
        self.assertEqual(ipt.x, 5.0)
        self.assertEqual(ipt.y, 5.0)

        l3 = Line(Point(0, 0), Point(2, 2))
        l4 = Line(Point(5, 5), Point(7, 7)) # Parallel, no overlap
        self.assertIsNone(l3.intersect_line(l4))

    def test_rectangle_contains(self):
        rect = Rectangle(Point(10, 10), 4, 4, 0)
        self.assertTrue(rect.contains(Point(11, 11)))
        self.assertFalse(rect.contains(Point(13, 13)))

        # Rotated rect
        rect_rot = Rectangle(Point(0, 0), 10, 2, math.pi / 4)
        self.assertTrue(rect_rot.contains(Point(1, 1))) # On the long axis
        self.assertFalse(rect_rot.contains(Point(2, 0))) # Outside narrow width after rotation

    def test_ray_intersect_rectangle(self):
        rect = Rectangle(Point(0, 0), 10, 10, 0)
        ray = Ray(Point(-10, 0), 0) # Points right
        hits = rect.intersect_ray(ray)
        self.assertEqual(len(hits), 2)
        # Hits at x=-5 and x=5
        x_coords = sorted([h.x for h in hits])
        self.assertAlmostEqual(x_coords[0], -5.0)
        self.assertAlmostEqual(x_coords[1], 5.0)

        ray_miss = Ray(Point(0, -10), 0) # Points right, below rect
        self.assertEqual(len(rect.intersect_ray(ray_miss)), 0)

if __name__ == '__main__':
    unittest.main()
