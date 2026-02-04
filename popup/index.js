import { bgMessage } from "./api.js";
import { $, setStatus, escapeHtml, openVerification } from "./view.js";

let activeAgentId = null;

function setDmStatus(text) {
    $("#dmStatus").textContent = text || "";
}

function extractRequestList(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.requests)) return data.requests;
    return [];
}

function extractCounts(data) {
    const pending = data?.pending_requests ?? data?.pendingRequests ?? data?.pending ?? 0;
    const unread = data?.unread_messages ?? data?.unreadMessages ?? data?.unread ?? 0;
    return { pending, unread };
}

function formatRequestLabel(req) {
    const id = req?.conversation_id || req?.conversationId || req?.id || "(unknown)";
    const from = req?.from || req?.requester || req?.sender || req?.agent_name || req?.agentName || "";
    const parts = [`Conversation: ${id}`];
    if (from) parts.push(`From: ${from}`);
    return parts.join(" • ");
}

async function getClaimStatusForAgent(agent) {
    if (!agent?.apiKey) return { status: "unknown" };

    const res = await bgMessage({ type: "agents/checkStatus", apiKey: agent.apiKey });
    if (!res.ok) throw new Error(res.error);

    const status = res.data?.status || "unknown";
    return { status };
}

async function refreshAgents() {
    const res = await bgMessage({ type: "agents/list" });
    if (!res.ok) throw new Error(res.error);

    const { agents, activeAgentId: activeAgentIdValue } = res.data;
    activeAgentId = activeAgentIdValue;
    const wrap = $("#agents");
    wrap.innerHTML = "";

    if (!agents.length) {
        setStatus("No identities yet. Register one below.");
        await refreshDm();
        return;
    }

    setStatus(`Active identity: ${agents.find((a) => a.id === activeAgentId)?.name || "none"}`);

    for (const agent of agents) {
        const row = document.createElement("div");
        row.className = "agentRow";

        const left = document.createElement("div");
        left.innerHTML = `
          <div class="agentName">${escapeHtml(agent.name)}</div>
          <div class="agentDesc">${escapeHtml(agent.description || "")}</div>
          <div class="agentStatus" data-agent-status>Checking claim status…</div>
        `;

        const badge = document.createElement("div");
        badge.className = "badge";
        badge.textContent = agent.id === activeAgentId ? "Active" : "Inactive";

        const actions = document.createElement("div");
        actions.style.display = "flex";
        actions.style.gap = "6px";
        actions.style.flexWrap = "wrap";
        actions.style.justifyContent = "flex-end";

        const useBtn = document.createElement("button");
        useBtn.textContent = "Use";
        useBtn.disabled = agent.id === activeAgentId;
        useBtn.addEventListener("click", async () => {
            const r = await bgMessage({ type: "agents/setActive", agentId: agent.id });
            if (!r.ok) throw new Error(r.error);
            await refreshAgents();
        });

        const verifyBtn = document.createElement("button");
        verifyBtn.textContent = "Verify User";
        verifyBtn.style.display = "none";
        verifyBtn.addEventListener("click", () => openVerification(agent.claimUrl));

        const refreshBtn = document.createElement("button");
        refreshBtn.textContent = "Refresh";
        refreshBtn.addEventListener("click", async () => {
            const statusEl = left.querySelector("[data-agent-status]");
            try {
                refreshBtn.disabled = true;
                statusEl.textContent = "Checking claim status…";
                const { status } = await getClaimStatusForAgent(agent);
                if (status === "claimed") {
                    statusEl.textContent = "Claimed ✅";
                    statusEl.dataset.kind = "ok";
                    verifyBtn.style.display = "none";
                } else if (status === "pending_claim") {
                    statusEl.textContent = "Not claimed — verify user";
                    statusEl.dataset.kind = "warn";
                    verifyBtn.style.display = agent.claimUrl ? "" : "none";
                } else {
                    statusEl.textContent = "Claim status unknown";
                    statusEl.dataset.kind = "muted";
                    verifyBtn.style.display = agent.claimUrl ? "" : "none";
                }
            } catch (e) {
                const statusEl = left.querySelector("[data-agent-status]");
                statusEl.textContent = `Status check failed: ${e.message}`;
                statusEl.dataset.kind = "error";
                verifyBtn.style.display = agent.claimUrl ? "" : "none";
            } finally {
                refreshBtn.disabled = false;
            }
        });

        const delBtn = document.createElement("button");
        delBtn.textContent = "Delete";
        delBtn.addEventListener("click", async () => {
            const ok = confirm(`Delete identity "${agent.name}"? This cannot be undone.`);
            if (!ok) return;
            const r = await bgMessage({ type: "agents/delete", agentId: agent.id });
            if (!r.ok) throw new Error(r.error);
            await refreshAgents();
        });

        actions.append(useBtn, verifyBtn, refreshBtn, delBtn);
        row.append(left, badge, actions);
        wrap.append(row);

        // Kick off an async status check (don’t block rendering the whole list)
        (async () => {
            const statusEl = left.querySelector("[data-agent-status]");
            try {
                const { status } = await getClaimStatusForAgent(agent);
                if (status === "claimed") {
                    statusEl.textContent = "Claimed ✅";
                    statusEl.dataset.kind = "ok";
                    verifyBtn.style.display = "none";
                } else if (status === "pending_claim") {
                    statusEl.textContent = "Not claimed — verify user";
                    statusEl.dataset.kind = "warn";
                    verifyBtn.style.display = agent.claimUrl ? "" : "none";
                } else {
                    statusEl.textContent = "Claim status unknown";
                    statusEl.dataset.kind = "muted";
                    verifyBtn.style.display = agent.claimUrl ? "" : "none";
                }
            } catch (e) {
                statusEl.textContent = `Status check failed: ${e.message}`;
                statusEl.dataset.kind = "error";
                verifyBtn.style.display = agent.claimUrl ? "" : "none";
            }
        })();
    }

    await refreshDm();
}

async function registerNew() {
    const name = $("#newName").value.trim();
    const description = $("#newDesc").value.trim();

    $("#registerResult").classList.add("hidden");

    const res = await bgMessage({ type: "agents/register", name, description });
    if (!res.ok) throw new Error(res.error);

    const { claimUrl, verificationCode } = res.data;

    $("#claimUrl").href = claimUrl || "https://www.moltbook.com";
    $("#claimUrl").textContent = claimUrl ? "open" : "(missing)";
    $("#verificationCode").textContent = verificationCode || "(missing)";

    $("#registerResult").classList.remove("hidden");

    $("#newName").value = "";
    $("#newDesc").value = "";

    await refreshAgents();
}

async function refreshDm() {
    const wrap = $("#dmRequests");
    wrap.innerHTML = "";

    if (!activeAgentId) {
        setDmStatus("Select an identity to check DMs.");
        return;
    }

    try {
        setDmStatus("Checking DMs…");

        const [checkRes, requestsRes] = await Promise.all([
            bgMessage({ type: "dm/check" }),
            bgMessage({ type: "dm/requests" })
        ]);

        if (!checkRes.ok) throw new Error(checkRes.error);
        if (!requestsRes.ok) throw new Error(requestsRes.error);

        const { pending, unread } = extractCounts(checkRes.data || {});
        setDmStatus(`Pending requests: ${pending} • Unread messages: ${unread}`);

        const requests = extractRequestList(requestsRes.data || {});
        if (!requests.length) {
            const empty = document.createElement("div");
            empty.className = "dmMeta";
            empty.textContent = "No pending requests.";
            wrap.append(empty);
            return;
        }

        for (const req of requests) {
            const row = document.createElement("div");
            row.className = "dmRow";

            const meta = document.createElement("div");
            meta.className = "dmMeta";
            meta.textContent = formatRequestLabel(req);

            const actions = document.createElement("div");
            const approveBtn = document.createElement("button");
            approveBtn.textContent = "Approve";
            approveBtn.addEventListener("click", async () => {
                const conversationId =
                    req?.conversation_id || req?.conversationId || req?.id;
                if (!conversationId) return;
                const ok = confirm("Approve this DM request? Your human should decide.");
                if (!ok) return;
                approveBtn.disabled = true;
                try {
                    const res = await bgMessage({
                        type: "dm/requests/approve",
                        conversationId
                    });
                    if (!res.ok) throw new Error(res.error);
                    await refreshDm();
                } catch (e) {
                    setDmStatus(`Error: ${e.message}`);
                } finally {
                    approveBtn.disabled = false;
                }
            });

            actions.append(approveBtn);
            row.append(meta, actions);
            wrap.append(row);
        }
    } catch (e) {
        setDmStatus(`Error: ${e.message}`);
    }
}

$("#createBtn").addEventListener("click", async () => {
    try {
        setStatus("Registering…");
        await registerNew();
        setStatus("Registered. Verify user to claim.");
    } catch (e) {
        setStatus(`Error: ${e.message}`);
    }
});

$("#dmRefreshBtn").addEventListener("click", async () => {
    await refreshDm();
});

refreshAgents().catch((e) => setStatus(`Error: ${e.message}`));
