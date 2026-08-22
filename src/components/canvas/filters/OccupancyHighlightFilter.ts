import { Filter, GlProgram, UniformGroup } from 'pixi.js';

const defaultVertex = `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition( void )
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;

    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;

    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord( void )
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void)
{
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`;

const defaultFragment = `
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uOccThresh;
uniform float uFreeThresh;
uniform float uNegate;
uniform float uHighlightAlpha;

void main(void) {
    vec4 color = texture(uTexture, vTextureCoord);
    
    // 1. Transparent or background area -> Unknown Space (Purple)
    if (color.a < 0.1) {
        finalColor = vec4(0.66 * uHighlightAlpha, 0.33 * uHighlightAlpha, 0.97 * uHighlightAlpha, 0.5 * uHighlightAlpha);
        return;
    }
    
    // Un-premultiply alpha for correct RGB analysis
    vec3 rgb = color.rgb / color.a;
    
    // Grayscale luminance (ITU-R BT.601)
    float gray = rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114;
    float pixel255 = gray * 255.0;
    
    // 2. Canonical ROS Unknown space (gray value 205 / 0xCD, typical range 198 ~ 212) when not negated
    // In ROS map_server Trinary mode, pixel 205 represents unexplored/unknown space (-1)
    // even if free_thresh is 0.25 (which would otherwise misclassify 205 as free).
    bool isRosCanonicalUnknown = (uNegate < 0.5 && pixel255 >= 198.0 && pixel255 <= 212.0);
    
    // Normalized occupancy probability (0.0 = completely free, 1.0 = completely occupied)
    float occ = (uNegate > 0.5) ? gray : (1.0 - gray);
    
    vec3 highlightRgb;
    if (isRosCanonicalUnknown) {
        // Unknown / Unexplored Space (Purple #a855f7)
        highlightRgb = vec3(0.66, 0.33, 0.97);
    } else if (occ >= uOccThresh) {
        // Obstacle / Occupied (Red #ef4444)
        highlightRgb = vec3(0.94, 0.27, 0.27);
    } else if (occ <= uFreeThresh) {
        // Free Space (Green #10b981)
        highlightRgb = vec3(0.06, 0.73, 0.51);
    } else {
        // Unknown / Between thresholds (Purple #a855f7)
        highlightRgb = vec3(0.66, 0.33, 0.97);
    }
    
    // Blend original texture RGB with highlight RGB based on highlightAlpha
    vec3 blendedRgb = mix(rgb, highlightRgb, uHighlightAlpha);
    
    // Premultiply alpha again for PixiJS blending
    finalColor = vec4(blendedRgb * color.a, color.a);
}
`;

export interface OccupancyHighlightFilterOptions {
  occupiedThresh?: number;
  freeThresh?: number;
  negate?: number;
  alpha?: number;
}

export class OccupancyHighlightFilter extends Filter {
  public destroyed: boolean = false;

  constructor(options?: OccupancyHighlightFilterOptions) {
    const occThresh = options?.occupiedThresh ?? 0.65;
    const freeThresh = options?.freeThresh ?? 0.196;
    const negate = options?.negate ?? 0;
    const alpha = options?.alpha ?? 0.6;

    let glProgram: GlProgram | undefined;
    try {
      glProgram = GlProgram.from({
        vertex: defaultVertex,
        fragment: defaultFragment,
        name: 'occupancy-highlight-filter',
      });
    } catch {
      // Fallback for non-WebGL / test environments
    }

    let highlightUniforms: any;
    try {
      highlightUniforms = new UniformGroup({
        uOccThresh: { value: occThresh, type: 'f32' },
        uFreeThresh: { value: freeThresh, type: 'f32' },
        uNegate: { value: negate, type: 'f32' },
        uHighlightAlpha: { value: alpha, type: 'f32' },
      });
    } catch {
      highlightUniforms = {
        uniforms: {
          uOccThresh: occThresh,
          uFreeThresh: freeThresh,
          uNegate: negate,
          uHighlightAlpha: alpha,
        },
      };
    }

    super({
      glProgram,
      resources: {
        highlightUniforms,
      },
    });
  }

  public updateUniforms(options: OccupancyHighlightFilterOptions): void {
    const uniforms = (this.resources as any)?.highlightUniforms?.uniforms;
    if (!uniforms) return;

    if (typeof options.occupiedThresh === 'number') {
      uniforms.uOccThresh = options.occupiedThresh;
    }
    if (typeof options.freeThresh === 'number') {
      uniforms.uFreeThresh = options.freeThresh;
    }
    if (typeof options.negate === 'number') {
      uniforms.uNegate = options.negate;
    }
    if (typeof options.alpha === 'number') {
      uniforms.uHighlightAlpha = options.alpha;
    }
  }

  public override destroy(destroyProgram: boolean = false): void {
    this.destroyed = true;
    super.destroy(destroyProgram);
  }
}
