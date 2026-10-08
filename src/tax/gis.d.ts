// Google Identity Services（https://accounts.google.com/gsi/client）のうち、このページで使う分だけの型
declare namespace google.accounts.oauth2 {
  interface TokenResponse {
    access_token: string;
    expires_in: number;
    error?: string;
    error_description?: string;
  }
  interface TokenClient {
    requestAccessToken(overrides?: { prompt?: string }): void;
  }
  function initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type: string; message?: string }) => void;
  }): TokenClient;
  function revoke(token: string, done?: () => void): void;
}
