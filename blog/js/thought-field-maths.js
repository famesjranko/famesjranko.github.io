// Pure helpers shared by the hero field: colour parsing and the camera
// projection. No DOM or WebGL here so Node can test them directly.

/** @typedef {{ r: number, g: number, b: number }} LinearColour */

// Camera constants: OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 10)
// sitting at z = 2 and looking down -z at points on the z = 0 plane.
const CAMERA_Z = 2;
const NEAR = 0.1;
const FAR = 10;

/**
 * sRGB transfer function, encoded channel in 0..1 to linear light.
 * @param {number} c
 * @returns {number}
 */
export function srgbToLinear(c) {
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {LinearColour}
 */
function fromBytes(r, g, b) {
	return {
		r: srgbToLinear(r / 255),
		g: srgbToLinear(g / 255),
		b: srgbToLinear(b / 255),
	};
}

/**
 * @param {string} hex six hex digits
 * @returns {LinearColour}
 */
function fromHex(hex) {
	const value = Number.parseInt(hex, 16);
	return fromBytes((value >> 16) & 255, (value >> 8) & 255, value & 255);
}

const HEX = /^#([0-9a-f]{6})$/i;
const RGB =
	/^rgba?\(\s*(\d*\.?\d+)\s*[,\s]\s*(\d*\.?\d+)\s*[,\s]\s*(\d*\.?\d+)\s*(?:[,/]\s*\d*\.?\d+\s*)?\)$/i;

/**
 * Parse a computed CSS colour (`rgb(r, g, b)`, `rgba(r, g, b, a)`, the
 * space-separated forms, or `#rrggbb`) into linear-light channels, the
 * values a three.js Color would have carried into the shaders. Alpha is
 * ignored. Returns null for anything else so the caller can fall back.
 * @param {string} text
 * @returns {LinearColour | null}
 */
export function parseCssColour(text) {
	const trimmed = text.trim();
	const hex = HEX.exec(trimmed);
	if (hex !== null && hex[1] !== undefined) {
		return fromHex(hex[1]);
	}
	const rgb = RGB.exec(trimmed);
	if (rgb === null) {
		return null;
	}
	const [, r = "0", g = "0", b = "0"] = rgb;
	return fromBytes(Number(r), Number(g), Number(b));
}

// The full field: 1600 particles filling a typical desktop hero. Smaller
// heroes get the same particles per pixel, never fewer than the floor.
const FULL_COUNT = 1600;
const FLOOR_COUNT = 320;
const REFERENCE_AREA = 1440 * 800;

/**
 * Particle count that keeps a hero of the given CSS size at the desktop
 * density, clamped between the floor and the full field.
 * @param {number} width
 * @param {number} height
 * @returns {number}
 */
export function densityCount(width, height) {
	const scaled = Math.round((FULL_COUNT * width * height) / REFERENCE_AREA);
	return Math.min(FULL_COUNT, Math.max(FLOOR_COUNT, scaled));
}

/**
 * Column-major 4x4 matrix taking world space straight to clip space for
 * the hero camera: projection multiplied by the camera's inverse
 * transform (a translation of -CAMERA_Z along z).
 * @param {number} aspect width / height
 * @returns {Float32Array}
 */
export function orthographicProjection(aspect) {
	const depthScale = -2 / (FAR - NEAR);
	const depthOffset = -(FAR + NEAR) / (FAR - NEAR);
	const matrix = new Float32Array(16);
	matrix[0] = 1 / aspect;
	matrix[5] = 1;
	matrix[10] = depthScale;
	matrix[14] = depthScale * -CAMERA_Z + depthOffset;
	matrix[15] = 1;
	return matrix;
}
