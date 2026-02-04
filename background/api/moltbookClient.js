export async function moltbookFetch(apiKey, path, options = {}) {
    const url = new URL(`https://www.moltbook.com/api/v1/${path.replace(/^\/+/, "")}`);

    // Hard security checks
    if (url.origin !== "https://www.moltbook.com") throw new Error("Blocked: invalid origin");
    if (!url.pathname.startsWith("/api/v1/")) throw new Error("Blocked: invalid path");

    const headers = new Headers(options.headers || {});
    if (apiKey) headers.set("Authorization", `Bearer ${apiKey}`);
    if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");

    const res = await fetch(url, {
        ...options,
        headers,
        redirect: "error",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
        const message = data?.error || `HTTP ${res.status}`;
        const hint = data?.hint;
        const err = new Error(hint ? `${message} (${hint})` : message);
        err.status = res.status;
        err.data = data;
        throw err;
    }

    return data;
}
