import sys
import os
import math

# Ensure the SDK is in the path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from wpt_plugin import WaypointGenerator

class SweepPathGenerator(WaypointGenerator):
    def generate(self, context):
        # Extract interaction data (the starting point clicked by the user)
        interaction_data = context.get("interaction_data", {})
        start_point = interaction_data.get("start_point")
        
        if not start_point:
            return [] # No point defined
            
        base_x = float(start_point.get("x", 0.0))
        base_y = float(start_point.get("y", 0.0))
        
        # Convert quaternion to yaw
        qx = float(start_point.get("qx", 0.0))
        qy = float(start_point.get("qy", 0.0))
        qz = float(start_point.get("qz", 0.0))
        qw = float(start_point.get("qw", 1.0))
        # Yaw (Z-axis rotation) from quaternion
        base_yaw = math.atan2(2.0 * (qw * qz + qx * qy), 1.0 - 2.0 * (qy * qy + qz * qz))
        
        # Extract properties
        props = context.get("properties", {})
        pitch_x = float(props.get("pitch_x", 10.0))
        pitch_y = float(props.get("pitch_y", 1.0))
        num_lines = int(props.get("num_lines", 5))
        snake_pattern = bool(props.get("snake_pattern", False))
        # Normal mode: whether to flip yaw 180° at end-of-line points (1,3,5...)
        flip_endpoint_yaw = bool(props.get("flip_endpoint_yaw", False))
        # Snake mode: whether the line endpoint faces toward the next point
        endpoint_faces_next = bool(props.get("endpoint_faces_next", False))
            
        waypoints = []
        
        # Precompute rotation sine/cosine based on base_yaw
        cos_y = math.cos(base_yaw)
        sin_y = math.sin(base_yaw)
        
        for i in range(num_lines):
            # Calculate local coordinates before rotation
            # Line starting position at Y translation
            local_startup_y = i * pitch_y
            
            # Determine if we are moving forward or backward along X for this line in a snake pattern
            is_reverse_pass = snake_pattern and (i % 2 == 1)
            
            # Determine points for this line
            local_x_start = 0.0
            local_x_end = pitch_x
            
            # If snake, the physical draw direction reverses
            # NOTE: We keep line topology connecting [0, y] to [pitch_x, y], but the actual 
            # drawn trajectory in the resulting waypoint array depends on ordering.
            # Normal sweeping:
            # Line 0: [0, 0] -> [10, 0]
            # Line 1: [0, 1] -> [10, 1]
            # Snake sweeping:
            # Line 0: [0, 0] -> [10, 0]
            # Line 1: [10, 1] -> [0, 1]
            
            p1_local_x = local_x_start if not is_reverse_pass else local_x_end
            p2_local_x = local_x_end if not is_reverse_pass else local_x_start
            
            # Rotation and translation helper
            def transform_point(lx, ly):
                world_x = base_x + (lx * cos_y - ly * sin_y)
                world_y = base_y + (lx * sin_y + ly * cos_y)
                return world_x, world_y
                
            w1_x, w1_y = transform_point(p1_local_x, local_startup_y)
            w2_x, w2_y = transform_point(p2_local_x, local_startup_y)
            
            # --- Yaw assignment ---
            if snake_pattern:
                # Snake mode: travel direction alternates per line
                forward_yaw = base_yaw
                reverse_yaw = base_yaw + math.pi
                
                if not is_reverse_pass:
                    # Forward pass (line 0, 2, 4...): travel in +X direction
                    w1_yaw = forward_yaw
                    if endpoint_faces_next:
                        # Endpoint faces toward the next line's start (perpendicular, +Y direction)
                        w2_yaw = base_yaw + math.pi / 2.0
                    else:
                        # Endpoint keeps the same yaw as the start
                        w2_yaw = forward_yaw
                else:
                    # Reverse pass (line 1, 3, 5...): travel in -X direction
                    w1_yaw = reverse_yaw
                    if endpoint_faces_next:
                        # Endpoint faces toward the next line's start (perpendicular, +Y direction) 
                        w2_yaw = base_yaw + math.pi / 2.0
                    else:
                        # Endpoint keeps the same yaw as the start (reverse)
                        w2_yaw = reverse_yaw
            else:
                # Normal mode: all lines go in the same X direction
                w1_yaw = base_yaw
                if flip_endpoint_yaw:
                    # Endpoint faces backwards (180° flip)
                    w2_yaw = base_yaw + math.pi
                else:
                    # Endpoint keeps the same yaw as start
                    w2_yaw = base_yaw
                
            # Normalize yaw between -PI and PI
            w1_yaw = math.atan2(math.sin(w1_yaw), math.cos(w1_yaw))
            w2_yaw = math.atan2(math.sin(w2_yaw), math.cos(w2_yaw))

            # Store waypoints for this segment
            waypoints.append({
                "x": round(float(w1_x), 3),
                "y": round(float(w1_y), 3),
                "yaw": round(float(w1_yaw), 3),
                "options": {
                    "generated_by": "SweepGenerator",
                    "sweep_line_id": i
                }
            })
            waypoints.append({
                "x": round(float(w2_x), 3),
                "y": round(float(w2_y), 3),
                "yaw": round(float(w2_yaw), 3),
                "options": {
                    "generated_by": "SweepGenerator",
                    "sweep_line_id": i
                }
            })
            
        return waypoints

if __name__ == "__main__":
    SweepPathGenerator().run_from_stdin()
