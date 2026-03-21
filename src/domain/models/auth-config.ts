export interface AuthConfig {
  version: 1;
  method: "gh" | "token";
  level: "user" | "project";
  token?: string;
  createdAt: string;
}
