import { createRenderer } from "./thought-field-gl.js";
import { createLoop } from "./thought-field-loop.js";
import { makeMeteors } from "./thought-field-meteors.js";
import { buildPalette, makePoints } from "./thought-field-particles.js";

/**
 * Particle budget and device-pixel cap chosen by the host page before
 * this module is downloaded.
 * @typedef {{ count: number, pixelRatio: number }} Tier
 */

/** @typedef {import("./thought-field-particles.js").Pointer} Pointer */

/**
 * @param {Element | null} hero
 * @returns {{ pointer: Pointer, destroy: () => void }}
 */
function pointerState(hero) {
	/** @type {Pointer} */
	const pointer = { x: 9999, y: 9999, strength: 0, lastMove: -Infinity };
	/** @param {PointerEvent} event */
	const onMove = (event) => {
		if (hero === null) {
			return;
		}
		const rect = hero.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) {
			return;
		}
		const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
		pointer.x = nx * (rect.width / rect.height);
		pointer.y = -ny;
		pointer.lastMove = performance.now();
	};
	window.addEventListener("pointermove", onMove, { passive: true });
	return {
		pointer,
		destroy: () => window.removeEventListener("pointermove", onMove),
	};
}

/**
 * @param {{
 *   hero: Element | null,
 *   renderer: ReturnType<typeof createRenderer>,
 *   tier: Tier,
 * }} options
 * @returns {{ dims: { aspect: number }, destroy: () => void }}
 */
function resizeState(options) {
	const { hero, renderer, tier } = options;
	const dims = { aspect: 1 };
	const resize = () => {
		if (hero === null) {
			return;
		}
		const rect = hero.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) {
			return;
		}
		const ratio = Math.min(window.devicePixelRatio || 1, tier.pixelRatio);
		renderer.resize({ width: rect.width, height: rect.height, ratio });
		dims.aspect = rect.width / rect.height;
	};
	resize();
	const observer = new ResizeObserver(resize);
	if (hero !== null) {
		observer.observe(hero);
	}
	return { dims, destroy: () => observer.disconnect() };
}

/**
 * Boots the particle field on CANVAS. The hero forces a dark colour
 * scheme regardless of the page theme, so the palette is read from the
 * hero element and drawn additively.
 * @param {HTMLCanvasElement} canvas
 * @param {Tier} tier
 * @returns {{ destroy: () => void }}
 */
export function initThoughtField(canvas, tier) {
	const hero =
		canvas.closest("[data-hero]") ??
		canvas.parentElement ??
		document.documentElement;
	const { palette, accent } = buildPalette(hero);
	const field = makePoints(Math.max(1, Math.floor(tier.count)), palette);
	const meteors = makeMeteors(accent);
	const renderer = createRenderer(canvas, field, meteors);
	const pointer = pointerState(hero);
	const resize = resizeState({ hero, renderer, tier });
	const loop = createLoop({
		renderer,
		field,
		pointer: pointer.pointer,
		hero,
		meteors,
		dims: resize.dims,
	});
	loop.start();
	return {
		destroy: () => {
			loop.destroy();
			resize.destroy();
			pointer.destroy();
			renderer.destroy();
		},
	};
}
