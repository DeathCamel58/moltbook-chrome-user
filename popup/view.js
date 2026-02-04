export const $ = (sel) => document.querySelector(sel);

export function setStatus(text) {
    $("#status").textContent = text || "";
}

export function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function openVerification(claimUrl) {
    if (!claimUrl) return;
    chrome.tabs.create({ url: claimUrl });
}
