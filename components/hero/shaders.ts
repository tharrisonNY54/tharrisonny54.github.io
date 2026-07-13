// Point-cloud self-assembly shaders. ShaderMaterial injects `position`,
// `modelViewMatrix`, and `projectionMatrix`, so they are not redeclared here.
//
// Choreography: a scan sweeps bottom -> top (uProgress 0..1). Each point stays
// displaced along its radial until the scan passes its height, then eases into
// place with a small overshoot while its alpha fades in. No additive blending,
// no glow — flat round sprites, normal blending.

export const vertexShader = /* glsl */ `
  attribute float aSeed;
  attribute float aCyan;

  uniform float uProgress;   // scan position 0..1
  uniform float uTime;       // seconds
  uniform float uPointSize;  // base point size (px at unit depth)
  uniform float uPixelRatio;
  uniform float uReduced;    // 1.0 = reduced motion (no idle jitter)

  varying float vCyan;
  varying float vAlpha;

  // Ease-out with mild tension (~5% overshoot past the target).
  float easeOutBack(float x) {
    float c1 = 0.8;
    float c3 = c1 + 1.0;
    float xm = x - 1.0;
    return 1.0 + c3 * xm * xm * xm + c1 * xm * xm;
  }

  void main() {
    vCyan = aCyan;

    // Int16-normalized attribute arrives in [-1, 1]; real target is [-0.5, 0.5].
    vec3 target = position * 0.5;

    float ny = target.y + 0.5;                      // 0 at feet, 1 at head
    float threshold = ny + (aSeed - 0.5) * 0.06;    // soften the scan edge
    float window = 0.14;
    float reveal = clamp((uProgress - threshold) / window, 0.0, 1.0);

    vec3 dir = normalize(target + vec3(0.0001));
    vec3 start = target + dir * 0.15;
    vec3 pos = mix(start, target, easeOutBack(reveal));

    // Settled points hold a faint sensor jitter (<= 0.3% of unit height).
    float settled = reveal * (1.0 - uReduced);
    pos.x += sin(uTime * 3.14 + aSeed * 6.2831) * 0.003 * settled;
    pos.y += sin(uTime * 2.83 + aSeed * 12.566) * 0.003 * settled;
    pos.z += cos(uTime * 3.45 + aSeed * 9.4247) * 0.003 * settled;

    vAlpha = reveal;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uPointSize * uPixelRatio / max(-mv.z, 0.1);
  }
`;

export const fragmentShader = /* glsl */ `
  precision mediump float;

  uniform vec3 uColorBase;
  uniform vec3 uColorAccent;

  varying float vCyan;
  varying float vAlpha;

  void main() {
    // Flat round sprite — discard outside the disc.
    vec2 c = gl_PointCoord - 0.5;
    if (dot(c, c) > 0.25) discard;

    vec3 color = mix(uColorBase, uColorAccent, step(0.5, vCyan));
    gl_FragColor = vec4(color, vAlpha);
  }
`;
