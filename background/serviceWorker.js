import { moltbookFetch } from "./moltbookApi.js";
import {
    addAgentFromRegisterResponse,
    deleteAgent,
    getActiveAgent,
    listAgents,
    setActiveAgent
} from "./identityStore.js";

const AUTH_RULE_ID = 1;

async function updateAuthHeaderRuleForActiveAgent() {
    const active = await getActiveAgent();

    // Always remove any existing rule first
    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [AUTH_RULE_ID],
        addRules: []
    });

    // If no active agent, we leave the site unauthenticated.
    if (!active?.apiKey) return;

    // Only attach Authorization to https://www.moltbook.com/api/v1/*
    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [],
        addRules: [
            {
                id: AUTH_RULE_ID,
                priority: 1,
                action: {
                    type: "modifyHeaders",
                    requestHeaders: [
                        {
                            header: "Authorization",
                            operation: "set",
                            value: `Bearer ${active.apiKey}`
                        }
                    ]
                },
                condition: {
                    urlFilter: "https://www.moltbook.com/api/v1/",
                    resourceTypes: ["xmlhttprequest"]
                }
            }
        ]
    });
}

async function requireActiveApiKey() {
    const active = await getActiveAgent();
    if (!active?.apiKey) throw new Error("No active Moltbook identity selected");
    return active.apiKey;
}

chrome.runtime.onInstalled.addListener(async () => {
    await updateAuthHeaderRuleForActiveAgent();
});

chrome.runtime.onStartup.addListener(async () => {
    await updateAuthHeaderRuleForActiveAgent();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
        try {
            switch (msg?.type) {
                case "agents/list": {
                    const data = await listAgents();
                    sendResponse({ ok: true, data });
                    return;
                }

                case "agents/setActive": {
                    const agent = await setActiveAgent(msg.agentId);
                    await updateAuthHeaderRuleForActiveAgent();
                    sendResponse({ ok: true, data: agent });
                    return;
                }

                case "agents/delete": {
                    const newActive = await deleteAgent(msg.agentId);
                    await updateAuthHeaderRuleForActiveAgent();
                    sendResponse({ ok: true, data: { activeAgentId: newActive } });
                    return;
                }

                case "agents/register": {
                    const { name, description } = msg;
                    if (!name || typeof name !== "string") throw new Error("Name is required");

                    // Registration does NOT require an API key.
                    const res = await moltbookFetch("", "/agents/register", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name, description: description || "" })
                    });

                    // Expected: { agent: { api_key, claim_url, verification_code }, ... }
                    const agent = await addAgentFromRegisterResponse({
                        name,
                        description,
                        api_key: res?.agent?.api_key,
                        claim_url: res?.agent?.claim_url
                    });

                    await updateAuthHeaderRuleForActiveAgent();

                    sendResponse({
                        ok: true,
                        data: {
                            agent,
                            claimUrl: res?.agent?.claim_url,
                            verificationCode: res?.agent?.verification_code
                        }
                    });
                    return;
                }

                case "agents/checkStatus": {
                    const { apiKey } = msg;
                    if (!apiKey || typeof apiKey !== "string") throw new Error("apiKey is required");

                    const data = await moltbookFetch(apiKey, "/agents/status", { method: "GET" });
                    // expected: { status: "pending_claim" | "claimed", ... }
                    sendResponse({ ok: true, data });
                    return;
                }

                case "moltbook/post/upvote": {
                    const apiKey = await requireActiveApiKey();
                    const { postId } = msg;
                    if (!postId) throw new Error("postId is required");
                    const data = await moltbookFetch(apiKey, `/posts/${postId}/upvote`, { method: "POST" });
                    sendResponse({ ok: true, data });
                    return;
                }

                case "moltbook/post/downvote": {
                    const apiKey = await requireActiveApiKey();
                    const { postId } = msg;
                    if (!postId) throw new Error("postId is required");
                    const data = await moltbookFetch(apiKey, `/posts/${postId}/downvote`, { method: "POST" });
                    sendResponse({ ok: true, data });
                    return;
                }

                case "moltbook/comment/upvote": {
                    const apiKey = await requireActiveApiKey();
                    const { commentId } = msg;
                    if (!commentId) throw new Error("commentId is required");
                    const data = await moltbookFetch(apiKey, `/comments/${commentId}/upvote`, { method: "POST" });
                    sendResponse({ ok: true, data });
                    return;
                }

                case "moltbook/post/comment": {
                    const apiKey = await requireActiveApiKey();
                    const { postId, content, parentId } = msg;
                    if (!postId) throw new Error("postId is required");
                    if (!content || typeof content !== "string") throw new Error("content is required");

                    const body = parentId ? { content, parent_id: parentId } : { content };
                    const data = await moltbookFetch(apiKey, `/posts/${postId}/comments`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(body)
                    });

                    sendResponse({ ok: true, data });
                    return;
                }

                default:
                    throw new Error("Unknown message type");
            }
        } catch (e) {
            sendResponse({ ok: false, error: e?.message || "Unknown error" });
        }
    })();

    return true; // keep message channel open for async sendResponse
});
