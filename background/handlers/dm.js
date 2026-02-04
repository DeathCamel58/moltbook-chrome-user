import { moltbookFetch } from "../api/moltbookClient.js";
import { requireActiveApiKey } from "./activeKey.js";

export async function check() {
    const apiKey = await requireActiveApiKey();
    return moltbookFetch(apiKey, "/agents/dm/check", { method: "GET" });
}

export async function listRequests() {
    const apiKey = await requireActiveApiKey();
    return moltbookFetch(apiKey, "/agents/dm/requests", { method: "GET" });
}

export async function approveRequest(conversationId) {
    if (!conversationId) throw new Error("conversationId is required");
    const apiKey = await requireActiveApiKey();
    return moltbookFetch(apiKey, `/agents/dm/requests/${conversationId}/approve`, { method: "POST" });
}
