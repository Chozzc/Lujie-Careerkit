type GitHubRepoResponse = {
  name: string;
  full_name: string;
  stargazers_count: number;
  language: string | null;
  description: string | null;
};

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url")?.trim();
  const repo = parseGitHubRepo(url);

  if (!repo) {
    return Response.json({ message: "请填写有效的 GitHub 仓库链接，例如 https://github.com/vercel/next.js。" }, { status: 400 });
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "LuJie-CareerKit",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      next: { revalidate: 300 },
    });

    if (response.status === 404) {
      return Response.json({ message: "没有找到这个 GitHub 仓库，请检查链接或仓库是否公开。" }, { status: 404 });
    }

    if (!response.ok) {
      return Response.json({ message: "GitHub 仓库信息读取失败，请稍后重试。" }, { status: response.status });
    }

    const data = (await response.json()) as GitHubRepoResponse;
    return Response.json({
      name: data.full_name || data.name,
      stars: data.stargazers_count,
      language: data.language ?? "",
      description: data.description ?? "",
    });
  } catch {
    return Response.json({ message: "无法连接 GitHub，请检查网络后重试。" }, { status: 502 });
  }
}

function parseGitHubRepo(rawUrl: string | null | undefined) {
  if (!rawUrl) return null;
  const normalized = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;

  try {
    const url = new URL(normalized);
    if (url.hostname.toLowerCase() !== "github.com") return null;

    const [owner, rawName] = url.pathname.split("/").filter(Boolean);
    const name = rawName?.replace(/\.git$/, "");
    if (!owner || !name) return null;

    return { owner, name };
  } catch {
    return null;
  }
}
