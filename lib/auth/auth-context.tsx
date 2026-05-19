"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  requestDeviceCode,
  pollForToken,
  type DeviceCodeResponse,
} from "./device-code";

type AuthState =
  | { status: "unauthenticated" }
  | { status: "pending"; deviceCode: DeviceCodeResponse }
  | { status: "authenticated"; accessToken: string; refreshToken?: string };

type AuthContextValue = {
  auth: AuthState;
  accessToken: string | null;
  startLogin: () => Promise<void>;
  cancelLogin: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ status: "unauthenticated" });
  const abortRef = useRef<AbortController | null>(null);

  const cancelLogin = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setAuth({ status: "unauthenticated" });
  }, []);

  const startLogin = useCallback(async () => {
    cancelLogin();

    const dc = await requestDeviceCode();
    setAuth({ status: "pending", deviceCode: dc });

    const url = dc.verification_uri_complete ?? dc.verification_uri;
    if (url) window.open(url, "_blank", "noopener");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const tokens = await pollForToken(
        dc.device_code,
        dc.interval,
        controller.signal
      );
      setAuth({
        status: "authenticated",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      });
    } catch (err) {
      if ((err as Error).message !== "Login cancelled.") {
        console.error("Device code login failed:", err);
      }
      setAuth((prev) =>
        prev.status === "pending" ? { status: "unauthenticated" } : prev
      );
    }
  }, [cancelLogin]);

  const logout = useCallback(() => {
    cancelLogin();
    setAuth({ status: "unauthenticated" });
  }, [cancelLogin]);

  const accessToken =
    auth.status === "authenticated" ? auth.accessToken : null;

  return (
    <AuthContext.Provider
      value={{ auth, accessToken, startLogin, cancelLogin, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
