function hasAdminRole(user) {
    return Boolean(user && Array.isArray(user.roles) && user.roles.includes('admin'));
}

function canViewUsersModule(user) {
    return Boolean(user && Number.isInteger(user.id));
}

function canEditUserProfile(actor, targetUserId) {
    if (!actor || !Number.isInteger(targetUserId)) return false;
    if (hasAdminRole(actor)) return true;
    return actor.id === targetUserId;
}

function canSetRoles(actor, targetUserId) {
    if (!actor || !Number.isInteger(targetUserId)) return false;
    if (hasAdminRole(actor)) return true;
    return actor.id === targetUserId;
}

function validateRolesAssignment(actor, targetUserId, roles) {
    if (!canSetRoles(actor, targetUserId)) {
        return { ok: false, error: 'Недостаточно прав для изменения ролей пользователя' };
    }

    if (!hasAdminRole(actor) && roles.includes('admin')) {
        return { ok: false, error: 'Нельзя назначить себе роль администратора' };
    }

    if (!roles.includes('doctor')) {
        return { ok: false, error: 'У пользователя должна оставаться роль врача' };
    }

    return { ok: true };
}

module.exports = {
    hasAdminRole,
    canViewUsersModule,
    canEditUserProfile,
    canSetRoles,
    validateRolesAssignment,
};
