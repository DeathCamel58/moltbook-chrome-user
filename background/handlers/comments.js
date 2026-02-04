import { moltbookFetch } from "../api/moltbookClient.js";
import { requireActiveApiKey } from "./activeKey.js";

export async function list(postId, sort = "top") {
    if (!postId) throw new Error("postId is required");
    const apiKey = await requireActiveApiKey();
    const url = `/posts/${postId}/comments?sort=${encodeURIComponent(sort)}`;
    return moltbookFetch(apiKey, url, { method: "GET" });
}
