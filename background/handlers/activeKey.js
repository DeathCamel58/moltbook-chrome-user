import { getActiveAgent } from "../storage/identityStore.js";

export async function requireActiveApiKey() {
    const active = await getActiveAgent();
    if (!active?.apiKey) throw new Error("No active Moltbook identity selected");
    return active.apiKey;
}
