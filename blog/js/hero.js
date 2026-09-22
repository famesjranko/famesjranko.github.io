import { densityCount } from "./thought-field-maths.js";

/** @typedef {import("./thought-field.js").Tier} Tier */

const hero = document.querySelector("[data-hero]");
if (hero instanceof HTMLElement && "matchMedia" in window) {
	const reducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	).matches;
	const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
	setupParallax(hero, reducedMotion || coarsePointer);
	if (!reducedMotion) {
		scheduleField(hero);
	}
}

/**
 * @param {HTMLElement} hero
 * @param {boolean} disabled
 */
function setupParallax(hero, disabled) {
	if (disabled) {
		return;
	}
	let scheduled = false;
	hero.addEventListener(
		"pointermove",
		(event) => {
			if (scheduled) {
				return;
			}
			scheduled = true;
			window.requestAnimationFrame(() => {
				scheduled = false;
				const rect = hero.getBoundingClientRect();
				if (rect.width === 0 || rect.height === 0) {
					return;
				}
				const x = (event.clientX - rect.left) / rect.width - 0.5;
				const y = (event.clientY - rect.top) / rect.height - 0.5;
				hero.style.setProperty("--px", x.toFixed(3));
				hero.style.setProperty("--py", y.toFixed(3));
			});
		},
		{ passive: true },
	);
}

/**
 * Non-standard device hints. Absent on Firefox and Safari, so every
 * field is optional and the caller falls back to a generous default.
 * @typedef {Navigator & {
 *   connection?: { saveData?: boolean },
 *   deviceMemory?: number,
 * }} HintedNavigator
 */

/**
 * Tier before downloading anything: data-saver mode keeps the CSS
 * washes, phones get the desktop density over their smaller hero at a
 * sharp pixel ratio, weak laptops a mid field, desktops the full one.
 * Returning null means "skip WebGL entirely".
 * @param {HTMLElement} hero
 * @returns {Tier | null}
 */
function pickTier(hero) {
	const hinted = /** @type {HintedNavigator} */ (navigator);
	if (hinted.connection?.saveData === true) {
		return null;
	}
	const smallScreen = window.matchMedia("(max-width: 42rem)").matches;
	const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
	if (smallScreen || coarsePointer) {
		const rect = hero.getBoundingClientRect();
		return { count: densityCount(rect.width, rect.height), pixelRatio: 2 };
	}
	const memory = hinted.deviceMemory ?? 8;
	const cores = navigator.hardwareConcurrency ?? 8;
	if (memory <= 4 || cores <= 4) {
		return { count: 750, pixelRatio: 1.5 };
	}
	return { count: 1600, pixelRatio: 2 };
}

function webglAvailable() {
	if (!("WebGL2RenderingContext" in window)) {
		return false;
	}
	const probe = document.createElement("canvas").getContext("webgl2");
	return probe !== null;
}

/** @param {HTMLElement} hero */
function scheduleField(hero) {
	const canvas = hero.querySelector("[data-thought-field]");
	if (!(canvas instanceof HTMLCanvasElement)) {
		return;
	}
	const tier = pickTier(hero);
	if (tier === null || !webglAvailable()) {
		return;
	}
	const start = () => {
		void startField(canvas, tier);
	};
	if (!("IntersectionObserver" in window) || heroAlreadyVisible(hero)) {
		idle(start);
		return;
	}
	const seen = new IntersectionObserver((entries) => {
		if (entries.some((entry) => entry.isIntersecting)) {
			seen.disconnect();
			idle(start);
		}
	});
	seen.observe(hero);
}

/** @param {HTMLElement} hero */
function heroAlreadyVisible(hero) {
	const rect = hero.getBoundingClientRect();
	return rect.top < window.innerHeight && rect.bottom > 0;
}

/** @param {() => void} callback */
function idle(callback) {
	if (typeof window.requestIdleCallback === "function") {
		window.requestIdleCallback(() => callback(), { timeout: 2500 });
	} else {
		window.setTimeout(callback, 1200);
	}
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {Tier} tier
 */
async function startField(canvas, tier) {
	try {
		const sibling = new URL("./thought-field.js", import.meta.url);
		/** @type {typeof import("./thought-field.js")} */
		const field = await import(sibling.href);
		field.initThoughtField(canvas, tier);
	} catch {
		// The CSS wash fallback stands alone; drop the empty canvas.
		canvas.remove();
	}
}
