export type ProblemOption = {
    id: string;
    name?: string;
    title?: string;
    difficulty?: string;
};

export function buildProblemArticleTitle(rawTitle: string, problem: ProblemOption): string {
    const prefix = `[${problem.id} ${problem.title || problem.name || 'Problem'}]`;
    const trimmed = (rawTitle ?? '').trim();
    if (!trimmed) return prefix;
    if (trimmed.startsWith(prefix)) return trimmed;
    return `${prefix} ${trimmed}`;
}

export function buildProblemArticleContent(rawContent: string, problemId: string): string {
    const content = (rawContent ?? '').trim();
    const problemUrl = `https://oj.lin114514.top/${problemId}`;
    const fallback = content ? `${content}\n\n${problemUrl}` : problemUrl;
    if (!content) return problemUrl;
    if (content.includes(problemUrl)) return content;
    return fallback;
}

export async function fetchProblemList(): Promise<ProblemOption[]> {
    try {
        const resp = await fetch('https://oj.lin114514.top/api/v1/problem/list', {
            headers: { 'Accept': 'application/json' },
        });
        if (!resp.ok) return [];
        const data = await resp.json() as { problems?: ProblemOption[] };
        const problems = Array.isArray(data?.problems) ? data.problems : [];
        return problems.filter((problem) => !!problem && typeof problem.id !== 'undefined');
    } catch {
        return [];
    }
}
