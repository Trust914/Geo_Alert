
class TokenStorage {
  private accessToken: string | null = null;

  /**
   * Set access token in memory
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  /**
   * Get access token from memory
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Clear access token from memory
   */
  clearAccessToken(): void {
    this.accessToken = null;
  }

  /**
   * Check if user has valid access token
   */
  hasAccessToken(): boolean {
    return this.accessToken !== null && this.accessToken.length > 0;
  }

  /**
   * Clear all tokens (memory + trigger backend to clear cookies)
   */
  clearAll(): void {
    this.clearAccessToken();
    // Refresh token will be cleared by backend when logout endpoint is called
  }
}

// Export singleton instance
export const tokenStorage = new TokenStorage();