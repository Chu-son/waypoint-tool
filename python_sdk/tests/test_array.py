"""
Tests for wpt_plugin.array (GridArrayBackend, PurePythonGridBackend, NumpyGridBackend)
"""

import math
import os
import sys
import unittest

_parent = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, _parent)

from wpt_plugin import (
    GridArrayBackend,
    NumpyGridBackend,
    PurePythonGridBackend,
    get_grid_backend,
    set_grid_backend,
    erode,
    dilate,
    distance_transform,
    gaussian_blur,
)

try:
    import numpy as np

    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False

try:
    import scipy.ndimage as ndi  # noqa: F401

    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False


class TestPurePythonGridBackend(unittest.TestCase):
    def setUp(self):
        self.backend = PurePythonGridBackend()

    def test_empty_inputs(self):
        self.assertEqual(self.backend.erode([], 1), [])
        self.assertEqual(self.backend.dilate([], 1), [])
        self.assertEqual(self.backend.distance_transform([]), [])
        self.assertEqual(self.backend.gaussian_blur([], 1.0), [])

        self.assertEqual(self.backend.erode([[]], 1), [])
        self.assertEqual(self.backend.dilate([[]], 1), [])
        self.assertEqual(self.backend.distance_transform([[]]), [])
        self.assertEqual(self.backend.gaussian_blur([[]], 1.0), [])

    def test_zero_radius_and_sigma(self):
        grid = [[0, 1], [1, 0]]
        self.assertEqual(self.backend.erode(grid, 0), grid)
        self.assertEqual(self.backend.dilate(grid, 0), grid)

        float_grid = [[1.5, 2.5], [3.5, 4.5]]
        self.assertEqual(self.backend.gaussian_blur(float_grid, 0.0), float_grid)

    def test_erode_basic(self):
        # 5x5 grid with a 3x3 block of 1s in the center
        grid = [
            [0, 0, 0, 0, 0],
            [0, 1, 1, 1, 0],
            [0, 1, 1, 1, 0],
            [0, 1, 1, 1, 0],
            [0, 0, 0, 0, 0],
        ]
        eroded = self.backend.erode(grid, radius=1)
        expected = [
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
        ]
        self.assertEqual(eroded, expected)

    def test_dilate_basic(self):
        # 5x5 grid with a single 1 at center (2, 2)
        grid = [
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
        ]
        # Radius 1 disk offsets are (0,0), (1,0), (-1,0), (0,1), (0,-1)
        dilated = self.backend.dilate(grid, radius=1)
        expected = [
            [0, 0, 0, 0, 0],
            [0, 0, 1, 0, 0],
            [0, 1, 1, 1, 0],
            [0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0],
        ]
        self.assertEqual(dilated, expected)

    def test_erode_border_value(self):
        # 3x3 of all 1s
        grid = [[1, 1, 1], [1, 1, 1], [1, 1, 1]]
        # border_value=0: edges see 0 outside, so only center survives
        eroded_b0 = self.backend.erode(grid, radius=1, border_value=0)
        self.assertEqual(eroded_b0, [[0, 0, 0], [0, 1, 0], [0, 0, 0]])
        # border_value=1: edges see 1 outside, so all 1s survive
        eroded_b1 = self.backend.erode(grid, radius=1, border_value=1)
        self.assertEqual(eroded_b1, [[1, 1, 1], [1, 1, 1], [1, 1, 1]])

    def test_dilate_border_value(self):
        # 3x3 of all 0s
        grid = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
        # border_value=0: no 1s anywhere, remains all 0s
        dilated_b0 = self.backend.dilate(grid, radius=1, border_value=0)
        self.assertEqual(dilated_b0, [[0, 0, 0], [0, 0, 0], [0, 0, 0]])
        # border_value=1: edges see 1 outside, so border pixels become 1 (center at distance 2 is not adjacent to border)
        dilated_b1 = self.backend.dilate(grid, radius=1, border_value=1)
        self.assertEqual(dilated_b1, [[1, 1, 1], [1, 0, 1], [1, 1, 1]])

    def test_distance_transform_basic(self):
        # 3x3 grid with zero only in center
        grid = [
            [1, 1, 1],
            [1, 0, 1],
            [1, 1, 1],
        ]
        dt = self.backend.distance_transform(grid)
        self.assertAlmostEqual(dt[1][1], 0.0, places=5)
        # Direct neighbors (Manhattan distance 1)
        self.assertAlmostEqual(dt[0][1], 1.0, places=5)
        self.assertAlmostEqual(dt[2][1], 1.0, places=5)
        self.assertAlmostEqual(dt[1][0], 1.0, places=5)
        self.assertAlmostEqual(dt[1][2], 1.0, places=5)
        # Diagonal corners (Euclidean distance sqrt(2))
        sqrt2 = math.sqrt(2.0)
        self.assertAlmostEqual(dt[0][0], sqrt2, places=5)
        self.assertAlmostEqual(dt[0][2], sqrt2, places=5)
        self.assertAlmostEqual(dt[2][0], sqrt2, places=5)
        self.assertAlmostEqual(dt[2][2], sqrt2, places=5)

    def test_distance_transform_all_ones_or_zeros(self):
        # All zeros -> all distances 0.0
        grid_zeros = [[0, 0], [0, 0]]
        dt_zeros = self.backend.distance_transform(grid_zeros)
        self.assertEqual(dt_zeros, [[0.0, 0.0], [0.0, 0.0]])

        # All ones -> all distances inf
        grid_ones = [[1, 1], [1, 1]]
        dt_ones = self.backend.distance_transform(grid_ones)
        for r in range(2):
            for c in range(2):
                self.assertTrue(math.isinf(dt_ones[r][c]))

    def test_gaussian_blur_conservation(self):
        # Uniform grid should remain unchanged under reflect mode
        grid = [[5.0, 5.0, 5.0], [5.0, 5.0, 5.0], [5.0, 5.0, 5.0]]
        blurred = self.backend.gaussian_blur(grid, sigma=1.0)
        for r in range(3):
            for c in range(3):
                self.assertAlmostEqual(blurred[r][c], 5.0, places=5)

        # Single impulse in larger grid: sum of weights equals impulse
        h, w = 11, 11
        impulse_grid = [[0.0 for _ in range(w)] for _ in range(h)]
        impulse_grid[5][5] = 10.0
        blurred_impulse = self.backend.gaussian_blur(impulse_grid, sigma=1.2)
        total_sum = sum(blurred_impulse[r][c] for r in range(h) for c in range(w))
        self.assertAlmostEqual(total_sum, 10.0, places=3)
        # Peak at impulse location
        self.assertGreater(blurred_impulse[5][5], blurred_impulse[5][6])


class TestBackendEquivalence(unittest.TestCase):
    """NumPy/SciPy バックエンドと PurePython バックエンドの数学的等価性テスト。"""

    def setUp(self):
        if not HAS_NUMPY or not HAS_SCIPY:
            self.skipTest("NumPy or SciPy not available; skipping equivalence tests")
        self.py_backend = PurePythonGridBackend()
        self.np_backend = NumpyGridBackend()

        # Asymmetric 7x9 test pattern with distinct obstacle islands and holes
        self.binary_grid = [
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 1, 0, 0, 1, 1, 0],
            [0, 1, 1, 1, 1, 0, 1, 1, 0],
            [0, 1, 0, 1, 1, 1, 1, 1, 0],
            [0, 1, 1, 1, 1, 1, 1, 0, 0],
            [0, 0, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
        ]

    def test_erode_equivalence(self):
        for radius in [1, 2, 3]:
            for border_value in [0, 1]:
                py_res = self.py_backend.erode(self.binary_grid, radius=radius, border_value=border_value)
                np_res = self.np_backend.erode(self.binary_grid, radius=radius, border_value=border_value)
                self.assertEqual(py_res, np_res, f"Erode mismatch at radius {radius}, border_value {border_value}")

    def test_dilate_equivalence(self):
        for radius in [1, 2, 3]:
            for border_value in [0, 1]:
                py_res = self.py_backend.dilate(self.binary_grid, radius=radius, border_value=border_value)
                np_res = self.np_backend.dilate(self.binary_grid, radius=radius, border_value=border_value)
                self.assertEqual(py_res, np_res, f"Dilate mismatch at radius {radius}, border_value {border_value}")

    def test_distance_transform_equivalence(self):
        py_res = self.py_backend.distance_transform(self.binary_grid)
        np_res = self.np_backend.distance_transform(self.binary_grid)

        h = len(self.binary_grid)
        w = len(self.binary_grid[0])
        for r in range(h):
            for c in range(w):
                self.assertAlmostEqual(
                    py_res[r][c],
                    np_res[r][c],
                    places=5,
                    msg=f"Distance transform mismatch at ({r}, {c})",
                )

    def test_gaussian_blur_equivalence(self):
        float_grid = [[float(val) for val in row] for row in self.binary_grid]

        for sigma in [0.8, 1.2, 2.0]:
            for mode in ["reflect", "nearest"]:
                py_res = self.py_backend.gaussian_blur(float_grid, sigma=sigma, mode=mode)
                np_res = self.np_backend.gaussian_blur(float_grid, sigma=sigma, mode=mode)

                h = len(float_grid)
                w = len(float_grid[0])
                for r in range(h):
                    for c in range(w):
                        self.assertAlmostEqual(
                            py_res[r][c],
                            np_res[r][c],
                            places=4,
                            msg=f"Gaussian blur mismatch at ({r}, {c}) for sigma={sigma}, mode={mode}",
                        )


class TestBackendFactoryAndDelegates(unittest.TestCase):
    def tearDown(self):
        # Reset backend to auto-detection after test
        set_grid_backend(None)

    def test_get_grid_backend_type(self):
        backend = get_grid_backend()
        self.assertIsInstance(backend, GridArrayBackend)
        if HAS_NUMPY:
            self.assertIsInstance(backend, NumpyGridBackend)
        else:
            self.assertIsInstance(backend, PurePythonGridBackend)

    def test_set_grid_backend_override(self):
        py_backend = PurePythonGridBackend()
        set_grid_backend(py_backend)
        self.assertIs(get_grid_backend(), py_backend)

    def test_top_level_delegates(self):
        grid = [
            [0, 0, 0],
            [0, 1, 0],
            [0, 0, 0],
        ]
        dil = dilate(grid, radius=1)
        self.assertEqual(dil[1][1], 1)
        self.assertEqual(dil[0][1], 1)

        ero = erode(dil, radius=1)
        self.assertEqual(ero[1][1], 1)
        self.assertEqual(ero[0][1], 0)

        dt = distance_transform(grid)
        self.assertAlmostEqual(dt[0][0], 0.0)
        self.assertAlmostEqual(dt[1][1], 1.0)

        gb = gaussian_blur([[1.0, 1.0], [1.0, 1.0]], sigma=1.0)
        self.assertAlmostEqual(gb[0][0], 1.0)


if __name__ == "__main__":
    unittest.main()
