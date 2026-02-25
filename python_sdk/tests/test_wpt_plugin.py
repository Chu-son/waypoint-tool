"""Tests for the WaypointGenerator base class (wpt_plugin.py)."""
import sys
import os
import json
import io
import math
import unittest

# Add parent directory to path so we can import wpt_plugin
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from wpt_plugin import WaypointGenerator


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


if __name__ == '__main__':
    unittest.main()
