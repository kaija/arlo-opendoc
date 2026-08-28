import type { OAuthToken, ForgeRepo } from "@kb/shared";

export interface WebhookConfig {
  url: string;
  events: string[];
  secret: string;
}

export interface WebhookRecord {
  id: string;
  url: string;
  active: boolean;
}

export interface ForgeAdapter {
  /**
   * Exchange an OAuth authorization code for an access token.
   * No GitHub API endpoint URLs appear in this signature.
   */
  exchangeOAuthCode(code: string, state: string): Promise<OAuthToken>;

  /**
   * Create a new repository in the authenticated user's account.
   */
  createRepository(name: string, options: { private: boolean; description?: string }): Promise<ForgeRepo>;

  /**
   * Register a webhook on the specified repository.
   */
  registerWebhook(repo: ForgeRepo, config: WebhookConfig): Promise<WebhookRecord>;
}
