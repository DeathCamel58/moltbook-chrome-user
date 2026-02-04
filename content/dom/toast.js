export function toast(text, kind = "info") {
    const node = document.createElement("div");
    node.className = `mbcu-toast mbcu-${kind}`;
    node.textContent = text;
    document.documentElement.appendChild(node);
    setTimeout(() => node.classList.add("mbcu-show"), 10);
    setTimeout(() => {
        node.classList.remove("mbcu-show");
        setTimeout(() => node.remove(), 250);
    }, 1800);
}
