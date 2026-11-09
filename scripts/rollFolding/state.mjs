import { isFoldingSupported, effectiveFolding } from "./decide.mjs";

const MODULE_ID = "mrkb-chat-enhancements";

export default class RollFolding {
    static isSupported() {
        return isFoldingSupported({
            generation: game.release?.generation,
            systemId: game.system?.id,
            systemVersion: game.system?.version
        });
    }
    static isActive() {
        try {
            return effectiveFolding({
                supported: this.isSupported(),
                worldMode: game.settings.get(MODULE_ID, "roll-folding-mode"),
                clientToggle: game.settings.get(MODULE_ID, "roll-folding")
            });
        } catch (err) {
            return false;
        }
    }
    static applyContainerClass() {
        const active = this.isActive();
        document.querySelectorAll(".chat-log").forEach((log) => log.classList.toggle("mrkb-roll-folding", active));
    }
    static onSettingChange() {
        this.applyContainerClass();
        // Re-render every logged message so cards and rolls pick up the new mode without a reload.
        for (const message of game.messages ?? []) {
            if (message.logged) ui.chat?.updateMessage(message);
        }
    }
    static decorateSettingsConfig(app, html) {
        const root = html instanceof HTMLElement ? html : html?.[0];
        if (!root) return;
        const client = root.querySelector(`[name="${MODULE_ID}.roll-folding"]`);
        const world = root.querySelector(`[name="${MODULE_ID}.roll-folding-mode"]`);
        const note = (input, key) => {
            if (!input) return;
            input.closest(".form-group")?.querySelector(".mrkb-roll-folding-note")?.remove();
            input.disabled = !!key;
            if (!key) return;
            const hint = document.createElement("p");
            hint.className = "hint mrkb-roll-folding-note";
            hint.innerText = game.i18n.localize(key);
            input.closest(".form-group")?.append(hint);
        };
        if (!this.isSupported()) {
            note(client, "MRKB.RollFoldingUnsupported");
            note(world, "MRKB.RollFoldingUnsupported");
            return;
        }
        // Follow the GM's choice in the open window, before it is saved.
        const sync = (mode) => note(client, mode !== "players" ? "MRKB.RollFoldingForced" : null);
        sync(game.settings.get(MODULE_ID, "roll-folding-mode"));
        world?.addEventListener("change", () => sync(world.value));
    }
}
