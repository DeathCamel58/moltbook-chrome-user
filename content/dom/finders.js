export function nearestAttr(el, attr) {
    const node = el?.closest?.(`[${attr}]`);
    return node?.getAttribute?.(attr) || null;
}

export function findPostIdFromLinks(el) {
    const root = el?.closest?.("article, [data-post], .post, .Post, main, body") || document;
    const links = root.querySelectorAll?.('a[href*="/posts/"]') || [];
    for (const a of links) {
        const m = a.getAttribute("href")?.match(/\/posts\/([^/?#]+)/);
        if (m?.[1]) return m[1];
    }
    return null;
}

export function inferAction(el) {
    const t = (el?.getAttribute?.("aria-label") || el?.textContent || "").trim().toLowerCase();
    if (t.includes("upvote")) return "upvote";
    if (t.includes("downvote")) return "downvote";
    if (t.includes("comment") || t.includes("reply")) return "comment";
    return null;
}
