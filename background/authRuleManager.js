import { getActiveAgent } from "./storage/identityStore.js";

const AUTH_RULE_ID = 1;

export async function updateAuthHeaderRuleForActiveAgent() {
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
