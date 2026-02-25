"""Tests for the WaypointGenerator base class (wpt_plugin.py)."""
import sys
import os
import json
import io
import unittest

# Add parent directory to path so we can import wpt_plugin
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from wpt_plugin import WaypointGenerator


class StubGenerator(WaypointGenerator):
    """Simple concrete implementation for testing."""
    def generate(self, context):
        return [{"x": 1.0, "y": 2.0, "yaw": 0.0}]


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
        old_stdin, old_stdout = sys.stdin, sys.stdout
        sys.stdin = io.StringIO(json.dumps(context))
        sys.stdout = captured = io.StringIO()
        try:
            gen = StubGenerator()
            gen.run_from_stdin()
        finally:
            sys.stdin, sys.stdout = old_stdin, old_stdout

        result = json.loads(captured.getvalue())
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["x"], 1.0)

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


if __name__ == '__main__':
    unittest.main()
