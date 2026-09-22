// GLSL ES 1.00, which WebGL2 still accepts. The vertex stage projects
// straight from world space: uProjection already folds in the camera
// translation, so there is no separate model-view matrix.

export const FIELD_VERTEX_SHADER = `
precision highp float;
attribute vec3 position;
attribute vec3 aColor;
attribute float aScale;
uniform mat4 uProjection;
uniform float uSize;
uniform float uPixelRatio;
varying vec3 vColor;
void main() {
	vColor = aColor;
	gl_PointSize = uSize * aScale * uPixelRatio;
	gl_Position = uProjection * vec4(position, 1.0);
}
`;

export const FIELD_FRAGMENT_SHADER = `
precision highp float;
varying vec3 vColor;
uniform float uGlow;
uniform float uAlpha;
void main() {
	float d = length(gl_PointCoord - vec2(0.5));
	if (d > 0.5) {
		discard;
	}
	float core = smoothstep(0.5, 0.0, d);
	vec3 col = vColor * (0.55 + 0.85 * smoothstep(0.5, 0.18, d)) * uGlow;
	gl_FragColor = vec4(col, core * core * uAlpha);
}
`;

export const METEOR_VERTEX_SHADER = `
precision highp float;
attribute vec3 position;
attribute vec3 aColor;
attribute float aScale;
attribute float aAlpha;
uniform mat4 uProjection;
uniform float uSize;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vAlpha;
void main() {
	vColor = aColor;
	vAlpha = aAlpha;
	gl_PointSize = uSize * aScale * uPixelRatio;
	gl_Position = uProjection * vec4(position, 1.0);
}
`;

export const METEOR_FRAGMENT_SHADER = `
precision highp float;
varying vec3 vColor;
varying float vAlpha;
uniform float uGlow;
uniform float uAlpha;
void main() {
	float d = length(gl_PointCoord - vec2(0.5));
	if (d > 0.5) {
		discard;
	}
	float core = smoothstep(0.5, 0.0, d);
	vec3 col = vColor * (0.55 + 0.85 * smoothstep(0.5, 0.18, d)) * uGlow;
	gl_FragColor = vec4(col, core * core * uAlpha * vAlpha);
}
`;
