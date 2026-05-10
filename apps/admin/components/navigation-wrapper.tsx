import { getMe } from '@/lib/api';
import { Navigation } from './navigation';

export async function NavigationWrapper() {
  let isSuperAdmin = false;
  try {
    const me = await getMe();
    isSuperAdmin = me.role === 'SUPER_ADMIN';
  } catch {
    // Not logged in — Navigation will hide itself on login page
  }

  return <Navigation isSuperAdmin={isSuperAdmin} />;
}
