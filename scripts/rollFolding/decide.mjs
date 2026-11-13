// Pure decision logic for folding dnd5e roll messages into their item card.
// No Foundry globals: messages are passed in, so this can be tested in Node.

const MODES = ["players", "on", "off"];

export function isFoldingSupported({ generation, systemId, systemVersion }) {
    return generation >= 14 && systemId === "dnd5e" && parseInt(systemVersion) >= 6;
}

export function effectiveFolding({ supported, worldMode, clientToggle }) {
    if (!supported) return false;
    const mode = MODES.includes(worldMode) ? worldMode : "players";
    if (mode === "on") return true;
    if (mode === "off") return false;
    return !!clientToggle;
}

export function actionForRoll(rollType, cardActions) {
    let action = null;
    if (rollType === "attack") action = "rollAttack";
    else if (rollType === "damage") action = cardActions.has("rollDamage") || !cardActions.has("rollHealing") ? "rollDamage" : "rollHealing";
    else if (rollType === "healing") action = "rollHealing";
    else if (rollType === "generic") action = "rollFormula";
    return action && cardActions.has(action) ? action : null;
}

const originCard = (message) => {
    const origin = message?.system?.origin;
    return origin && origin !== message && origin.type === "usage" ? origin : null;
};

// Options shared by foldTarget and slotsForCard:
// - canFold(message): false for rolls whose result this viewer may not see (blind/private); they never fold
//   and, being visible as a placeholder, break the chain.
// - isTransparent(message): true for same-card messages dnd5e already summarises inside the card (saves);
//   they are skipped when walking the chain.
const DEFAULTS = { canFold: () => true, isTransparent: () => false };

const folds = (message, card, cardActions, { canFold }) =>
    originCard(message) === card && canFold(message) && !!actionForRoll(message.type, cardActions);

// The card a roll folds into, or null. A roll folds when the message directly before it
// (among the messages this viewer can see, skipping transparent ones) is its card,
// or another roll folded into that card.
export function foldTarget(message, visibleMessages, cardActionsOf, options = {}) {
    const opts = { ...DEFAULTS, ...options };
    const card = originCard(message);
    if (!card || !folds(message, card, cardActionsOf(card), opts)) return null;
    for (let i = visibleMessages.indexOf(message) - 1; i >= 0; i--) {
        const prev = visibleMessages[i];
        if (prev === card) return card;
        if (originCard(prev) !== card) return null;
        if (opts.isTransparent(prev)) continue;
        if (!folds(prev, card, cardActionsOf(card), opts)) return null;
    }
    return null;
}

// For each card button action, the newest folded roll and the earlier ones (oldest first).
export function slotsForCard(card, visibleMessages, cardActions, options = {}) {
    const opts = { ...DEFAULTS, ...options };
    const slots = new Map();
    const start = visibleMessages.indexOf(card);
    if (start < 0) return slots;
    for (let i = start + 1; i < visibleMessages.length; i++) {
        const message = visibleMessages[i];
        if (originCard(message) !== card) break;
        if (opts.isTransparent(message)) continue;
        if (!folds(message, card, cardActions, opts)) break;
        const action = actionForRoll(message.type, cardActions);
        const slot = slots.get(action);
        if (slot) {
            slot.earlier.push(slot.latest);
            slot.latest = message;
        } else slots.set(action, { latest: message, earlier: [] });
    }
    return slots;
}

// Displayed total of a roll message: dnd5e shows damage/healing as the sum of its parts (never below 0 each).
export function rollTotal(message) {
    const rolls = message?.rolls ?? [];
    if (!rolls.length) return null;
    if (message.type === "damage" || message.type === "healing") return rolls.reduce((sum, r) => sum + Math.max(0, r.total), 0);
    return rolls[0].total;
}

// The visible message directly after `message`. Works for messages no longer in the list
// (deleted, or just hidden from this viewer) by falling back to their timestamp.
export function messageAfter(visibleMessages, message) {
    const index = visibleMessages.indexOf(message);
    if (index >= 0) return visibleMessages[index + 1] ?? null;
    return visibleMessages.find((m) => m !== message && m.timestamp > message.timestamp) ?? null;
}

// Small title shown above each folded result, so it is clear which roll is which.
const SLOT_LABELS = {
    rollAttack: { key: "MRKB.RollLabelAttack", icon: "fa-sword" },
    rollDamage: { key: "MRKB.RollLabelDamage", icon: "fa-burst" },
    rollHealing: { key: "MRKB.RollLabelHealing", icon: "fa-heart" },
    rollFormula: { key: "MRKB.RollLabelFormula", icon: "fa-dice" }
};
export function slotLabel(action) {
    return SLOT_LABELS[action] ? { ...SLOT_LABELS[action] } : null;
}
