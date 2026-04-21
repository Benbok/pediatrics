function assertCanDeleteVisit(sessionUser, visit) {
    if (!sessionUser?.id) {
        throw new Error('Unauthorized');
    }

    if (!visit) {
        throw new Error('Прием не найден');
    }

    const isAdmin = Boolean(sessionUser.roles?.includes('admin'));
    const isOwner = visit.doctorId === sessionUser.id;

    if (!isAdmin && !isOwner) {
        throw new Error('Недостаточно прав для удаления приема');
    }
}

module.exports = {
    assertCanDeleteVisit,
};