interface CollectorLike<T> {
	on(
		event: "collect",
		listener: (interaction: T) => void | Promise<void>
	): unknown;
	on(event: "end", listener: () => void | Promise<void>): unknown;
}

export function registerPersistentWarpMenuCollector<T>(
	collector: CollectorLike<T>,
	onCollect: (interaction: T) => void | Promise<void>,
	onEnd?: () => void | Promise<void>
): void {
	collector.on("collect", onCollect);
	if (onEnd) collector.on("end", onEnd);
}
