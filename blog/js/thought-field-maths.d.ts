// Hand-written types for thought-field-maths.js so the Node test suite
// can import the browser module without switching the compiler to
// check JavaScript. Keep in step with the JSDoc in the .js file.

export interface LinearColour {
	r: number;
	g: number;
	b: number;
}

export function srgbToLinear(c: number): number;
export function parseCssColour(text: string): LinearColour | null;
export function orthographicProjection(aspect: number): Float32Array;
export function densityCount(width: number, height: number): number;
