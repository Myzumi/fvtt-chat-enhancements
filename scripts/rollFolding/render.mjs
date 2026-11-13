import RollFolding from "./state.mjs";
import { foldTarget, slotsForCard, rollTotal, messageAfter, slotLabel } from "./decide.mjs";

export const ROLL_ACTIONS = ["rollAttack", "rollDamage", "rollHealing", "rollFormula"];

const warn = (err) => console.warn("mrkb-chat-enhancements | roll folding", err);

export default class RollFoldingRender {
    // Rolls whose slot could not be built this session; they are shown as normal messages (fail open).
    static #failed = new Set();
    // Visible-message list shared by all renders until the chat collection changes.
    static #visible = null;

    static visibleMessages() {
        if (this.#visible?.size !== game.messages.size) {
            this.#visible = { size: game.messages.size, list: game.messages.contents.filter((m) => m.visible) };
        }
        return this.#visible.list;
    }
    static invalidate() {
        this.#visible = null;
    }
    static cardActions(card) {
        const actions = (card?.system?.buttons ?? []).map((b) => b.action).filter((a) => ROLL_ACTIONS.includes(a));
        return new Set(actions);
    }
    static #options() {
        const summaries = game.settings.settings.has("dnd5e.chatCardSummary") && game.settings.get("dnd5e", "chatCardSummary");
        return {
            // Blind/private rolls: Foundry marks every roll `visible`, but only some viewers may see the result.
            canFold: (m) => m.isContentVisible !== false && !this.#failed.has(m.id),
            // Saves/checks dnd5e already shows as summaries inside the card do not interrupt the card's rolls.
            isTransparent: (m) => !!(summaries && m.system?.summaryTemplate && m.system?.origin?.system?.rendersSummaries)
        };
    }
    static isFoldedAway(message, visible = this.visibleMessages()) {
        if (!RollFolding.isActive()) return false;
        return !!foldTarget(message, visible, (card) => this.cardActions(card), this.#options());
    }
    // Re-render the card when one of its rolls is created, updated or deleted, and release a deleted
    // card's rolls back into the log as normal messages.
    static onRollChange(message, { created = false } = {}) {
        try {
            this.invalidate();
            if (!RollFolding.isActive() || !ui.chat?.rendered) return;
            const card = message.system?.origin;
            if (card?.type === "usage" && card !== message && game.messages.has(card.id)) {
                ui.chat.updateMessage(card).then(() => {
                    // The folded roll itself is hidden, so pop the card into the notification overlay instead
                    // (only if it is not already there; an existing overlay copy is re-rendered by updateMessage).
                    const inOverlay = document.querySelector(`#chat-notifications .message[data-message-id="${card.id}"]`);
                    if (created && !inOverlay && this.isFoldedAway(message)) ui.chat.notify(card, { newMessage: true });
                }).catch(warn);
            }
            if (message.type === "usage" && !game.messages.has(message.id)) {
                for (const roll of game.messages) {
                    if (roll._source?.system?.origin === message.id) ui.chat.updateMessage(roll);
                }
            }
            // A deleted message, or one that became visible/hidden, can change whether the roll after it folds.
            if (!created) {
                const next = messageAfter(this.visibleMessages(), message);
                const nextCard = next?.system?.origin;
                if (nextCard?.type === "usage" && nextCard !== card && game.messages.has(nextCard.id)) {
                    ui.chat.updateMessage(next);
                    ui.chat.updateMessage(nextCard);
                }
            }
        } catch (err) {
            warn(err);
        }
    }
    // renderChatMessageHTML: hide rolls that fold into their card.
    static render(message, html) {
        try {
            // Hide via class, not `hidden`: Foundry copies the old element's `hidden` onto re-renders
            // after this hook runs, which would keep rolls hidden (or visible) across mode changes.
            if (this.isFoldedAway(message)) html.classList.add("mrkb-folded");
        } catch (err) {
            warn(err);
        }
    }
    // dnd5e.renderChatMessage: fires after dnd5e has rendered the card body, so the buttons exist.
    static renderCard(message, html) {
        try {
            if (!RollFolding.isActive() || message.type !== "usage") return;
            const slots = slotsForCard(message, this.visibleMessages(), this.cardActions(message), this.#options());
            if (slots.size) this.#fillCard(html, slots, message).catch(warn);
        } catch (err) {
            warn(err);
        }
    }
    static async #fillCard(html, slots, cardMessage) {
        // Remember whether the log was scrolled to the bottom; the card grows after it is inserted.
        const stick = { main: !!ui.chat?.isAtBottom, popout: !!ui.chat?.popout?.isAtBottom };
        let looseSlots = null;
        for (const action of ROLL_ACTIONS) {
            const slot = slots.get(action);
            if (!slot) continue;
            let element = null;
            try {
                element = await this.#buildSlot(action, slot);
            } catch (err) {
                warn(err);
            }
            if (!element) {
                this.#release(slot.latest);
                continue;
            }
            const source = html.querySelector(`button[data-action="${action}"]`);
            if (source) {
                source.classList.add("mrkb-slot-source");
                source.after(element);
                element.querySelector(".mrkb-reroll")?.addEventListener("click", (event) => this.#reroll(event, source));
            } else {
                // Viewers who may not roll (dnd5e "creator" buttons) still see the results.
                element.querySelector(".mrkb-reroll")?.remove();
                if (!looseSlots) {
                    looseSlots = document.createElement("div");
                    looseSlots.className = "mrkb-roll-slots";
                    (html.querySelector(".chat-card") ?? html.querySelector(".message-content"))?.append(looseSlots);
                }
                looseSlots.append(element);
            }
            this.#restoreTrays(cardMessage, element);
        }
        const log = html.closest(".chat-log");
        if (stick.popout && ui.chat?.popout?.element?.contains(log)) ui.chat.popout.scrollBottom();
        else if (stick.main && ui.chat?.element?.contains(log)) ui.chat.scrollBottom();
    }
    // dnd5e saves the card's tray states before a re-render (message._trayStates) and applies them in its own
    // render; slot trays are added later, so apply the saved state to them once they are built.
    static #restoreTrays(cardMessage, element) {
        if (!cardMessage?._trayStates || typeof cardMessage._collapseTrays !== "function") return;
        const apply = () => cardMessage._collapseTrays(element);
        if (element.isConnected) apply();
        else requestAnimationFrame(apply);
    }
    // Fail open: a roll whose result could not be shown in the card becomes a normal message again.
    static #release(message) {
        if (this.#failed.has(message.id)) return;
        this.#failed.add(message.id);
        ui.chat?.updateMessage(message);
    }
    static async #buildSlot(action, { latest, earlier }) {
        const rendered = await latest.renderHTML();
        const content = rendered.querySelector(".message-content");
        const result = content?.querySelector(":scope > section.icon-row:has(.dice-roll)")
            ?? content?.querySelector(".dice-roll");
        if (!result) return null;

        const slot = document.createElement("div");
        slot.className = "mrkb-roll-slot";
        slot.dataset.messageId = latest.id;
        slot.dataset.action = action;

        const label = slotLabel(action);
        if (label) {
            const title = document.createElement("div");
            title.className = "mrkb-slot-label";
            title.innerHTML = `<i class="fa-solid ${label.icon}" inert></i>`;
            title.append(" ", game.i18n.localize(label.key));
            slot.append(title);
        }
        slot.append(result.cloneNode(true));

        const reroll = document.createElement("button");
        reroll.type = "button";
        reroll.className = "mrkb-reroll";
        reroll.dataset.tooltip = game.i18n.localize("MRKB.Reroll");
        reroll.ariaLabel = reroll.dataset.tooltip;
        reroll.innerHTML = `<i class="fa-solid fa-rotate-right" inert></i>`;
        slot.append(reroll);

        if (earlier.length) {
            const count = document.createElement("span");
            count.className = "mrkb-reroll-count";
            count.innerText = `↻${earlier.length}`;
            const totals = earlier.map((m) => rollTotal(m) ?? "?").join(", ");
            count.dataset.tooltip = game.i18n.format("MRKB.RerollEarlier", { totals });
            slot.append(count);
        }
        // Hit/miss against targets (attack rolls).
        for (const targets of content.querySelectorAll(":scope > section.icon-row:has(ul.targets)")) {
            const row = targets.cloneNode(true);
            row.classList.add("mrkb-slot-targets");
            slot.append(row);
        }
        // Only where dnd5e itself offers the Apply tray (GM or allowed players, not private rolls).
        if (content.querySelector("damage-application")) {
            const tray = document.createElement("damage-application");
            tray.className = "dnd5e2";
            slot.append(tray);
        }
        // dnd5e wires the result button to its breakdown popover after rendering; do the same for the copy.
        if (typeof latest.system?._onRender === "function") latest.system._onRender(slot);
        else for (const popover of slot.querySelectorAll(".roll-breakdown[popover]")) popover.previousElementSibling.popoverTargetElement = popover;
        return slot;
    }
    static #reroll(event, source) {
        event.preventDefault();
        event.stopPropagation();
        const { shiftKey, altKey, ctrlKey, metaKey } = event;
        source.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey, altKey, ctrlKey, metaKey }));
    }
}
