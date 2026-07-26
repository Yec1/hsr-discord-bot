export interface RelicSubAffixEnhancementLike {
	count?: number | null;
	times?: number | null;
}

export function getRelicSubAffixEnhancementCount(
	subAffix: RelicSubAffixEnhancementLike
): number {
	const rawCount =
		subAffix.count !== undefined && subAffix.count !== null
			? Number(subAffix.count)
			: Number(subAffix.times ?? 0);
	if (!Number.isFinite(rawCount)) return 0;
	return Math.min(5, Math.max(0, Math.trunc(rawCount) - 1));
}
