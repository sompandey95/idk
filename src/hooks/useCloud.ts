import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { PLAYER_EVENT } from "../services/player";

export function useCloud() {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<
    "local" | "syncing" | "connected" | "error"
  >("local");
  const [online, setOnline] = useState(navigator.onLine);
  const userRef = useRef(user);
  userRef.current = user;
  const retryAt = useRef(0);
  const failures = useRef(0);
  const sync = useCallback(async () => {
    if (!navigator.onLine || !userRef.current) return;
    setStatus("syncing");
    try {
      await (await import("../services/firebase")).syncProgress();
      failures.current = 0;
      retryAt.current = Date.now() + 30000;
      setStatus("connected");
    } catch {
      failures.current++;
      retryAt.current =
        Date.now() + Math.min(300000, 10000 * 2 ** failures.current);
      setStatus("error");
    }
  }, []);
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let alive = true;
    import("../services/firebase")
      .then((service) => {
        if (!alive) return;
        unsubscribe = service.observeAccount((account) => {
          userRef.current = account;
          setUser(account);
          if (account) void sync();
        });
      })
      .catch(() => {
        if (alive) setStatus("error");
      });
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [sync]);
  useEffect(() => {
    const connected = () => {
      setOnline(true);
      retryAt.current = 0;
      void sync();
    };
    const disconnected = () => setOnline(false);
    const changes = () => {
      /* A periodic flush coalesces progress writes and avoids save-triggered loops. */
    };
    const timer = window.setInterval(() => {
      if (Date.now() >= retryAt.current) void sync();
    }, 10000);
    window.addEventListener("online", connected);
    window.addEventListener("offline", disconnected);
    window.addEventListener(PLAYER_EVENT, changes);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", connected);
      window.removeEventListener("offline", disconnected);
      window.removeEventListener(PLAYER_EVENT, changes);
    };
  }, [sync]);
  const connect = useCallback(async () => {
    setStatus("syncing");
    try {
      const account = await (
        await import("../services/firebase")
      ).connectAccount();
      userRef.current = account;
      setUser(account);
      await sync();
    } catch {
      setStatus("error");
    }
  }, [sync]);
  return { user, status, online, connect, sync };
}
export type CloudState = ReturnType<typeof useCloud>;
