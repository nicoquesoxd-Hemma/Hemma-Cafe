import { isEmojiSupported } from "../utils/emojiSupport";

/**
 * Renders an emoji only if the current OS/browser can display it correctly.
 * If the emoji is not supported, renders `fallback` (default: nothing).
 *
 * Usage:
 *   <SafeEmoji emoji="💵" />                      → shows emoji or nothing
 *   <SafeEmoji emoji="🏦" fallback="🏧" />        → falls back to another emoji
 *   <SafeEmoji emoji="⚡" fallback="•" />          → falls back to text
 */
export default function SafeEmoji({ emoji, fallback = null, style }) {
    if (!isEmojiSupported(emoji)) {
        // If fallback is itself an emoji, check if THAT is supported too
        if (fallback && typeof fallback === "string" && fallback !== emoji) {
            return isEmojiSupported(fallback) ? (
                <span role="img" aria-hidden="true" style={style}>{fallback}</span>
            ) : null;
        }
        return fallback ? <span style={style}>{fallback}</span> : null;
    }
    return <span role="img" aria-hidden="true" style={style}>{emoji}</span>;
}
