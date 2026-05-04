/**
 * Proxy utility for routing fetch requests through a proxy server.
 *
 * Uses undici's ProxyAgent to intercept the global fetch dispatcher,
 * so that third-party code (e.g. @yeci226/hoyoapi loginByPassword)
 * that calls the native fetch will also go through the proxy.
 */

import { ProxyAgent, setGlobalDispatcher, getGlobalDispatcher } from "undici";
import type { Dispatcher } from "undici";

/**
 * Run `fn` with all global `fetch` calls routed through `proxyUrl`.
 * If `proxyUrl` is falsy, `fn` is called directly without any proxy.
 *
 * @example
 * const result = await withProxy(config.PROXY_URL, () => auth.loginByPassword(...));
 */
export async function withProxy<T>(
	proxyUrl: string | undefined | null,
	fn: () => Promise<T>
): Promise<T> {
	if (!proxyUrl) {
		return fn();
	}

	const originalDispatcher: Dispatcher = getGlobalDispatcher();
	const proxyAgent = new ProxyAgent(proxyUrl);

	try {
		setGlobalDispatcher(proxyAgent);
		return await fn();
	} finally {
		setGlobalDispatcher(originalDispatcher);
		await proxyAgent.close();
	}
}
