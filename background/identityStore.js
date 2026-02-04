const STORAGE_KEY = "moltbook_state_v1";

function makeId() {
    return `agent_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export async function loadState() {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const state = data[STORAGE_KEY] || { version: 1, activeAgentId: null, agents: {} };
    state.version ||= 1;
    state.activeAgentId ||= null;
    state.agents ||= {};
    return state;
}

export async function saveState(state) {
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

export async function listAgents() {
    const state = await loadState();
    return { activeAgentId: state.activeAgentId, agents: Object.values(state.agents) };
}

export async function getActiveAgent() {
    const state = await loadState();
    if (!state.activeAgentId) return null;
    return state.agents[state.activeAgentId] || null;
}

export async function setActiveAgent(agentId) {
    const state = await loadState();
    if (!state.agents[agentId]) throw new Error("Unknown agent");
    state.activeAgentId = agentId;
    state.agents[agentId].lastUsedAt = new Date().toISOString();
    await saveState(state);
    return state.agents[agentId];
}

export async function deleteAgent(agentId) {
    const state = await loadState();
    delete state.agents[agentId];
    if (state.activeAgentId === agentId) {
        state.activeAgentId = Object.keys(state.agents)[0] || null;
    }
    await saveState(state);
    return state.activeAgentId;
}

export async function addAgentFromRegisterResponse({ name, description, api_key, claim_url }) {
    const state = await loadState();
    const id = makeId();
    const now = new Date().toISOString();

    state.agents[id] = {
        id,
        name,
        description: description || "",
        apiKey: api_key,
        claimUrl: claim_url,
        createdAt: now,
        lastUsedAt: now
    };

    if (!state.activeAgentId) state.activeAgentId = id;

    await saveState(state);
    return state.agents[id];
}
