use serde::{Deserialize, Serialize};
use std::f64::consts::PI;
use std::io::{self, Read};

#[derive(Deserialize)]
struct Context {
    #[serde(default)]
    properties: Properties,
    #[serde(default)]
    interaction_data: InteractionData,
}

#[derive(Deserialize, Default)]
struct Properties {
    #[serde(default = "default_pitch_x")]
    pitch_x: f64,
    #[serde(default = "default_pitch_y")]
    pitch_y: f64,
    #[serde(default = "default_num_lines")]
    num_lines: u32,
    #[serde(default)]
    snake_pattern: bool,
    #[serde(default)]
    flip_endpoint_yaw: bool,
    #[serde(default)]
    endpoint_faces_next: bool,
}

fn default_pitch_x() -> f64 { 10.0 }
fn default_pitch_y() -> f64 { 1.0 }
fn default_num_lines() -> u32 { 5 }
fn default_true() -> bool { true }

#[derive(Deserialize, Default)]
struct InteractionData {
    start_point: Option<StartPoint>,
}

#[derive(Deserialize)]
struct StartPoint {
    #[serde(default)]
    x: f64,
    #[serde(default)]
    y: f64,
    #[serde(default)]
    qx: f64,
    #[serde(default)]
    qy: f64,
    #[serde(default)]
    qz: f64,
    #[serde(default = "default_qw")]
    qw: f64,
}

fn default_qw() -> f64 { 1.0 }

#[derive(Serialize)]
struct Waypoint {
    x: f64,
    y: f64,
    yaw: f64,
    options: WaypointOptions,
}

#[derive(Serialize)]
struct WaypointOptions {
    generated_by: String,
    sweep_line_id: u32,
}

fn normalize_yaw(yaw: f64) -> f64 {
    yaw.sin().atan2(yaw.cos())
}

fn round3(v: f64) -> f64 {
    (v * 1000.0).round() / 1000.0
}

fn main() {
    // Read JSON context from stdin
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap_or_default();

    let context: Context = match serde_json::from_str(&input) {
        Ok(c) => c,
        Err(_) => {
            println!("[]");
            return;
        }
    };

    let start_point = match context.interaction_data.start_point {
        Some(sp) => sp,
        None => {
            println!("[]");
            return;
        }
    };

    let base_x = start_point.x;
    let base_y = start_point.y;

    // Quaternion to yaw conversion
    let base_yaw = (2.0 * (start_point.qw * start_point.qz + start_point.qx * start_point.qy))
        .atan2(1.0 - 2.0 * (start_point.qy * start_point.qy + start_point.qz * start_point.qz));

    let props = &context.properties;
    let pitch_x = props.pitch_x;
    let pitch_y = props.pitch_y;
    let num_lines = props.num_lines;
    let snake_pattern = props.snake_pattern;
    let flip_endpoint_yaw = props.flip_endpoint_yaw;
    let endpoint_faces_next = props.endpoint_faces_next;

    let cos_y = base_yaw.cos();
    let sin_y = base_yaw.sin();

    let transform_point = |lx: f64, ly: f64| -> (f64, f64) {
        let world_x = base_x + (lx * cos_y - ly * sin_y);
        let world_y = base_y + (lx * sin_y + ly * cos_y);
        (world_x, world_y)
    };

    let mut waypoints: Vec<Waypoint> = Vec::new();

    for i in 0..num_lines {
        let local_startup_y = i as f64 * pitch_y;
        let is_reverse_pass = snake_pattern && (i % 2 == 1);

        let p1_local_x = if !is_reverse_pass { 0.0 } else { pitch_x };
        let p2_local_x = if !is_reverse_pass { pitch_x } else { 0.0 };

        let (w1_x, w1_y) = transform_point(p1_local_x, local_startup_y);
        let (w2_x, w2_y) = transform_point(p2_local_x, local_startup_y);

        // Yaw assignment
        let (w1_yaw, w2_yaw) = if snake_pattern {
            let forward_yaw = base_yaw;
            let reverse_yaw = base_yaw + PI;

            if !is_reverse_pass {
                let w1 = forward_yaw;
                let w2 = if endpoint_faces_next {
                    base_yaw + PI / 2.0
                } else {
                    forward_yaw
                };
                (w1, w2)
            } else {
                let w1 = reverse_yaw;
                let w2 = if endpoint_faces_next {
                    base_yaw + PI / 2.0
                } else {
                    reverse_yaw
                };
                (w1, w2)
            }
        } else {
            let w1 = base_yaw;
            let w2 = if flip_endpoint_yaw {
                base_yaw + PI
            } else {
                base_yaw
            };
            (w1, w2)
        };

        waypoints.push(Waypoint {
            x: round3(w1_x),
            y: round3(w1_y),
            yaw: round3(normalize_yaw(w1_yaw)),
            options: WaypointOptions {
                generated_by: "SweepGeneratorRS".to_string(),
                sweep_line_id: i,
            },
        });

        waypoints.push(Waypoint {
            x: round3(w2_x),
            y: round3(w2_y),
            yaw: round3(normalize_yaw(w2_yaw)),
            options: WaypointOptions {
                generated_by: "SweepGeneratorRS".to_string(),
                sweep_line_id: i,
            },
        });
    }

    // Output JSON to stdout
    let json_output = serde_json::to_string(&waypoints).unwrap_or_else(|_| "[]".to_string());
    println!("{}", json_output);
}
