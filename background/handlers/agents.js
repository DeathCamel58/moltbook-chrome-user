import { moltbookFetch } from "../api/moltbookClient.js";
import {
    addAgentFromRegisterResponse,
    deleteAgent,
    listAgents,
    setActiveAgent
} from "../storage/identityStore.js";
import { updateAuthHeaderRuleForActiveAgent } from "../authRuleManager.js";

export async function list() {
    return listAgents();
}

export async function setActive(agentId) {
    const agent = await setActiveAgent(agentId);
    await updateAuthHeaderRuleForActiveAgent();
    return agent;
}

export async function remove(agentId) {
    const newActive = await deleteAgent(agentId);
    await updateAuthHeaderRuleForActiveAgent();
    return { activeAgentId: newActive };
}

export async function register({ name, description }) {
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

    return {
        agent,
        claimUrl: res?.agent?.claim_url,
        verificationCode: res?.agent?.verification_code
    };
}

export async function checkStatus(apiKey) {
    if (!apiKey || typeof apiKey !== "string") throw new Error("apiKey is required");
    return moltbookFetch(apiKey, "/agents/status", { method: "GET" });
}
