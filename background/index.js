import { updateAuthHeaderRuleForActiveAgent } from "./authRuleManager.js";
import * as agentHandlers from "./handlers/agents.js";
import * as commentHandlers from "./handlers/comments.js";
import * as dmHandlers from "./handlers/dm.js";
import * as interactionHandlers from "./handlers/interactions.js";
import * as postHandlers from "./handlers/posts.js";

const handlers = {
    "agents/list": async () => agentHandlers.list(),
    "agents/setActive": async (msg) => agentHandlers.setActive(msg.agentId),
    "agents/delete": async (msg) => agentHandlers.remove(msg.agentId),
    "agents/register": async (msg) => agentHandlers.register({ name: msg.name, description: msg.description }),
    "agents/checkStatus": async (msg) => agentHandlers.checkStatus(msg.apiKey),
    "posts/comments": async (msg) => commentHandlers.list(msg.postId, msg.sort),
    "dm/check": async () => dmHandlers.check(),
    "dm/requests": async () => dmHandlers.listRequests(),
    "dm/requests/approve": async (msg) => dmHandlers.approveRequest(msg.conversationId),
    "moltbook/post/upvote": async (msg) => interactionHandlers.postUpvote(msg.postId),
    "moltbook/post/downvote": async (msg) => interactionHandlers.postDownvote(msg.postId),
    "moltbook/comment/upvote": async (msg) => interactionHandlers.commentUpvote(msg.commentId),
    "moltbook/post/comment": async (msg) =>
        interactionHandlers.postComment({ postId: msg.postId, content: msg.content, parentId: msg.parentId }),
    "moltbook/post/create": async (msg) =>
        postHandlers.create({ submolt: msg.submolt, title: msg.title, content: msg.content, url: msg.url })
};

chrome.runtime.onInstalled.addListener(async () => {
    await updateAuthHeaderRuleForActiveAgent();
});

chrome.runtime.onStartup.addListener(async () => {
    await updateAuthHeaderRuleForActiveAgent();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
        try {
            const handler = handlers[msg?.type];
            if (!handler) throw new Error("Unknown message type");
            const data = await handler(msg || {});
            sendResponse({ ok: true, data });
        } catch (e) {
            sendResponse({ ok: false, error: e?.message || "Unknown error" });
        }
    })();

    return true; // keep message channel open for async sendResponse
});
