/**
 * Detects whether a given emoji can actually be rendered by the current system.
 * Uses a canvas pixel-comparison technique:
 *  1. Draws a known "unsupported" PUA character to get a reference pixel hash.
 *  2. Draws the emoji and compares against the reference.
 *  3. If the result matches the reference (or the canvas is blank), the emoji is not supported.
 *
 * Results are cached per emoji so the canvas is only used once per character.
 */

const cache = new Map();
let _canvas = null;
let _ctx = null;
let _referenceHash = null;

function init() {
    if (_canvas) return;
    _canvas = document.createElement("canvas");
    _canvas.width = 24;
    _canvas.height = 24;
    _ctx = _canvas.getContext("2d");
    _ctx.font = "16px sans-serif";
    _referenceHash = pixelHash("\u{100000}"); // Private-use area char — never in any system font
}

function pixelHash(text) {
    _ctx.clearRect(0, 0, 24, 24);
    _ctx.fillText(text, 0, 16);
    const { data } = _ctx.getImageData(0, 0, 24, 24);
    let h = 0;
    for (let i = 0; i < data.length; i += 4) {
        // Only look at alpha channel; color varies by OS dark/light mode
        h = (h * 31 + data[i + 3]) & 0xffffffff;
    }
    return h;
}

/**
 * Returns true if the emoji is rendered correctly by the OS font stack.
 * Returns false if the system can't show it (would display as a tofu box or the same glyph
 * as an unknown character).
 */
export function isEmojiSupported(emoji) {
    if (typeof document === "undefined") return true; // SSR guard
    if (!emoji) return false;
    if (cache.has(emoji)) return cache.get(emoji);

    init();

    const hash = pixelHash(emoji);
    // Supported = canvas has pixels AND they differ from the reference unknown glyph
    const supported = hash !== 0 && hash !== _referenceHash;

    cache.set(emoji, supported);
    return supported;
}
