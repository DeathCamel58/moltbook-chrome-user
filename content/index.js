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

async function handleVote(action, postId, btn) {
    if (!postId) {
        console.warn("[moltbook-chrome-user] Could not resolve postId for vote", { btn });
        toast("Can't vote: missing post id", "error");
        return true;
    }

    try {
        btn.classList.add("mbcu-pending");
        const type = action === "upvote" ? "moltbook/post/upvote" : "moltbook/post/downvote";
        const res = await bgMessage({ type, postId });
        if (!res?.ok) throw new Error(res?.error || "Request failed");
        toast(action === "upvote" ? "Upvoted" : "Downvoted", "ok");
    } catch (err) {
        toast(err.message || "Vote failed", "error");
    } finally {
        btn.classList.remove("mbcu-pending");
    }

    return true;
}

async function handleComment(action, { postId, commentId }, btn) {
    if (action === "comment") {
        if (!postId) {
            console.warn("[moltbook-chrome-user] Could not resolve postId for comment", { btn });
            toast("Can't comment: missing post id", "error");
            return true;
        }

        const content = prompt("Comment on this post:");
        if (!content) return true;

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

        return true;
    }

    if (action === "comment-upvote") {
        if (!commentId) {
            toast("Can't upvote comment: missing comment id", "error");
            return true;
        }

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

        return true;
    }

    return false;
}

async function renderHeaderStatus() {
    const slot = document.querySelector("body > header > div > nav > div");
    if (!slot) return;

    try {
        const agentsRes = await bgMessage({ type: "agents/list" });
        if (!agentsRes?.ok) throw new Error(agentsRes?.error || "Failed to load agents");

        const { agents, activeAgentId } = agentsRes.data || {};
        const active = (agents || []).find((a) => a.id === activeAgentId);

        if (!active) {
            slot.textContent = "No active Moltbook identity";
            return;
        }

        const [statusRes, dmRes] = await Promise.all([
            bgMessage({ type: "agents/checkStatus", apiKey: active.apiKey }),
            bgMessage({ type: "dm/check" })
        ]);

        const claimStatus = statusRes?.ok ? statusRes.data?.status || "unknown" : "unknown";
        const pending = dmRes?.ok ? dmRes.data?.pending_requests ?? dmRes.data?.pending ?? 0 : 0;
        const unread = dmRes?.ok ? dmRes.data?.unread_messages ?? dmRes.data?.unread ?? 0 : 0;

        const root = document.createElement("div");
        root.style.display = "grid";
        root.style.gap = "4px";
        root.style.fontSize = "12px";

        const line1 = document.createElement("div");
        line1.textContent = `User: ${active.name}`;

        const line2 = document.createElement("div");
        line2.textContent = `Status: ${claimStatus}`;

        const line3 = document.createElement("div");
        line3.textContent = `DMs: ${pending} pending, ${unread} unread`;

        root.append(line1, line2, line3);
        slot.replaceChildren(root);
    } catch (e) {
        slot.textContent = "Moltbook status unavailable";
    }
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

    if (action === "upvote" || action === "downvote") {
        e.preventDefault();
        e.stopPropagation();
        await handleVote(action, postId, btn);
        return;
    }

    if (action === "comment" || action === "comment-upvote") {
        e.preventDefault();
        e.stopPropagation();
        await handleComment(action, { postId, commentId }, btn);
    }
}

// Capture phase so we can intercept before navigation/handlers (even if the page adds some later)
document.addEventListener("click", handleClick, true);

console.log("[moltbook-chrome-user] content script active");

renderHeaderStatus().then(r => console.log("[moltbook-chrome-user] header rendered"));
