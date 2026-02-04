function bgMessage(payload) {
    return chrome.runtime.sendMessage(payload);
}

function nearestAttr(el, attr) {
    const node = el?.closest?.(`[${attr}]`);
    return node?.getAttribute?.(attr) || null;
}

function findPostIdFromLinks(el) {
    const root = el?.closest?.("article, [data-post], .post, .Post, main, body") || document;
    const links = root.querySelectorAll?.('a[href*="/post/"], a[href*="/posts/"]') || [];
    for (const a of links) {
        const m = a.getAttribute("href")?.match(/\/post(?:s)?\/([^/?#]+)/);
        if (m?.[1]) return m[1];
    }
    return null;
}

function findPostIdFromAnchor(el) {
    const a = el?.closest?.('a[href*="/post/"], a[href*="/posts/"]');
    if (!a) return null;
    const m = a.getAttribute("href")?.match(/\/post(?:s)?\/([^/?#]+)/);
    return m?.[1] || null;
}

function findPostIdFromLocation() {
    const m = window.location.pathname.match(/\/post(?:s)?\/([^/?#]+)/);
    return m?.[1] || null;
}

function isOnPostPage() {
    return /\/post(?:s)?\//.test(window.location.pathname);
}

function isOnSubmoltPage() {
    return /\/m\/[^/]+/.test(window.location.pathname);
}

function getSubmoltFromLocation() {
    const m = window.location.pathname.match(/\/m\/([^/]+)/);
    return m?.[1] || null;
}

function isOnHomePage() {
    return window.location.pathname === "/" || window.location.pathname === "";
}

function getSubmoltMainColumn() {
    return document.querySelector("body > div.flex-1 > div > main > div.space-y-3");
}

function getPostCommentsContainer() {
    return document.querySelector(
        "body > div.flex-1 > div > main > div.flex.gap-6 > div > div.mt-6 > div"
    );
}

function isOnPostPageWithComments() {
    return isOnPostPage() && Boolean(getPostCommentsContainer());
}

function postPageVoteClickType(el) {
    // Check if this is on the post
    const inPost = Boolean(
        el?.closest?.(
            "body > div.flex-1 > div > main > div.flex.gap-6 > div > div.bg-\\[\\#1a1a1b\\].border.border-\\[\\#343536\\].rounded-lg"
        )
    );
    if (inPost) {
        return "inPost";
    }

    // Check if this is in the comments section
    const inComments = Boolean(
        el?.closest?.(
            "body > div.flex-1 > div > main > div.flex.gap-6 > div > div.mt-6 > div"
        )
    );
    if (inComments) {
        return "inComments";
    }

    // Check if this is in More section
    const inMore = Boolean(
        el?.closest?.(
            "body > div.flex-1 > div > main > div.flex.gap-6 > aside > div > div > div:nth-child(1)"
        )
    )
    if (inMore) {
        return "inMore";
    }

    // Check if this is up next section
    const inUpNext = Boolean(
        el?.closest?.(
            "body > div.flex-1 > div > main > div.flex.gap-6 > aside > div > div > div:nth-child(2)"
        )
    )

    if (inUpNext) {
        return "inUpNext";
    }

    return "unknown";
}

function isInCommentsSection(el) {
    return Boolean(
        el?.closest?.(
            "body > div.flex-1 > div > main > div.flex.gap-6 > div > div.mt-6"
        )
    );
}

function resolveVoteContext(btn, action) {
    const isPostPage = isOnPostPage();
    const isSubmoltPage = isOnSubmoltPage();
    const isHomePage = isOnHomePage();

    const commentId =
        nearestAttr(btn, "data-comment-id") ||
        btn.getAttribute("data-comment-id") ||
        nearestAttr(btn, "data-comment");

    const isCommentAction = action === "comment-upvote" || action === "comment-downvote" || Boolean(commentId);

    let postId = null;
    if (isPostPage) {
        const voteClickType = postPageVoteClickType(btn);
        if (voteClickType === "inPost") {
            postId = findPostIdFromLocation();
        } else if (voteClickType === "inComments") {
            postId = findPostIdFromLocation();
        }
    } else if (isSubmoltPage || isHomePage) {
        postId =
            nearestAttr(btn, "data-post-id") ||
            btn.getAttribute("data-post-id") ||
            findPostIdFromAnchor(btn) ||
            findPostIdFromLinks(btn);
    }

    return { isCommentAction, postId, commentId };
}

function inferAction(el) {
    const t = (el?.getAttribute?.("aria-label") || el?.textContent || "").trim().toLowerCase();
    if (t.includes("upvote")) return "upvote";
    if (t.includes("downvote")) return "downvote";
    if (t.includes("comment") || t.includes("reply")) return "comment";
    return null;
}

function inferArrowAction(el) {
    const t = (el?.textContent || "").trim();
    if (t === "▲") return "upvote";
    if (t === "▼") return "downvote";
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
        console.log((action === "upvote" ? "Upvoted " : "Downvoted ") + postId);
        toast(action === "upvote" ? "Upvoted" : "Downvoted", "ok");
        if (isOnPostPageWithComments()) {
            await refreshComments("top");
        }
    } catch (err) {
        console.error(err.message || "Vote failed");
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

        const content = commentId ? prompt("Reply to this comment:") : prompt("Comment on this post:");
        if (!content) return true;

        try {
            btn.classList.add("mbcu-pending");
            const res = await bgMessage({
                type: "moltbook/post/comment",
                postId,
                content,
                ...(commentId ? { parentId: commentId } : {})
            });
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
            if (isOnPostPageWithComments()) {
                await refreshComments("top");
            }
        } catch (err) {
            toast(err.message || "Upvote failed", "error");
        } finally {
            btn.classList.remove("mbcu-pending");
        }

        return true;
    }

    return false;
}

function normalizeCommentList(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.comments)) return data.comments;
    if (Array.isArray(data?.data)) return data.data;
    return [];
}

function getCommentReplies(comment) {
    if (!comment) return [];
    const direct =
        comment?.replies ||
        comment?.children ||
        comment?.comments ||
        comment?.items ||
        comment?.data ||
        [];
    return normalizeCommentList(direct);
}

function getCommentId(comment) {
    return comment?.id || comment?.comment_id || comment?.commentId || null;
}

function getCommentAuthor(comment) {
    return (
        comment?.author?.username ||
        comment?.author?.name ||
        comment?.user?.username ||
        comment?.user?.name ||
        comment?.username ||
        comment?.name ||
        "unknown"
    );
}

function getCommentCreatedAt(comment) {
    return comment?.created_at || comment?.createdAt || comment?.created || "";
}

function getCommentContent(comment) {
    return comment?.content || comment?.body || comment?.text || "";
}

function getCommentScore(comment) {
    const score = comment?.score ?? comment?.upvotes ?? comment?.votes ?? 0;
    return Number.isFinite(Number(score)) ? Number(score) : 0;
}

function formatTimestamp(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return String(ts);
    return d.toLocaleString();
}

function renderCommentRow(comment) {
    const id = getCommentId(comment);
    const author = getCommentAuthor(comment);
    const cleanAuthor = String(author).replace("/^u\\//", "");
    const createdAt = formatTimestamp(getCommentCreatedAt(comment));
    const content = getCommentContent(comment);
    const score = getCommentScore(comment);

    const row = document.createElement("div");
    row.className = "py-2";
    if (id) row.dataset.commentId = id;

    const meta = document.createElement("div");
    meta.className = "flex items-center gap-2 text-xs text-[#818384] mb-1";
    const authorLink = document.createElement("a");
    authorLink.className = "text-[#d7dadc] font-medium hover:underline";
    authorLink.href = `/u/${cleanAuthor}`;
    authorLink.textContent = `u/${cleanAuthor}`;
    meta.appendChild(authorLink);
    if (createdAt) {
        const sep = document.createElement("span");
        sep.textContent = "•";
        const time = document.createElement("span");
        time.textContent = createdAt;
        meta.append(sep, time);
    }

    const body = document.createElement("div");
    body.className = "text-sm mb-2";
    const prose = document.createElement("div");
    prose.className = "prose prose-invert prose-sm max-w-none";
    const p = document.createElement("p");
    p.className = "text-[#d7dadc] mb-2 last:mb-0";
    p.textContent = String(content);
    prose.appendChild(p);
    body.appendChild(prose);

    const actions = document.createElement("div");
    actions.className = "flex items-center gap-3 text-xs text-[#818384]";
    const votes = document.createElement("span");
    votes.className = "flex items-center gap-1";

    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.className = "text-[#ff4500]";
    upBtn.textContent = "▲";
    if (id) upBtn.dataset.commentId = id;
    upBtn.dataset.moltbookAction = "comment-upvote";

    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.className = "text-[#7193ff]";
    downBtn.textContent = "▼";
    if (id) downBtn.dataset.commentId = id;
    downBtn.dataset.moltbookAction = "comment-downvote";

    votes.append(upBtn, document.createTextNode(String(score)), downBtn);
    actions.appendChild(votes);

    const replyBtn = document.createElement("button");
    replyBtn.type = "button";
    replyBtn.className = "text-[#818384] hover:text-[#d7dadc]";
    replyBtn.textContent = "Reply";
    if (id) replyBtn.dataset.commentId = id;

    replyBtn.addEventListener("click", async (e) => {
        console.log("Reply Button clicked");
        e.preventDefault();
        e.stopPropagation();
        if (!id) return;
        const content = prompt("Reply to this comment:");
        if (!content) return;
        try {
            replyBtn.disabled = true;
            const postId = findPostIdFromLocation();
            const res = await bgMessage({
                type: "moltbook/post/comment",
                postId,
                content,
                parentId: id
            });
            if (!res?.ok) throw new Error(res?.error || "Request failed");
            toast("Reply posted", "ok");
            await refreshComments("top");
        } catch (err) {
            toast(err.message || "Reply failed", "error");
        } finally {
            replyBtn.disabled = false;
        }
    });

    actions.appendChild(replyBtn);
    row.append(meta, body, actions);
    return row;
}

function renderCommentThread(comment) {
    const thread = document.createElement("div");
    thread.appendChild(renderCommentRow(comment));

    const replies = getCommentReplies(comment);
    if (replies.length) {
        const nested = document.createElement("div");
        nested.className = "ml-4 pl-4 border-l-2 border-[#343536]";
        for (const reply of replies) {
            nested.appendChild(renderCommentThread(reply));
        }
        thread.appendChild(nested);
    }

    return thread;
}

function renderCommentComposer(postId) {
    const wrap = document.createElement("div");
    wrap.className = "mb-4";

    const label = document.createElement("div");
    label.className = "text-sm text-[#818384] mb-2";
    label.textContent = "Add a comment";

    const textarea = document.createElement("textarea");
    textarea.className = "w-full bg-[#0f0f10] text-[#d7dadc] border border-[#343536] rounded-lg p-2 text-sm";
    textarea.rows = 3;
    textarea.placeholder = "Great insight!";

    const actions = document.createElement("div");
    actions.className = "flex items-center gap-2 mt-2";

    const submit = document.createElement("button");
    submit.type = "button";
    submit.textContent = "Post";
    submit.className = "px-3 py-1 rounded-md text-sm bg-[#272729] text-white";

    submit.addEventListener("click", async () => {
        const content = textarea.value.trim();
        if (!content) return;
        try {
            submit.disabled = true;
            const res = await bgMessage({
                type: "moltbook/post/comment",
                postId,
                content
            });
            if (!res?.ok) throw new Error(res?.error || "Request failed");
            textarea.value = "";
            toast("Comment posted", "ok");
            await refreshComments("top");
        } catch (err) {
            toast(err.message || "Comment failed", "error");
        } finally {
            submit.disabled = false;
        }
    });

    actions.appendChild(submit);
    wrap.append(label, textarea, actions);
    return wrap;
}

function renderPostComposer(submolt) {
    const wrap = document.createElement("div");
    wrap.className = "mb-6 bg-[#1a1a1b] border border-[#343536] rounded-lg p-4";
    wrap.dataset.moltbookPostComposer = "true";

    const header = document.createElement("div");
    header.className = "text-sm text-[#818384] mb-3";
    header.textContent = `Create a post in m/${submolt}`;

    const title = document.createElement("input");
    title.className = "w-full bg-[#0f0f10] text-[#d7dadc] border border-[#343536] rounded-lg p-2 text-sm mb-3";
    title.type = "text";
    title.placeholder = "Title";

    const typeRow = document.createElement("div");
    typeRow.className = "flex items-center gap-2 mb-3";

    const textBtn = document.createElement("button");
    textBtn.type = "button";
    textBtn.className = "px-3 py-1 rounded-md text-xs bg-[#272729] text-white";
    textBtn.textContent = "Text";

    const linkBtn = document.createElement("button");
    linkBtn.type = "button";
    linkBtn.className = "px-3 py-1 rounded-md text-xs bg-[#1a1a1b] text-[#818384] border border-[#343536]";
    linkBtn.textContent = "Link";

    const contentWrap = document.createElement("div");
    const content = document.createElement("textarea");
    content.className = "w-full bg-[#0f0f10] text-[#d7dadc] border border-[#343536] rounded-lg p-2 text-sm";
    content.rows = 4;
    content.placeholder = "Write your post...";
    contentWrap.appendChild(content);

    const urlWrap = document.createElement("div");
    urlWrap.style.display = "none";
    const url = document.createElement("input");
    url.className = "w-full bg-[#0f0f10] text-[#d7dadc] border border-[#343536] rounded-lg p-2 text-sm";
    url.type = "url";
    url.placeholder = "https://example.com";
    urlWrap.appendChild(url);

    const actions = document.createElement("div");
    actions.className = "flex items-center gap-2 mt-3";

    const submit = document.createElement("button");
    submit.type = "button";
    submit.textContent = "Post";
    submit.className = "px-3 py-1 rounded-md text-sm bg-[#272729] text-white";

    let postType = "text";
    const setType = (type) => {
        postType = type;
        const isText = type === "text";
        textBtn.className = isText
            ? "px-3 py-1 rounded-md text-xs bg-[#272729] text-white"
            : "px-3 py-1 rounded-md text-xs bg-[#1a1a1b] text-[#818384] border border-[#343536]";
        linkBtn.className = !isText
            ? "px-3 py-1 rounded-md text-xs bg-[#272729] text-white"
            : "px-3 py-1 rounded-md text-xs bg-[#1a1a1b] text-[#818384] border border-[#343536]";
        contentWrap.style.display = isText ? "" : "none";
        urlWrap.style.display = isText ? "none" : "";
    };

    textBtn.addEventListener("click", () => setType("text"));
    linkBtn.addEventListener("click", () => setType("link"));

    submit.addEventListener("click", async () => {
        const titleText = title.value.trim();
        if (!titleText) {
            toast("Title is required", "error");
            return;
        }

        const contentText = content.value.trim();
        const urlText = url.value.trim();
        if (postType === "text" && !contentText) {
            toast("Content is required", "error");
            return;
        }
        if (postType === "link" && !urlText) {
            toast("URL is required", "error");
            return;
        }

        try {
            submit.disabled = true;
            const res = await bgMessage({
                type: "moltbook/post/create",
                submolt,
                title: titleText,
                content: postType === "text" ? contentText : undefined,
                url: postType === "link" ? urlText : undefined
            });
            if (!res?.ok) throw new Error(res?.error || "Request failed");
            title.value = "";
            content.value = "";
            url.value = "";
            toast("Post created", "ok");
        } catch (err) {
            toast(err.message || "Post failed", "error");
        } finally {
            submit.disabled = false;
        }
    });

    typeRow.append(textBtn, linkBtn);
    actions.appendChild(submit);
    wrap.append(header, title, typeRow, contentWrap, urlWrap, actions);
    return wrap;
}

async function refreshComments(sort = "top") {
    console.log("[moltbook-chrome-user] Refreshing comments");
    if (!isOnPostPageWithComments()) return;
    const postId = findPostIdFromLocation();
    if (!postId) return;

    const container = getPostCommentsContainer();
    if (!container) return;

    container.textContent = "Loading comments...";

    try {
        const res = await bgMessage({ type: "posts/comments", postId, sort });
        if (!res?.ok) throw new Error(res?.error || "Failed to load comments");

        const comments = normalizeCommentList(res.data || {});
        container.innerHTML = "";
        container.appendChild(renderCommentComposer(postId));
        if (!comments.length) {
            const empty = document.createElement("div");
            empty.className = "text-sm text-[#818384]";
            empty.textContent = "No comments yet.";
            container.appendChild(empty);
            return;
        }

        const wrap = document.createElement("div");
        wrap.className = "";
        for (const comment of comments) {
            wrap.appendChild(renderCommentThread(comment));
        }
        container.appendChild(wrap);
    } catch (e) {
        container.textContent = `Failed to load comments: ${e.message}`;
    }
}

function ensureSubmoltComposer() {
    if (!isOnSubmoltPage()) return;
    const submolt = getSubmoltFromLocation();
    if (!submolt) return;
    const main = getSubmoltMainColumn();
    if (!main) return;
    if (main.querySelector("[data-moltbook-post-composer='true']")) return;
    main.prepend(renderPostComposer(submolt));
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
        line1.append("User: ");
        const userLink = document.createElement("a");
        userLink.className = "text-[#d7dadc] font-medium hover:underline";
        userLink.href = `/u/${active.name}`;
        userLink.textContent = active.name;
        line1.appendChild(userLink);

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

    const arrowAction = inferArrowAction(target);
    const action = (explicitAction || arrowAction || inferAction(btn))?.toLowerCase();
    if (!action) return;
    if (!explicitAction && action === "comment" && btn.tagName === "A") return;
    if (!explicitAction && arrowAction && isInCommentsSection(target)) return;

    const { isCommentAction, postId, commentId } = resolveVoteContext(btn, action);
    if (action === "upvote" || action === "downvote") {
        e.preventDefault();
        e.stopPropagation();
        await handleVote(action, postId, btn);
        return;
    }

    if (action === "comment-downvote") {
        e.preventDefault();
        e.stopPropagation();
        toast("Comment downvote not supported yet (moltbook doesn't support it)", "error");
        return;
    }

    if (action === "comment" && !postId && !commentId && !explicitAction) {
        return;
    }

    if (action === "comment" || action === "comment-upvote" || isCommentAction) {
        e.preventDefault();
        e.stopPropagation();
        await handleComment(action, { postId, commentId }, btn);
    }
}

// Capture phase so we can intercept before navigation/handlers (even if the page adds some later)
document.addEventListener("click", handleClick, true);

console.log("[moltbook-chrome-user] content script active");

renderHeaderStatus().then(() => console.log("[moltbook-chrome-user] header rendered"));
ensureSubmoltComposer();

function scheduleInitialCommentsRefresh() {
    if (!isOnPostPage()) return;

    const attempt = () => {
        if (isOnPostPageWithComments()) {
            refreshComments("top");
            return true;
        }
        return false;
    };

    if (attempt()) return;

    let tries = 0;
    const timer = setInterval(() => {
        tries += 1;
        if (attempt() || tries >= 10) {
            clearInterval(timer);
        }
    }, 500);
}

function scheduleSubmoltComposer() {
    if (!isOnSubmoltPage()) return;

    const attempt = () => {
        ensureSubmoltComposer();
        return Boolean(getSubmoltMainColumn());
    };

    if (attempt()) return;

    let tries = 0;
    const timer = setInterval(() => {
        tries += 1;
        if (attempt() || tries >= 10) {
            clearInterval(timer);
        }
    }, 500);
}

scheduleSubmoltComposer();

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleInitialCommentsRefresh, { once: true });
} else {
    scheduleInitialCommentsRefresh();
}
