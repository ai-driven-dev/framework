export interface AuthContext {
  token: string;
  method: "gh" | "token";
  level: "user" | "project";
}

export interface AuthTokenProvider {
  resolve(): Promise<string | null>;
  resolveContext(projectRoot: string): Promise<AuthContext | null>;
}
