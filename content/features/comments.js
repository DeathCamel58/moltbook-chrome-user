import { bgMessage } from "../api.js";
import { toast } from "../dom/toast.js";

export async function handleComment(action, { postId, commentId }, btn) {
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
