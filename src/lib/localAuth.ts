const LOCAL_USERS_KEY = 'servicoserick_local_users';
const LOCAL_SESSION_KEY = 'servicoserick_local_session';

export type LocalAuthUser = {
  id: string;
  email: string;
  password: string;
  createdAt: string;
};

export type LocalSession = {
  access_token: string;
  user: LocalAuthUser;
};

const readUsers = (): LocalAuthUser[] => {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeUsers = (users: LocalAuthUser[]) => {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
};

const generateId = () =>
  globalThis.crypto && 'randomUUID' in globalThis.crypto
    ? globalThis.crypto.randomUUID()
    : `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const getCurrentLocalUser = (): LocalAuthUser | null => {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as LocalSession;
    return session?.user ?? null;
  } catch {
    return null;
  }
};

export const getLocalSession = (): { data: { session: LocalSession | null } } => {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!raw) return { data: { session: null } };
    const session = JSON.parse(raw) as LocalSession;
    return { data: { session: session?.user ? session : null } };
  } catch {
    return { data: { session: null } };
  }
};

export const signUpLocal = async (email: string, password: string) => {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !password || password.length < 6) {
    throw new Error('A senha deve ter pelo menos 6 caracteres.');
  }

  const users = readUsers();
  const exists = users.some((user) => user.email.toLowerCase() === normalizedEmail);

  if (exists) {
    throw new Error('Este e-mail já está cadastrado.');
  }

  const user: LocalAuthUser = {
    id: generateId(),
    email: normalizedEmail,
    password,
    createdAt: new Date().toISOString(),
  };

  const nextUsers = [...users, user];
  writeUsers(nextUsers);

  const session: LocalSession = {
    access_token: `local-token-${user.id}`,
    user,
  };

  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));

  return { data: { user }, error: null };
};

export const signInLocal = async (email: string, password: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  const users = readUsers();
  const user = users.find(
    (item) => item.email.toLowerCase() === normalizedEmail && item.password === password
  );

  if (!user) {
    throw new Error('E-mail ou senha inválidos.');
  }

  const session: LocalSession = {
    access_token: `local-token-${user.id}`,
    user,
  };

  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));

  return { data: { user }, error: null };
};

export const signOutLocal = async () => {
  localStorage.removeItem(LOCAL_SESSION_KEY);
  return { error: null };
};

export const onLocalAuthStateChange = (callback: (event: string, session: LocalSession | null) => void) => {
  const emit = () => {
    const session = getLocalSession().data.session;
    callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
  };

  emit();

  return {
    data: {
      subscription: {
        unsubscribe: () => undefined,
      },
    },
  };
};
