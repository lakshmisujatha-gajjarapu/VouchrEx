import { Redirect } from 'expo-router';

import { LoadingScreen } from '@/components/loading-screen';
import { useAuth } from '@/hooks/use-auth';

export default function IndexScreen() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <LoadingScreen label="Unlocking your vault..." />;
  }

  return <Redirect href={status === 'signedIn' ? '/(tabs)/shop' : '/sign-in'} />;
}
