export interface GitHubConfig {
  token: string;
  org: string;
  repos: string[] | null; // null = discover from org
  apiBase: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getGitHubConfig(): GitHubConfig {
  const token = requireEnv("GITHUB_TOKEN");
  const org = requireEnv("GITHUB_ORG");

  const reposEnv = process.env.GITHUB_REPOS;
  const repos = reposEnv
    ? reposEnv.split(",").map((r) => r.trim()).filter(Boolean)
    : null;

  return {
    token,
    org,
    repos,
    apiBase: "https://api.github.com",
  };
}

export function isGitHubConfigured(): boolean {
  return !!process.env.GITHUB_TOKEN && !!process.env.GITHUB_ORG;
}
