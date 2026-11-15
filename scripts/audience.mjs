// True when two messages are seen by the same people: both public, or whispered to the same recipients.
export function sameAudience(a, b) {
    const ids = (m) => new Set((m?.whisper ?? []).map((u) => u?.id ?? u));
    const x = ids(a);
    const y = ids(b);
    if (x.size !== y.size) return false;
    for (const id of x) if (!y.has(id)) return false;
    return !!a?.blind === !!b?.blind;
}
