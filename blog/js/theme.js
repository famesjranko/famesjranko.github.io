// Light/dark toggle. The stored choice is applied before paint by the
// inline script in <head>; this file only handles clicks and keeps the
// stored value in sync. With no stored choice the page follows the OS.
const root = document.documentElement;
const buttons = document.querySelectorAll("[data-theme-toggle]");

/** @returns {"light" | "dark"} */
function currentTheme() {
	const stored = root.dataset.theme;
	if (stored === "light" || stored === "dark") {
		return stored;
	}
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

/** The toggle reads as "dark theme on" to assistive technology. */
function reflectPressed() {
	const dark = currentTheme() === "dark";
	for (const button of buttons) {
		button.setAttribute("aria-pressed", String(dark));
	}
}

/** @param {"light" | "dark"} theme */
function applyTheme(theme) {
	root.dataset.theme = theme;
	try {
		localStorage.setItem("theme", theme);
	} catch {
		// Storage unavailable: the choice lasts for this page only.
	}
	reflectPressed();
}

for (const button of buttons) {
	button.addEventListener("click", () => {
		applyTheme(currentTheme() === "dark" ? "light" : "dark");
	});
}
reflectPressed();
