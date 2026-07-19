export function fitProfileSignature(
	signature: string | null | undefined,
	measureText: (text: string) => number,
	maxWidth: number
): string | null {
	const normalized = signature?.trim();
	if (!normalized) return null;
	if (measureText(normalized) <= maxWidth) return normalized;

	let truncated = normalized;
	while (truncated.length > 0 && measureText(`${truncated}…`) > maxWidth) {
		truncated = truncated.slice(0, -1);
	}
	return truncated ? `${truncated}…` : "…";
}
