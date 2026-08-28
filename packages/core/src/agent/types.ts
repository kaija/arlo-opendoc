export interface AgentKeyProvider {
  /**
   * Returns the API key to use for the Claude Agent SDK.
   * May be async — the key might be fetched from a keychain, env var (server),
   * or user-supplied settings (desktop).
   */
  getApiKey(): Promise<string>;
}
