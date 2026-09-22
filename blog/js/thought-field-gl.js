// Raw WebGL2 plumbing for the hero field: one program and one vertex
// array per point cloud, additive blending, no depth. Everything the
// simulation writes into its Float32Arrays is re-uploaded each frame.
import { orthographicProjection } from "./thought-field-maths.js";
import {
	FIELD_FRAGMENT_SHADER,
	FIELD_VERTEX_SHADER,
	METEOR_FRAGMENT_SHADER,
	METEOR_VERTEX_SHADER,
} from "./thought-field-shaders.js";

/**
 * @typedef {{ name: string, data: Float32Array, size: number, dynamic: boolean }} AttributeSpec
 * @typedef {{ buffer: WebGLBuffer, data: Float32Array }} DynamicBuffer
 * @typedef {{
 *   program: WebGLProgram,
 *   vao: WebGLVertexArrayObject,
 *   buffers: WebGLBuffer[],
 *   dynamic: DynamicBuffer[],
 *   count: number,
 *   uPixelRatio: WebGLUniformLocation | null,
 *   uProjection: WebGLUniformLocation | null,
 * }} Pass
 * @typedef {{ vertex: string, fragment: string, size: number, glow: number, alpha: number }} PassStyle
 */

/** @type {WebGLContextAttributes} */
const CONTEXT_OPTIONS = {
	alpha: true,
	antialias: false,
	depth: false,
	stencil: false,
	powerPreference: "low-power",
	premultipliedAlpha: true,
};

/** @type {PassStyle} */
const FIELD_STYLE = {
	vertex: FIELD_VERTEX_SHADER,
	fragment: FIELD_FRAGMENT_SHADER,
	size: 3.2,
	glow: 1.1,
	alpha: 0.75,
};

/** @type {PassStyle} */
const METEOR_STYLE = {
	vertex: METEOR_VERTEX_SHADER,
	fragment: METEOR_FRAGMENT_SHADER,
	size: 3.4,
	glow: 1.3,
	alpha: 0.9,
};

/**
 * @param {WebGL2RenderingContext} gl
 * @param {number} type
 * @param {string} source
 * @returns {WebGLShader}
 */
function compileShader(gl, type, source) {
	const shader = gl.createShader(type);
	if (shader === null) {
		throw new Error("WebGL shader allocation failed");
	}
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(shader) ?? "";
		gl.deleteShader(shader);
		throw new Error(`WebGL shader compile failed: ${log}`);
	}
	return shader;
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {string} vertexSource
 * @param {string} fragmentSource
 * @returns {WebGLProgram}
 */
function linkProgram(gl, vertexSource, fragmentSource) {
	const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
	const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
	const program = gl.createProgram();
	gl.attachShader(program, vertex);
	gl.attachShader(program, fragment);
	gl.linkProgram(program);
	gl.deleteShader(vertex);
	gl.deleteShader(fragment);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const log = gl.getProgramInfoLog(program) ?? "";
		gl.deleteProgram(program);
		throw new Error(`WebGL program link failed: ${log}`);
	}
	return program;
}

/**
 * Uploads one attribute into its own buffer and wires it into the bound
 * vertex array. Callers keep the buffer handle for cleanup.
 * @param {WebGL2RenderingContext} gl
 * @param {WebGLProgram} program
 * @param {AttributeSpec} spec
 * @returns {WebGLBuffer}
 */
function uploadAttribute(gl, program, spec) {
	const buffer = gl.createBuffer();
	const location = gl.getAttribLocation(program, spec.name);
	if (location < 0) {
		throw new Error(`WebGL attribute missing: ${spec.name}`);
	}
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	const usage = spec.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW;
	gl.bufferData(gl.ARRAY_BUFFER, spec.data, usage);
	gl.enableVertexAttribArray(location);
	gl.vertexAttribPointer(location, spec.size, gl.FLOAT, false, 0, 0);
	return buffer;
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {PassStyle} style
 * @param {AttributeSpec[]} attributes
 * @returns {Pass}
 */
function createPass(gl, style, attributes) {
	const program = linkProgram(gl, style.vertex, style.fragment);
	const vao = gl.createVertexArray();
	gl.bindVertexArray(vao);
	const buffers = attributes.map((spec) => uploadAttribute(gl, program, spec));
	gl.bindVertexArray(null);
	gl.useProgram(program);
	gl.uniform1f(gl.getUniformLocation(program, "uSize"), style.size);
	gl.uniform1f(gl.getUniformLocation(program, "uGlow"), style.glow);
	gl.uniform1f(gl.getUniformLocation(program, "uAlpha"), style.alpha);
	const dynamic = attributes.flatMap((spec, index) => {
		const buffer = buffers[index];
		return spec.dynamic && buffer !== undefined
			? [{ buffer, data: spec.data }]
			: [];
	});
	const first = attributes[0];
	return {
		program,
		vao,
		buffers,
		dynamic,
		count: first === undefined ? 0 : first.data.length / first.size,
		uPixelRatio: gl.getUniformLocation(program, "uPixelRatio"),
		uProjection: gl.getUniformLocation(program, "uProjection"),
	};
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {Pass} pass
 */
function drawPass(gl, pass) {
	gl.useProgram(pass.program);
	gl.bindVertexArray(pass.vao);
	for (const { buffer, data } of pass.dynamic) {
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
	}
	gl.drawArrays(gl.POINTS, 0, pass.count);
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {Pass} pass
 */
function deletePass(gl, pass) {
	for (const buffer of pass.buffers) {
		gl.deleteBuffer(buffer);
	}
	gl.deleteVertexArray(pass.vao);
	gl.deleteProgram(pass.program);
}

/**
 * @param {WebGL2RenderingContext} gl
 */
function applyFixedState(gl) {
	gl.clearColor(0, 0, 0, 0);
	gl.disable(gl.DEPTH_TEST);
	gl.depthMask(false);
	gl.enable(gl.BLEND);
	gl.blendEquation(gl.FUNC_ADD);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {import("./thought-field-particles.js").Field} field
 * @param {import("./thought-field-meteors.js").Meteors} meteors
 */
export function createRenderer(canvas, field, meteors) {
	const gl = canvas.getContext("webgl2", CONTEXT_OPTIONS);
	if (gl === null) {
		throw new Error("WebGL2 context unavailable");
	}
	applyFixedState(gl);
	const surface = canvas;
	const passes = [
		createPass(gl, FIELD_STYLE, [
			{ name: "position", data: field.pos, size: 3, dynamic: true },
			{ name: "aColor", data: field.col, size: 3, dynamic: false },
			{ name: "aScale", data: field.scale, size: 1, dynamic: false },
		]),
		createPass(gl, METEOR_STYLE, [
			{ name: "position", data: meteors.pos, size: 3, dynamic: true },
			{ name: "aColor", data: meteors.col, size: 3, dynamic: false },
			{ name: "aScale", data: meteors.scale, size: 1, dynamic: true },
			{ name: "aAlpha", data: meteors.alpha, size: 1, dynamic: true },
		]),
	];
	return {
		/**
		 * @param {{ width: number, height: number, ratio: number }} size CSS
		 * pixels plus the device pixel ratio to render at
		 */
		resize: ({ width, height, ratio }) => {
			surface.width = Math.floor(width * ratio);
			surface.height = Math.floor(height * ratio);
			gl.viewport(0, 0, surface.width, surface.height);
			const projection = orthographicProjection(width / height);
			for (const pass of passes) {
				gl.useProgram(pass.program);
				gl.uniform1f(pass.uPixelRatio, ratio);
				gl.uniformMatrix4fv(pass.uProjection, false, projection);
			}
		},
		render: () => {
			gl.clear(gl.COLOR_BUFFER_BIT);
			for (const pass of passes) {
				drawPass(gl, pass);
			}
		},
		destroy: () => {
			for (const pass of passes) {
				deletePass(gl, pass);
			}
			gl.getExtension("WEBGL_lose_context")?.loseContext();
		},
	};
}
