const $ = (sel) => document.querySelector(sel);

function bgMessage(payload) {
    return chrome.runtime.sendMessage(payload);
}

function setStatus(text) {
    $("#status").textContent = text || "";
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function openVerification(claimUrl) {
    if (!claimUrl) return;
    chrome.tabs.create({ url: claimUrl });
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

    const { agents, activeAgentId } = res.data;
    const wrap = $("#agents");
    wrap.innerHTML = "";

    if (!agents.length) {
        setStatus("No identities yet. Register one below.");
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

$("#createBtn").addEventListener("click", async () => {
    try {
        setStatus("Registering…");
        await registerNew();
        setStatus("Registered. Verify user to claim.");
    } catch (e) {
        setStatus(`Error: ${e.message}`);
    }
});

refreshAgents().catch((e) => setStatus(`Error: ${e.message}`));
