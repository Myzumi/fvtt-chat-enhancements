const getPortrait = (id, userId) => {
    const avatar = game.users.get(userId)?.avatar ?? CONST.DEFAULT_TOKEN;
    return game.actors.get(id)?.img ?? avatar;
}

export default getPortrait;
