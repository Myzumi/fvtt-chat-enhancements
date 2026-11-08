const SOCKET = "module.mrkb-chat-enhancements";
const TIMEOUT = 2000;       // a player counts as typing for this long after their last ping
const EMIT_INTERVAL = 1000; // send at most one ping per second, not one per keystroke

export default class TypingAlert {
    static #typing = new Map(); // userId -> { userName, timestamp }
    static #lastEmit = 0;
    static #lastText = "";

    static initialize() {
        if (document.querySelector("#typing-alert-container")) return;

        const container = document.createElement("div");
        container.id = "typing-alert-container";

        const text = document.createElement("span");
        text.id = "typing-alert-text";

        container.append(text);

        const chatForm = document.querySelector(".chat-form");
        chatForm.append(container);
        TypingAlert.#lastText = "";
    }
    // Called once on ready.
    static listen() {
        game.socket.on(SOCKET, TypingAlert.receiveTypingAlert);
        setInterval(() => {
            if (TypingAlert.#typing.size > 0) TypingAlert.handleTypingAlert();
        }, 1000);
    }
    static emitTypingAlert() {
        const now = Date.now();
        if (now - TypingAlert.#lastEmit < EMIT_INTERVAL) return;
        TypingAlert.#lastEmit = now;

        game.socket.emit(SOCKET, {
            type: "typingAlert",
            userId: game.user.id,
            userName: game.user.name
        });
    }
    static receiveTypingAlert(data) {
        if (data?.type !== "typingAlert") return;

        const {userId, userName} = data;
        TypingAlert.#typing.set(userId, {userName, timestamp: Date.now()});
        TypingAlert.handleTypingAlert();
    }
    static handleTypingAlert() {
        const now = Date.now();
        for (const [userId, e] of TypingAlert.#typing) {
            if (now - e.timestamp >= TIMEOUT) TypingAlert.#typing.delete(userId);
        }

        const playersList = [...TypingAlert.#typing.values()].map(e => e.userName).filter(name => name !== game.user.name).sort();
        const text = playersList.length === 0 ? "" : `${playersList.join(game.i18n.lang === "ja" ? "、" : ", ")} ${playersList.length === 1 ? game.i18n.localize("MRKB.IsTyping") : game.i18n.localize("MRKB.AreTyping")}`;
        if (text === TypingAlert.#lastText) return;
        TypingAlert.#lastText = text;

        const typingAlertContainer = document.querySelector("#typing-alert-container");
        const typingAlertText = document.querySelector("#typing-alert-text");
        if (!typingAlertContainer || !typingAlertText) return;

        typingAlertText.innerText = text;
        typingAlertContainer.classList.toggle("active", playersList.length > 0);
    }
}
