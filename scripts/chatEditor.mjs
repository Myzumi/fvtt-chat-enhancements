import {ASSETS_PATH, MODULE_ID} from "./constants.mjs";
import {parse} from "./markdownParser.mjs";
import {textToHtml} from "./chatText.mjs";

// Text shown in the edit box: what the player typed (stored on send), or the HTML for older messages.
export function editableText(message) {
    return message.flags?.[MODULE_ID]?.source ?? message.content;
}
// Update for a saved edit: formatted like a freshly sent message, keeping the typed text for the next edit.
// Messages typed in the v14 chat box were sent as "<p>…</p>", so their edits are wrapped the same way;
// command messages (/desc …) and older messages without stored text are parsed as they are.
export function editUpdate(text, message) {
    const typedInChatBox = message?.flags?.[MODULE_ID]?.source !== undefined && /^\s*<p[\s>]/i.test(message.content ?? "");
    return {
        content: parse(typedInChatBox ? textToHtml(text) : text),
        [`flags.${MODULE_ID}.source`]: text
    };
}

export default class ChatEditor {
    static initialize() {
        if (document.querySelector("#chat-editor")) return;
        const placeholder = document.createElement("div");
        placeholder.id = "chat-editor-placeholder";
        placeholder.innerHTML = "<i class=\"fa-solid fa-pen-to-square\"></i>" + game.i18n.localize("MRKB.ChatEditPlaceholder");

        const editor = document.createElement("textarea");
        editor.id = "chat-editor";
        editor.autocomplete = "off";
        editor.classList.add("disabled");
        editor.onkeydown = (e) => ChatEditor._onKeyDown(e);

        const chatForm = document.querySelector(".chat-form");
        chatForm.append(editor, placeholder);
    }
    static _onKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) ChatEditor._send(e);
        else if (e.key === "Escape") ChatEditor._quit(e);
    }
    static _send(ev) {
        ev.preventDefault();
        const message = document.querySelector("#chat-message");
        const editor = document.querySelector("#chat-editor");

        const id = editor.dataset.mid;
        const msg = game.messages.get(id);

        message.classList.remove("disabled");
        editor.classList.add("disabled");

        msg.update(editUpdate(editor.value, msg));
        editor.value = "";
        message.focus();
    }
    static _quit() {
        const message = document.querySelector("#chat-message");
        const editor = document.querySelector("#chat-editor");

        message.classList.remove("disabled");
        editor.classList.add("disabled");

        editor.value = "";
        message.focus();
    }
    static _edit(id) {
        const message = game.messages.get(id);
        const chatter = document.querySelector("#chat-message");
        const editor = document.querySelector("#chat-editor");

        chatter.classList.add("disabled");
        editor.classList.remove("disabled");
        editor.dataset.mid = id;
        editor.value = editableText(message);
        editor.focus();
    }
}