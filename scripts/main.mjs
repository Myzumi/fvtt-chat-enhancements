import ChatHandler from "./chatHandler.mjs";
import ChatEditor from "./chatEditor.mjs";
import Setting from "./setting.mjs";
import ControlButtons from "./controlButtons.mjs";
import ActorControl from "./actorControl.mjs";
import ChatHotkey from "./chatHotkey.mjs";
import TurnNotice from "./turnNotice.mjs";
import SystemSpecific from "./systemSpecific.js";
import TypingAlert from "./typingAlert.mjs";
import RollFolding from "./rollFolding/state.mjs";
import RollFoldingRender from "./rollFolding/render.mjs";
import AfkStatus from "./afk.mjs";

Hooks.once("init", () => {
    //CONFIG.debug.hooks = true;
    Setting.register();
    if (game.system.id === "fatex") SystemSpecific.killFateXChatStyles();
});
Hooks.once("ready", () => {
    const chatLog = ui.chat.element.querySelector(".chat-log");
    const isColoredChat = game.settings.get("mrkb-chat-enhancements", "colored-chat");
    if (isColoredChat) chatLog.classList.remove("themed", "theme-light");
    TypingAlert.listen();
    RollFolding.applyContainerClass();
});
Hooks.on("renderAbstractSidebarTab", (tab) => {
    // The chat popout has id "chat-popout"; give its log the folding class too.
    if (tab.tabName === "chat") RollFolding.applyContainerClass();
    if (tab.id === "chat") {
        ActorControl.initialize();
        ChatEditor.initialize();
        ChatHotkey.initialize();
        ControlButtons.initialize();
        TypingAlert.initialize();

        const isColoredChat = game.settings.get("mrkb-chat-enhancements", "colored-chat");
        const isNewFont = game.settings.get("mrkb-chat-enhancements", "new-font");

        const chatLog = tab.element.querySelector(".chat-log");
        if (!chatLog) return;
        if (isColoredChat) chatLog.classList.add("color-applied");
        if (isNewFont) chatLog.classList.add("font-applied");
        chatLog.classList.toggle("mrkb-roll-folding", RollFolding.isActive());
    }
});
Hooks.on("renderPlayers", (app, html) => AfkStatus.decoratePlayers(html));
Hooks.on("updateUser", (user, changes) => AfkStatus.onUserUpdate(user, changes));
Hooks.on("renderSettingsConfig", (app, html) => RollFolding.decorateSettingsConfig(app, html));
Hooks.on("combatTurnChange", (combatData) => {
    TurnNotice.notice(combatData);
});
Hooks.on("chatMessage", (chatLog, message, sender) => ChatHandler.chatProcessor(chatLog, message, sender));
Hooks.on("preCreateChatMessage", (message, source, options, id) => ChatHandler.preProcesser(message, source, options, id));
Hooks.on("createChatMessage", (message, option, id) => {
    ChatHandler.createProcesser(message, option, id);
    RollFoldingRender.onRollChange(message, { created: true });
});
Hooks.on("updateChatMessage", (message) => RollFoldingRender.onRollChange(message));
Hooks.on("renderChatMessageHTML", (message, html, data) => {
    ChatHandler.renderProcesser(message, html, data);
    RollFoldingRender.render(message, html);
});
Hooks.on("dnd5e.renderChatMessage", (message, html) => RollFoldingRender.renderCard(message, html));
Hooks.on("deleteChatMessage", ChatHandler.fixChatFlag.bind(ChatHandler, false));
Hooks.on("deleteChatMessage", (message) => RollFoldingRender.onRollChange(message));
Hooks.on("getChatMessageContextOptions", (chatLog, options) => {
    const editOption = {
        name: game.i18n.localize("MRKB.Edit"),
        icon: '<i class="fa-solid fa-pen-to-square"></i>',
        condition: li => {
            const message = game.messages.get(li.dataset.messageId);
            return ((game.user.isGM || message.isAuthor) && !message.isRoll);
        },
        callback: li => ChatEditor._edit(li.dataset.messageId)
    }
    options.splice(3, 0, editOption);
});