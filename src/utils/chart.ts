export type OnlineStatPoint = {
    value: number | null;
    legacy?: boolean;
};

export function getOnlineStatLineSegments(
    points: OnlineStatPoint[],
    predicate: (point: OnlineStatPoint) => boolean = (point) => point.value !== null && Number.isFinite(point.value)
) {
    const segments: Array<[number, number]> = [];
    let start: number | null = null;

    for (let index = 0; index < points.length; index++) {
        const point = points[index];
        if (predicate(point)) {
            if (start === null) {
                start = index;
            }
            continue;
        }

        if (start !== null) {
            const end = index - 1;
            segments.push(end === start ? [start] : [start, end]);
            start = null;
        }
    }

    if (start !== null) {
        const end = points.length - 1;
        segments.push(end === start ? [start] : [start, end]);
    }

    return segments;
}
