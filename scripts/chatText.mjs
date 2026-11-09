// Foundry v14's chat input is a ProseMirror editor: it sends typed text as HTML ("<p>text</p>",
// Shift+Enter as "<br>", with < > & escaped). These helpers convert between that and plain typed text.

const ENTITIES = { "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&nbsp;": " ", "&amp;": "&" };

export function htmlToText(html = "") {
    return String(html)
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
        .replace(/^\s*<p[^>]*>/i, "")
        .replace(/<\/p>\s*$/i, "")
        .replace(/&(lt|gt|quot|#39|nbsp|amp);/g, (entity) => ENTITIES[entity]);
}

export function textToHtml(text = "") {
    const escaped = String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<p>${escaped.split("\n").join("<br>")}</p>`;
}
