export default class TurnNotice {
    // combatTurnChange: the active GM posts "<name>'s Turn" for the combatant whose turn it is now.
    static notice(combat) {
        if (game.users.activeGM?._id !== game.user._id) return;
        const combatant = combat.combatant;
        // Hidden combatants are GM-only; don't announce them to the table.
        if (!combatant || combatant.hidden) return;

        // From the combatant, not the canvas, so it also works with the canvas disabled.
        const token = combatant.token ?? game.canvas?.tokens?.get(combat.current?.tokenId)?.document;
        const name = token?.name ?? combatant.name;
        if (!name) return;

        ChatMessage.create({
            speaker : {
                scene : token?.parent?.id,
                token : token?.id,
                actor : combatant.actor?.id,
                alias : game.i18n.format("MRKB.TurnTitle", { name })
            }
        }, {mrkbturn : true});
    }
}
