import { api, unwrap } from '@/shared/api/client';
import { useSession } from '@/shared/auth/session';

export async function login(username: string, password: string) {
  const isPhone = /^\+?\d{10,14}$/.test(username.trim());
  const r = await unwrap(
    api.POST('/auth/login', { body: { ...(isPhone ? { phone: username.trim() } : { username: username.trim() }), password, client: 'web' }, credentials: 'include' }),
  );
  useSession.getState().setFromLogin(r);
  return r;
}

export async function logout() {
  try {
    await api.POST('/auth/logout', {});
  } finally {
    useSession.getState().clear();
  }
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await unwrap(api.POST('/auth/password/change', { body: { currentPassword, newPassword } }));
  const me = await unwrap(api.GET('/auth/me'));
  useSession.getState().setMe(me);
}
