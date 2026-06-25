const USERNAME_KEY = "chat_username";

export function getStoredUsername(): string | null {
  return sessionStorage.getItem(USERNAME_KEY);
}

export function setStoredUsername(username: string): void {
  sessionStorage.setItem(USERNAME_KEY, username);
}

export function clearStoredUsername(): void {
  sessionStorage.removeItem(USERNAME_KEY);
}
