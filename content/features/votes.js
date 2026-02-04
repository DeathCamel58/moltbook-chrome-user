import { bgMessage } from "../api.js";
import { toast } from "../dom/toast.js";

export async function handleVote(action, postId, btn) {
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
