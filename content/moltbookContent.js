function bgMessage(payload) {
    return chrome.runtime.sendMessage(payload);
}

function nearestAttr(el, attr) {
    const node = el?.closest?.(`[${attr}]`);
    return node?.getAttribute?.(attr) || null;
}

function findPostIdFromLinks(el) {
    const root = el?.closest?.("article, [data-post], .post, .Post, main, body") || document;
    const links = root.querySelectorAll?.('a[href*="/posts/"]') || [];
    for (const a of links) {
        const m = a.getAttribute("href")?.match(/\/posts\/([^/?#]+)/);
        if (m?.[1]) return m[1];
    }
    return null;
}

function inferAction(el) {
    const t = (el?.getAttribute?.("aria-label") || el?.textContent || "").trim().toLowerCase();
    if (t.includes("upvote")) return "upvote";
    if (t.includes("downvote")) return "downvote";
    if (t.includes("comment") || t.includes("reply")) return "comment";
    return null;
}

function toast(text, kind = "info") {
    const node = document.createElement("div");
    node.className = `mbcu-toast mbcu-${kind}`;
    node.textContent = text;
    document.documentElement.appendChild(node);
    setTimeout(() => node.classList.add("mbcu-show"), 10);
    setTimeout(() => {
        node.classList.remove("mbcu-show");
        setTimeout(() => node.remove(), 250);
    }, 1800);
}

async function handleClick(e) {
    const target = e.target;
    const btn = target?.closest?.("button, a, [role='button']");
    if (!btn) return;

    // If site uses explicit hooks, prefer them.
    const explicitAction =
        btn.getAttribute("data-moltbook-action") ||
        btn.getAttribute("data-action") ||
        nearestAttr(btn, "data-moltbook-action") ||
        nearestAttr(btn, "data-action");

    const action = (explicitAction || inferAction(btn))?.toLowerCase();
    if (!action) return;

    // Try to extract IDs from explicit attributes first
    const postId =
        nearestAttr(btn, "data-post-id") ||
        btn.getAttribute("data-post-id") ||
        findPostIdFromLinks(btn);

    const commentId =
        nearestAttr(btn, "data-comment-id") ||
        btn.getAttribute("data-comment-id");

    // Only intercept actions we know how to do.
    if (action === "upvote" || action === "downvote") {
        if (!postId) {
            // Don’t block the page if we can’t resolve the ID.
            console.warn("[moltbook-chrome-user] Could not resolve postId for vote", { btn });
            toast("Can't vote: missing post id", "error");
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        try {
            btn.classList.add("mbcu-pending");
            const type =
                action === "upvote" ? "moltbook/post/upvote" : "moltbook/post/downvote";
            const res = await bgMessage({ type, postId });
            if (!res?.ok) throw new Error(res?.error || "Request failed");
            toast(action === "upvote" ? "Upvoted" : "Downvoted", "ok");
        } catch (err) {
            toast(err.message || "Vote failed", "error");
        } finally {
            btn.classList.remove("mbcu-pending");
        }
        return;
    }

    if (action === "comment") {
        // Minimal implementation: prompt-based comment for now.
        // Once we know the site’s comment box DOM, we can wire inline forms.
        if (!postId) {
            console.warn("[moltbook-chrome-user] Could not resolve postId for comment", { btn });
            toast("Can't comment: missing post id", "error");
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        const content = prompt("Comment on this post:");
        if (!content) return;

        try {
            btn.classList.add("mbcu-pending");
            const res = await bgMessage({ type: "moltbook/post/comment", postId, content });
            if (!res?.ok) throw new Error(res?.error || "Request failed");
            toast("Comment posted", "ok");
        } catch (err) {
            toast(err.message || "Comment failed", "error");
        } finally {
            btn.classList.remove("mbcu-pending");
        }
    }

    // Support for comment upvote (if the UI includes it)
    if (action === "comment-upvote") {
        if (!commentId) {
            toast("Can't upvote comment: missing comment id", "error");
            return;
        }
        e.preventDefault();
        e.stopPropagation();

        try {
            btn.classList.add("mbcu-pending");
            const res = await bgMessage({ type: "moltbook/comment/upvote", commentId });
            if (!res?.ok) throw new Error(res?.error || "Request failed");
            toast("Comment upvoted", "ok");
        } catch (err) {
            toast(err.message || "Upvote failed", "error");
        } finally {
            btn.classList.remove("mbcu-pending");
        }
    }
}

// Capture phase so we can intercept before navigation/handlers (even if the page adds some later)
document.addEventListener("click", handleClick, true);

console.log("[moltbook-chrome-user] content script active");
