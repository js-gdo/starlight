export type ProblemItem = {
    id: string;
    name?: string;
    title?: string;
    difficulty?: string;
};

export type ArticleTypeFilter = {
    type: 'all' | 'normal' | 'problem';
    problemId: string | null;
};

export function resolveArticleTypeFilter(url: URL): ArticleTypeFilter {
    const requestedType = (url.searchParams.get('type') ?? 'all').toLowerCase();
    const problemId = url.searchParams.get('id')?.trim() || null;

    if (requestedType === 'problem') {
        return { type: 'problem', problemId };
    }

    if (requestedType === 'normal') {
        return { type: 'normal', problemId: null };
    }

    return { type: 'all', problemId: null };
}

export function buildProblemArticleTitle(problemId: string, problemName: string, rawTitle: string): string {
    const cleanId = String(problemId ?? '').trim();
    const cleanName = String(problemName ?? '').trim();
    const inputTitle = String(rawTitle ?? '').trim();

    if (!cleanId || !cleanName) {
        return inputTitle;
    }

    const prefix = `[${cleanId} ${cleanName}]`;
    if (!inputTitle) {
        return prefix;
    }

    return inputTitle.startsWith(prefix) ? inputTitle : `${prefix} ${inputTitle}`;
}

export function buildProblemArticleContent(content: string, problemId: string): string {
    const cleanContent = String(content ?? '').trim();
    const cleanId = String(problemId ?? '').trim();
    const link = `题目链接：https://oj.lin114514.top/${cleanId}`;

    if (!cleanContent) {
        return link;
    }

    return `${cleanContent}\n\n> ${link}`;
}

export function normalizeProblemName(problemId: string, problemName: string): string {
    const cleanId = String(problemId ?? '').trim();
    const cleanName = String(problemName ?? '').trim();
    if (!cleanId || !cleanName) return cleanName;
    const escaped = cleanId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefixed = new RegExp(`^${escaped}\\s+`);
    return cleanName.replace(prefixed, '').trim();
}


export async function fetchProblemList(): Promise<ProblemItem[]> {
    try {
        const res = await fetch('https://oj.lin114514.top/api/v1/problem/list', {
            headers: { Accept: 'application/json' },
        });

        if (!res.ok) {
            return [];
        }

        const json = await res.json() as any;
        if (Array.isArray(json)) return json as ProblemItem[];
        if (Array.isArray(json.problems)) return json.problems as ProblemItem[];
        return [];
    } catch {
        return [];
    }
}
