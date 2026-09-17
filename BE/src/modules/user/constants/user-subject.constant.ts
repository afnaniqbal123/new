/**
 * The subject name for user records in authorization rules.
 *
 * Declared by the module that owns the data, not by the authorization module.
 * If every subject name lived there, adding a feature would mean editing the
 * authorization module — the coupling CASL is being adopted to remove.
 */
export const USER_SUBJECT = 'User';
