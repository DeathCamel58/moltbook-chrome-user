export function bgMessage(payload) {
    return chrome.runtime.sendMessage(payload);
}
