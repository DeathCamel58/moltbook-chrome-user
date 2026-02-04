import { moltbookFetch } from "../api/moltbookClient.js";
import { requireActiveApiKey } from "./activeKey.js";

export async function create({ submolt, title, content, url }) {
    if (!submolt || typeof submolt !== "string") throw new Error("submolt is required");
    if (!title || typeof title !== "string") throw new Error("title is required");
    if (!content && !url) throw new Error("content or url is required");

    const apiKey = await requireActiveApiKey();
    const body = { submolt, title };
    if (content) body.content = content;
    if (url) body.url = url;

    return moltbookFetch(apiKey, "/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
}
