export const shaders = {
  pixel: {
    vertex: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragment: `
      uniform sampler2D tDiffuse;
      uniform vec2 resolution;
      uniform float pixelSize;
      uniform float colorNum;
      uniform float ditherScale;
      varying vec2 vUv;

      const float bayerMatrix8x8[64] = float[64](
        0.0/ 64.0, 48.0/ 64.0, 12.0/ 64.0, 60.0/ 64.0,  3.0/ 64.0, 51.0/ 64.0, 15.0/ 64.0, 63.0/ 64.0,
        32.0/ 64.0, 16.0/ 64.0, 44.0/ 64.0, 28.0/ 64.0, 35.0/ 64.0, 19.0/ 64.0, 47.0/ 64.0, 31.0/ 64.0,
        8.0/ 64.0, 56.0/ 64.0,  4.0/ 64.0, 52.0/ 64.0, 11.0/ 64.0, 59.0/ 64.0,  7.0/ 64.0, 55.0/ 64.0,
        40.0/ 64.0, 24.0/ 64.0, 36.0/ 64.0, 20.0/ 64.0, 43.0/ 64.0, 27.0/ 64.0, 39.0/ 64.0, 23.0/ 64.0,
        2.0/ 64.0, 50.0/ 64.0, 14.0/ 64.0, 62.0/ 64.0,  1.0/ 64.0, 49.0/ 64.0, 13.0/ 64.0, 61.0/ 64.0,
        34.0/ 64.0, 18.0/ 64.0, 46.0/ 64.0, 30.0/ 64.0, 33.0/ 64.0, 17.0/ 64.0, 45.0/ 64.0, 29.0/ 64.0,
        10.0/ 64.0, 58.0/ 64.0,  6.0/ 64.0, 54.0/ 64.0,  9.0/ 64.0, 57.0/ 64.0,  5.0/ 64.0, 53.0/ 64.0,
        42.0/ 64.0, 26.0/ 64.0, 38.0/ 64.0, 22.0/ 64.0, 41.0/ 64.0, 25.0/ 64.0, 37.0/ 64.0, 21.0 / 64.0
      );

      vec3 dither(vec2 uv, vec3 color) {
        vec2 scaledUv = uv * resolution / (ditherScale * 8.0);
        int x = int(scaledUv.x) % 8;
        int y = int(scaledUv.y) % 8;
        float threshold = bayerMatrix8x8[y * 8 + x] - 0.88;

        color.rgb += threshold / (colorNum - 1.0);
        color.r = floor(color.r * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
        color.g = floor(color.g * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
        color.b = floor(color.b * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);

        return color;
      }

      void main() {
        vec2 dxy = pixelSize / resolution;
        vec2 coord = dxy * floor(vUv / dxy);
        vec4 color = texture2D(tDiffuse, coord);
        color.rgb = dither(vUv, color.rgb);
        gl_FragColor = color;
      }
    `,
  },
  gradient: {
    vertex: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragment: `
      uniform vec3 color;
      uniform float innerOpacity;
      uniform float outerOpacity;
      varying vec2 vUv;
      void main() {
        float distance = length(vUv - vec2(0.5, 0.5)) * 2.0;
        float opacity = mix(innerOpacity, outerOpacity, distance);
        gl_FragColor = vec4(color, opacity);
      }
    `,
  },
};
