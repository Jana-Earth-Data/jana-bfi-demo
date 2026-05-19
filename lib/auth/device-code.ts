const CLIENT_ID = "jana-sdk";

export type DeviceCodeResponse = {
  device_code: string;
  user_code?: string;
  verification_uri?: string;
  verification_uri_complete?: string;
  interval: number;
  expires_in?: number;
};

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
};

export type DeviceCodeError = {
  error: string;
  error_description?: string;
};

export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const res = await fetch("/api/auth/device-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Device code request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.data ?? data;
}

export async function pollForToken(
  deviceCode: string,
  interval: number,
  signal?: AbortSignal
): Promise<TokenResponse> {
  const pollInterval = Math.max(interval, 5) * 1000;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (signal?.aborted) throw new Error("Login cancelled.");

    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    if (signal?.aborted) throw new Error("Login cancelled.");

    const res = await fetch("/api/auth/device-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: deviceCode,
        client_id: CLIENT_ID,
      }),
      signal,
    });

    if (res.ok) {
      const data = await res.json();
      const unwrapped = data.data ?? data;
      if (unwrapped.access_token) return unwrapped as TokenResponse;
    }

    let body: Record<string, unknown> = {};
    try {
      body = await res.json();
    } catch {
      /* non-JSON response */
    }
    const unwrappedErr = (body.data as DeviceCodeError) ?? body;
    const error = (unwrappedErr as DeviceCodeError).error;

    if (error === "authorization_pending") continue;
    if (error === "slow_down") {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      continue;
    }

    throw new Error(
      (unwrappedErr as DeviceCodeError).error_description ??
        error ??
        `Token poll failed (${res.status})`
    );
  }
}
