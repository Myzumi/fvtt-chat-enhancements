import {MODULE_ID} from "./constants.mjs";

const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const DEFAULT_TEXT = {
    on: "{name} is now AFK",
    onReason: "{name} is now AFK: {reason}",
    off: "{name} is no longer AFK"
};

// What a chat line does to the AFK state: "on"/"off" for the /afk command, "return" for any other
// line sent while AFK (end AFK first, then send it), or null when it does not concern AFK.
export function afkAction({ isAfk, text }) {
    const trimmed = String(text ?? "").trim();
    const command = trimmed.match(/^\/afk(?:\s+([\s\S]*))?$/i);
    if (command) return isAfk ? { action: "off" } : { action: "on", reason: (command[1] ?? "").trim() };
    if (isAfk && trimmed) return { action: "return" };
    return null;
}

export function afkText(name, { afk, reason } = {}, templates = DEFAULT_TEXT) {
    const template = !afk ? templates.off : reason ? templates.onReason : templates.on;
    return template.replace("{name}", escapeHtml(name)).replace("{reason}", escapeHtml(reason ?? ""));
}

export default class AfkStatus {
    static #returning = null;

    static get(user = game.user) {
        return user?.getFlag(MODULE_ID, "afk") ?? null;
    }
    static #templates() {
        return {
            on: game.i18n.localize("MRKB.AfkOn"),
            onReason: game.i18n.localize("MRKB.AfkOnReason"),
            off: game.i18n.localize("MRKB.AfkOff")
        };
    }
    static #post(state) {
        return ChatMessage.create({
            speaker: { alias: game.user.name },
            content: afkText(game.user.name, state, this.#templates())
        }, { mrkbafk: true });
    }
    static async start(reason) {
        await game.user.setFlag(MODULE_ID, "afk", { since: Date.now(), reason });
        await this.#post({ afk: true, reason });
    }
    static async stop() {
        await this.#post({ afk: false });
        await game.user.unsetFlag(MODULE_ID, "afk");
    }
    // Called from the chatMessage hook with the typed text. Returns false when the line was consumed;
    // `resend` re-sends the original line once AFK has ended (so "no longer AFK" appears first).
    static handleChat(text, resend) {
        const result = afkAction({ isAfk: !!this.get(), text });
        if (!result) return undefined;
        if (result.action === "on") this.start(result.reason);
        else if (result.action === "off") this.stop();
        else {
            this.#returning ??= this.stop().finally(() => (this.#returning = null));
            this.#returning.then(resend);
        }
        return false;
    }
    // renderPlayers: prefix AFK users and give them Foundry's idle look.
    static decoratePlayers(html) {
        const root = html instanceof HTMLElement ? html : html?.[0];
        for (const row of root?.querySelectorAll("li.player[data-user-id]") ?? []) {
            const state = this.get(game.users.get(row.dataset.userId));
            row.classList.toggle("mrkb-afk", !!state);
            row.querySelector(".mrkb-afk-tag")?.remove();
            if (!state) continue;
            const tag = document.createElement("span");
            tag.className = "mrkb-afk-tag";
            tag.innerText = game.i18n.localize("MRKB.AfkTag");
            row.querySelector(".player-name")?.prepend(tag, " ");
            const time = new Date(state.since).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const note = state.reason
                ? game.i18n.format("MRKB.AfkTooltipReason", { time, reason: state.reason })
                : game.i18n.format("MRKB.AfkTooltip", { time });
            row.dataset.tooltipText = [row.dataset.tooltipText, note].filter(Boolean).join(" — ");
        }
    }
    static onUserUpdate(user, changes) {
        if (foundry.utils.hasProperty(changes, `flags.${MODULE_ID}.afk`) || foundry.utils.hasProperty(changes, `flags.${MODULE_ID}.-=afk`)) {
            ui.players?.render();
        }
    }
}
