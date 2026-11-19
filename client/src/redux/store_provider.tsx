'use client';

import { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { makeStore, AppStore } from './store';
import { setStoreRef } from './store.reference';
import { AuthService } from '@/services/auth.service';
import {
  finishAuthCheckUnauthenticated,
  setSession,
} from './slice/auth.slice';
import { toast } from 'sonner';

export default function StoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [store] = useState<AppStore>(() => makeStore());

  useEffect(() => {
    setStoreRef(store);
    let active = true;

    AuthService.refresh()
      .then((session) => {
        if (!active) return;
        if (session) {
          store.dispatch(setSession({
            accessToken: session.access_token,
            user: session.user,
          }));
        } else {
          store.dispatch(finishAuthCheckUnauthenticated());
        }
      })
      .catch(() => {
        if (!active) return;
        store.dispatch(finishAuthCheckUnauthenticated());
        toast.error("Unable to verify your saved login session.");
      });

    return () => {
      active = false;
    };
  }, [store]);

  return <Provider store={store}>{children}</Provider>;
}
