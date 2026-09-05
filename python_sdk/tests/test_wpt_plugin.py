"""Tests for the WaypointGenerator base class (wpt_plugin.py)."""
import sys
import os
import json
import io
import math
import unittest

# Add parent directory to path so we can import wpt_plugin
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from wpt_plugin import WaypointGenerator, MapLayerGenerator, PathCalculator, OccupancyGrid, PluginGenerator, PluginResult



class StubGenerator(WaypointGenerator):
    """Simple concrete implementation for testing (transform format)."""
    def generate(self, context):
        return [self.make_waypoint(1.0, 2.0, 0.0)]


class EmptyGenerator(WaypointGenerator):
    """Returns empty list."""
    def generate(self, context):
        return []


class ErrorGenerator(WaypointGenerator):
    """Always raises an exception."""
    def generate(self, context):
        raise RuntimeError("generation failed")


class TestWaypointGeneratorBase(unittest.TestCase):
    """Tests for WaypointGenerator base class conformance."""

    def test_generate_not_implemented(self):
        """generate() must be overridden; base class raises NotImplementedError."""
        gen = WaypointGenerator()
        with self.assertRaises(NotImplementedError):
            gen.generate({})

    def test_run_from_stdin_with_valid_input(self):
        """run_from_stdin reads JSON from stdin, calls generate, and prints JSON result."""
        context = {"properties": {"pitch": 1.0}, "interaction_data": {"start_point": {"x": 0, "y": 0}}}
        old_stdin, old_stdout, old_stderr = sys.stdin, sys.stdout, sys.stderr
        sys.stdin = io.StringIO(json.dumps(context))
        sys.stdout = captured = io.StringIO()
        sys.stderr = io.StringIO()  # suppress validation logs
        try:
            gen = StubGenerator()
            gen.run_from_stdin()
        finally:
            sys.stdin, sys.stdout, sys.stderr = old_stdin, old_stdout, old_stderr

        result = json.loads(captured.getvalue())
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["transform"]["x"], 1.0)
        self.assertEqual(result[0]["transform"]["y"], 2.0)

    def test_run_from_stdin_empty_input(self):
        """Empty stdin should output an empty list."""
        old_stdin, old_stdout = sys.stdin, sys.stdout
        sys.stdin = io.StringIO('')
        sys.stdout = captured = io.StringIO()
        try:
            gen = EmptyGenerator()
            gen.run_from_stdin()
        finally:
            sys.stdin, sys.stdout = old_stdin, old_stdout

        result = json.loads(captured.getvalue())
        self.assertEqual(result, [])

    def test_run_from_stdin_exception_exits_nonzero(self):
        """If generate() raises an exception, the process should exit with non-zero."""
        context = {"properties": {}}
        old_stdin, old_stderr = sys.stdin, sys.stderr
        sys.stdin = io.StringIO(json.dumps(context))
        sys.stderr = io.StringIO()  # suppress error output
        try:
            gen = ErrorGenerator()
            with self.assertRaises(SystemExit) as ctx:
                gen.run_from_stdin()
            self.assertNotEqual(ctx.exception.code, 0)
        finally:
            sys.stdin, sys.stderr = old_stdin, old_stderr

    # --- Helper method tests ---

    def test_quaternion_to_yaw_identity(self):
        """Identity quaternion (qw=1) should produce yaw=0."""
        yaw = WaypointGenerator.quaternion_to_yaw({"qx": 0, "qy": 0, "qz": 0, "qw": 1})
        self.assertAlmostEqual(yaw, 0.0, places=5)

    def test_quaternion_to_yaw_90deg(self):
        """Quaternion for 90° rotation should produce yaw=π/2."""
        half = math.pi / 4
        yaw = WaypointGenerator.quaternion_to_yaw({"qx": 0, "qy": 0, "qz": math.sin(half), "qw": math.cos(half)})
        self.assertAlmostEqual(yaw, math.pi / 2, places=5)

    def test_yaw_to_quaternion_roundtrip(self):
        """yaw_to_quaternion → quaternion_to_yaw should be identity."""
        for angle in [0.0, math.pi / 4, math.pi / 2, math.pi, -math.pi / 3]:
            qx, qy, qz, qw = WaypointGenerator.yaw_to_quaternion(angle)
            recovered = WaypointGenerator.quaternion_to_yaw({"qx": qx, "qy": qy, "qz": qz, "qw": qw})
            self.assertAlmostEqual(recovered, angle, places=5)

    def test_make_waypoint_format(self):
        """make_waypoint should produce the standard transform format."""
        wp = WaypointGenerator.make_waypoint(1.0, 2.0, 0.0, options={"key": "value"})
        self.assertIn("transform", wp)
        self.assertEqual(wp["transform"]["x"], 1.0)
        self.assertEqual(wp["transform"]["y"], 2.0)
        self.assertEqual(wp["transform"]["qx"], 0.0)
        self.assertEqual(wp["transform"]["qy"], 0.0)
        self.assertAlmostEqual(wp["transform"]["qw"], 1.0, places=5)
        self.assertEqual(wp["options"]["key"], "value")

    def test_get_property(self):
        """get_property should extract values from context properties."""
        ctx = {"properties": {"pitch": 5.0}}
        self.assertEqual(WaypointGenerator.get_property(ctx, "pitch"), 5.0)
        self.assertEqual(WaypointGenerator.get_property(ctx, "missing", default=10), 10)

    def test_get_interaction_data(self):
        """get_interaction_data should retrieve input data by ID."""
        ctx = {"interaction_data": {"start_point": {"x": 1, "y": 2}}}
        data = WaypointGenerator.get_interaction_data(ctx, "start_point")
        self.assertEqual(data["x"], 1)
        self.assertIsNone(WaypointGenerator.get_interaction_data(ctx, "nonexistent"))


class StubLayerGenerator(MapLayerGenerator):
    def generate_layer(self, context):
        mask = [
            [1, 0],
            [0, 1]
        ]
        return self.create_layer_from_mask(
            mask,
            origin=[0.0, 0.0, 0.0],
            resolution=0.1,
            name="Test Layer",
            blend_mode="overwrite"
        )


class TestMapLayerGenerator(unittest.TestCase):
    def test_create_layer_from_mask(self):
        mask = [
            [1, 0, 1],
            [0, 1, 0]
        ]
        layer = MapLayerGenerator.create_layer_from_mask(
            mask, origin=[10.0, 20.0, 0.0], resolution=0.05, name="Custom Mask Layer"
        )
        self.assertEqual(layer["name"], "Custom Mask Layer")
        self.assertEqual(layer["info"]["width"], 3)
        self.assertEqual(layer["info"]["height"], 2)
        self.assertEqual(layer["info"]["resolution"], 0.05)
        self.assertEqual(layer["info"]["origin"], [10.0, 20.0, 0.0])
        self.assertTrue(layer["image_base64"].startswith("data:image/png;base64,"))

    def test_run_from_stdin_layer(self):
        old_stdin, old_stdout = sys.stdin, sys.stdout
        sys.stdin = io.StringIO(json.dumps({"properties": {}}))
        sys.stdout = captured = io.StringIO()
        try:
            gen = StubLayerGenerator()
            gen.run_from_stdin()
        finally:
            sys.stdin, sys.stdout = old_stdin, old_stdout

        result = json.loads(captured.getvalue())
        self.assertEqual(result["name"], "Test Layer")
        self.assertEqual(result["info"]["width"], 2)
        self.assertEqual(result["info"]["height"], 2)


class StubPathCalculator(PathCalculator):
    pass


class TestPathCalculator(unittest.TestCase):
    def _create_mock_grid(self, width=10, height=10, resolution=0.1, origin=(0.0, 0.0, 0.0), obstacles=None):
        import zlib
        import base64
        data_bytes = bytearray(width * height)
        # default FREE = 0
        if obstacles:
            for (r, c) in obstacles:
                if 0 <= r < height and 0 <= c < width:
                    data_bytes[r * width + c] = 100
        compressed = zlib.compress(bytes(data_bytes))
        b64 = base64.b64encode(compressed).decode('ascii')
        return OccupancyGrid({
            "width": width,
            "height": height,
            "resolution": resolution,
            "origin": list(origin),
            "data": b64
        })

    def test_find_dijkstra_path_straight(self):
        from wpt_plugin.geometry import Point
        from wpt_plugin.path import find_dijkstra_path
        # 10x10 free grid
        grid = self._create_mock_grid(10, 10, 0.1, origin=(0.0, 0.0, 0.0))
        # Start at (0.15, 0.15), Goal at (0.85, 0.85)
        start = Point(0.15, 0.15)
        goal = Point(0.85, 0.85)
        path = find_dijkstra_path(grid, start, goal, padding=0.0)
        self.assertIsNotNone(path)
        self.assertGreater(len(path), 1)
        self.assertAlmostEqual(path[0].x, start.x)
        self.assertAlmostEqual(path[0].y, start.y)
        self.assertAlmostEqual(path[-1].x, goal.x)
        self.assertAlmostEqual(path[-1].y, goal.y)

    def test_find_dijkstra_path_blocked(self):
        from wpt_plugin.geometry import Point
        from wpt_plugin.path import find_dijkstra_path
        # Wall across the middle
        obstacles = [(5, c) for c in range(10)]
        grid = self._create_mock_grid(10, 10, 0.1, origin=(0.0, 0.0, 0.0), obstacles=obstacles)
        start = Point(0.15, 0.15) # row 8 in grid
        goal = Point(0.15, 0.85)  # row 1 in grid
        path = find_dijkstra_path(grid, start, goal)
        self.assertIsNone(path)

    def test_run_from_stdin_path(self):
        old_stdin, old_stdout = sys.stdin, sys.stdout
        context = {
            "waypoints": [
                {"transform": {"x": 0.0, "y": 0.0}},
                {"transform": {"x": 1.0, "y": 0.0}}
            ],
            "properties": {}
        }
        sys.stdin = io.StringIO(json.dumps(context))
        sys.stdout = captured = io.StringIO()
        try:
            calc = StubPathCalculator()
            calc.run_from_stdin()
        finally:
            sys.stdin, sys.stdout = old_stdin, old_stdout

        result = json.loads(captured.getvalue())
        self.assertIn("segments", result)
        self.assertEqual(len(result["segments"]), 1)
        self.assertEqual(result["segments"][0][0]["x"], 0.0)
        self.assertEqual(result["segments"][0][-1]["x"], 1.0)


class DummyUnifiedPlugin(PluginGenerator):
    def generate(self, context):
        res = PluginResult()
        res.add_waypoints([
            self.make_waypoint(1.0, 2.0, 0.0, options={"speed": 1.5}),
            self.make_waypoint(3.0, 4.0, 1.57),
        ], name="Test Path", plugin_data={"total_dist": 2.82})
        
        mask = [[1, 0], [0, 1]]
        res.add_custom_layer(
            name="Test Layer",
            mask=mask,
            origin=[0.0, 0.0, 0.0],
            resolution=0.05,
            plugin_data={"coverage": 50.0}
        )
        
        res.add_annotations([
            self.make_annotation_rect(2.0, 3.0, 4.0, 5.0, name="Boundary Rect", color="#ff0000"),
            self.make_annotation_point(1.0, 2.0, name="Start Point"),
        ], name="Test Anno Group", plugin_data={"area": 20.0})
        
        res.set_plugin_data({"global_val": 42})
        return res


class TestPluginGeneratorUnified(unittest.TestCase):
    def test_plugin_result_serialization(self):
        plugin = DummyUnifiedPlugin()
        context = {"properties": {}}
        res = plugin.generate(context)
        self.assertIsInstance(res, PluginResult)
        d = res.to_dict()
        
        # Check waypoints
        self.assertIn("waypoints", d)
        self.assertEqual(len(d["waypoints"]["items"]), 2)
        self.assertEqual(d["waypoints"]["name"], "Test Path")
        self.assertEqual(d["waypoints"]["plugin_data"]["total_dist"], 2.82)
        
        # Check custom layers
        self.assertIn("custom_layers", d)
        self.assertEqual(len(d["custom_layers"]), 1)
        self.assertEqual(d["custom_layers"][0]["name"], "Test Layer")
        self.assertEqual(d["custom_layers"][0]["plugin_data"]["coverage"], 50.0)
        self.assertTrue(d["custom_layers"][0]["image_base64"].startswith("data:image/png;base64,"))
        
        # Check annotations
        self.assertIn("annotations", d)
        self.assertEqual(len(d["annotations"]["items"]), 2)
        self.assertEqual(d["annotations"]["name"], "Test Anno Group")
        self.assertEqual(d["annotations"]["plugin_data"]["area"], 20.0)
        
        # Check global plugin_data
        self.assertIn("plugin_data", d)
        self.assertEqual(d["plugin_data"]["global_val"], 42)

    def test_run_from_stdin_unified(self):
        old_stdin, old_stdout = sys.stdin, sys.stdout
        context = {"properties": {}}
        sys.stdin = io.StringIO(json.dumps(context))
        sys.stdout = captured = io.StringIO()
        try:
            plugin = DummyUnifiedPlugin()
            plugin.run_from_stdin()
        finally:
            sys.stdin, sys.stdout = old_stdin, old_stdout

        result = json.loads(captured.getvalue())
        self.assertIn("waypoints", result)
        self.assertIn("custom_layers", result)
        self.assertIn("annotations", result)
        self.assertIn("plugin_data", result)

    def test_get_plugin_data_helper(self):
        plugin = DummyUnifiedPlugin()
        layer = {"name": "L1", "plugin_data": {"val": 123}}
        anno = {"name": "A1", "plugin_data": {"val": 456}}
        raw = {"name": "NoData"}
        
        self.assertEqual(plugin.get_plugin_data(layer), {"val": 123})
        self.assertEqual(plugin.get_plugin_data(anno), {"val": 456})
        self.assertIsNone(plugin.get_plugin_data(raw))
        self.assertIsNone(plugin.get_plugin_data(None))

    def test_get_selected_points(self):
        gen = StubGenerator()
        
        # Test with points
        context = {
            "selected_points": [
                {"x": 1.5, "y": 2.5, "qz": 0.0, "qw": 1.0},
                {"x": 3.0, "y": 4.0, "yaw": 0.5}
            ]
        }
        points = gen.get_selected_points(context)
        self.assertEqual(len(points), 2)
        self.assertEqual(points[0].x, 1.5)
        self.assertEqual(points[0].y, 2.5)
        self.assertAlmostEqual(points[0].yaw, 0.0, places=4)
        self.assertEqual(points[1].x, 3.0)
        self.assertEqual(points[1].y, 4.0)

        # Test empty or missing
        self.assertEqual(gen.get_selected_points({}), [])
        self.assertEqual(gen.get_selected_points({"selected_points": None}), [])
        self.assertEqual(gen.get_selected_points({"selected_points": []}), [])


if __name__ == '__main__':
    unittest.main()


