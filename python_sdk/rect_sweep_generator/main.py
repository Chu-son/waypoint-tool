import sys
import os
import math

# Ensure the SDK is in the path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from wpt_plugin import WaypointGenerator


class RectSweepGenerator(WaypointGenerator):
    """Generates a zigzag (boustrophedon) sweep path within a rotated rectangle.

    The rectangle is defined by center, width, height, and yaw (rotation angle).
    Sweep lines are generated in the rectangle's local coordinate system
    and then rotated into world space.

    Parameters:
        start_corner: Which corner to begin the sweep from
        sweep_direction: Whether to sweep Horizontal or Vertical
        num_lines: Number of parallel sweep lines
        snake_pattern: Whether to alternate sweep direction (boustrophedon)
    """

    def generate(self, context):
        interaction_data = context.get("interaction_data", {})
        rect_data = interaction_data.get("sweep_rect")

        if not rect_data:
            return []

        # Rectangle parameters (center/width/height/yaw format)
        center = rect_data.get("center", {})
        cx = float(center.get("x", 0.0))
        cy = float(center.get("y", 0.0))
        width = float(rect_data.get("width", 10.0))
        height = float(rect_data.get("height", 10.0))
        yaw = float(rect_data.get("yaw", 0.0))

        if width < 0.01 or height < 0.01:
            return []

        props = context.get("properties", {})
        num_lines = max(2, int(props.get("num_lines", 5)))
        snake = bool(props.get("snake_pattern", True))
        start_corner = str(props.get("start_corner", "Bottom-Left"))
        sweep_direction = str(props.get("sweep_direction", "Horizontal"))

        half_w = width / 2.0
        half_h = height / 2.0

        cos_a = math.cos(yaw)
        sin_a = math.sin(yaw)

        def to_world(lx, ly):
            """Convert local rectangle coordinates (centered at origin) to world."""
            wx = cx + lx * cos_a - ly * sin_a
            wy = cy + lx * sin_a + ly * cos_a
            return wx, wy

        # Determine sweep axis and step axis based on sweep_direction
        # Horizontal: sweep lines go along local X, step along local Y
        # Vertical:   sweep lines go along local Y, step along local X
        is_horizontal = sweep_direction == "Horizontal"

        if is_horizontal:
            sweep_half = half_w   # extent along sweep axis
            step_half = half_h    # extent along step axis
        else:
            sweep_half = half_h
            step_half = half_w

        # Determine starting signs from start_corner
        # "Bottom-Left" means start at (-halfW, +halfH) in local space
        # "Top-Left"    means start at (-halfW, -halfH)
        # "Bottom-Right" means start at (+halfW, +halfH)
        # "Top-Right"   means start at (+halfW, -halfH)
        x_sign = -1.0 if "Left" in start_corner else 1.0
        y_sign = 1.0 if "Bottom" in start_corner else -1.0

        if is_horizontal:
            sweep_start_sign = x_sign   # which side of the sweep axis to start
            step_start_sign = y_sign    # which side of the step axis to start
        else:
            sweep_start_sign = y_sign
            step_start_sign = x_sign

        line_spacing = (2.0 * step_half) / (num_lines - 1) if num_lines > 1 else 0

        waypoints = []

        for i in range(num_lines):
            # Position along step axis, from start to opposite
            step_pos = step_start_sign * step_half - step_start_sign * i * line_spacing

            is_reverse = snake and (i % 2 == 1)

            s_start = sweep_start_sign * sweep_half
            s_end = -sweep_start_sign * sweep_half

            if is_reverse:
                s_start, s_end = s_end, s_start

            # Convert to local XY
            if is_horizontal:
                start_lx, start_ly = s_start, step_pos
                end_lx, end_ly = s_end, step_pos
            else:
                start_lx, start_ly = step_pos, s_start
                end_lx, end_ly = step_pos, s_end

            # Face direction of travel in world frame
            travel_dx = end_lx - start_lx
            travel_dy = end_ly - start_ly
            travel_local_angle = math.atan2(travel_dy, travel_dx)
            travel_yaw = yaw + travel_local_angle
            # Normalize to [-pi, pi]
            travel_yaw = math.atan2(math.sin(travel_yaw), math.cos(travel_yaw))

            half = travel_yaw / 2.0
            wp_qz = math.sin(half)
            wp_qw = math.cos(half)

            # Start point
            ws_x, ws_y = to_world(start_lx, start_ly)
            waypoints.append({
                "transform": {
                    "x": round(ws_x, 6),
                    "y": round(ws_y, 6),
                    "qx": 0.0, "qy": 0.0,
                    "qz": round(wp_qz, 6),
                    "qw": round(wp_qw, 6),
                },
                "options": {
                    "generated_by": "RectSweepGenerator",
                    "sweep_line_id": i,
                    "position": "start",
                },
            })

            # End point
            we_x, we_y = to_world(end_lx, end_ly)
            waypoints.append({
                "transform": {
                    "x": round(we_x, 6),
                    "y": round(we_y, 6),
                    "qx": 0.0, "qy": 0.0,
                    "qz": round(wp_qz, 6),
                    "qw": round(wp_qw, 6),
                },
                "options": {
                    "generated_by": "RectSweepGenerator",
                    "sweep_line_id": i,
                    "position": "end",
                },
            })

        return waypoints


if __name__ == "__main__":
    RectSweepGenerator().run_from_stdin()
