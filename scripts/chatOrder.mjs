// Neighbours of a message as the chat log shows them: ordered by timestamp, ties by collection order.
// `messages` is the full list (collection order), `visible` decides which ones this viewer sees.
function before(a, ia, b, ib) {
    return a.timestamp < b.timestamp || (a.timestamp === b.timestamp && ia < ib);
}

export function previousShown(messages, message, visible = (m) => m.visible) {
    const self = messages.indexOf(message);
    let prev = null, prevIndex = -1;
    messages.forEach((m, i) => {
        if (m === message || !visible(m)) return;
        if (before(m, i, message, self) && (!prev || before(prev, prevIndex, m, i))) {
            prev = m;
            prevIndex = i;
        }
    });
    return prev;
}

export function nextShown(messages, message, visible = (m) => m.visible) {
    const self = messages.indexOf(message);
    let next = null, nextIndex = -1;
    messages.forEach((m, i) => {
        if (m === message || !visible(m)) return;
        if (before(message, self, m, i) && (!next || before(m, i, next, nextIndex))) {
            next = m;
            nextIndex = i;
        }
    });
    return next;
}
