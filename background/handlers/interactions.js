import { moltbookFetch } from "../api/moltbookClient.js";
import { requireActiveApiKey } from "./activeKey.js";

export async function postUpvote(postId) {
    if (!postId) throw new Error("postId is required");
    const apiKey = await requireActiveApiKey();
    return moltbookFetch(apiKey, `/posts/${postId}/upvote`, { method: "POST" });
}

export async function postDownvote(postId) {
    if (!postId) throw new Error("postId is required");
    const apiKey = await requireActiveApiKey();
    return moltbookFetch(apiKey, `/posts/${postId}/downvote`, { method: "POST" });
}

export async function commentUpvote(commentId) {
    if (!commentId) throw new Error("commentId is required");
    const apiKey = await requireActiveApiKey();
    return moltbookFetch(apiKey, `/comments/${commentId}/upvote`, { method: "POST" });
}

export async function postComment({ postId, content, parentId }) {
    if (!postId) throw new Error("postId is required");
    if (!content || typeof content !== "string") throw new Error("content is required");

    const apiKey = await requireActiveApiKey();
    const body = parentId ? { content, parent_id: parentId } : { content };

    return moltbookFetch(apiKey, `/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
}
