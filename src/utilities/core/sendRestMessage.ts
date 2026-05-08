import { loadConfig } from "@/utilities/core/config.js";

/**
 * Send a Discord message via REST API directly.
 * Does NOT use the discord.js client or IPC — safe to call during shard reconnects.
 */
export async function sendRestMessage(
	channelId: string,
	payload: { content?: string; embeds?: object[] },
	file?: { buffer: Buffer; name: string }
): Promise<void> {
	const token = loadConfig().TOKEN;
	const url = `https://discord.com/api/v10/channels/${channelId}/messages`;

	if (file) {
		const form = new FormData();
		const payloadJson: Record<string, unknown> = {};
		if (payload.content) payloadJson.content = payload.content;
		if (payload.embeds?.length) payloadJson.embeds = payload.embeds;
		form.append("payload_json", JSON.stringify(payloadJson));
		form.append("files[0]", new Blob([new Uint8Array(file.buffer)]), file.name);
		const res = await fetch(url, {
			method: "POST",
			headers: { Authorization: `Bot ${token}` },
			body: form
		});
		if (!res.ok) throw new Error(`REST ${res.status}: ${await res.text()}`);
	} else {
		const body: Record<string, unknown> = {};
		if (payload.content) body.content = payload.content;
		if (payload.embeds?.length) body.embeds = payload.embeds;
		const res = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bot ${token}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify(body)
		});
		if (!res.ok) throw new Error(`REST ${res.status}: ${await res.text()}`);
	}
}

/**
 * Send a Discord DM via REST API (create DM channel first, then send).
 * Does NOT use the discord.js client or IPC — safe to call during shard reconnects.
 */
export async function sendRestDm(
	userId: string,
	payload: { content?: string; embeds?: object[] },
	file?: { buffer: Buffer; name: string }
): Promise<void> {
	const token = loadConfig().TOKEN;
	// Step 1: Create DM channel
	const dmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
		method: "POST",
		headers: {
			Authorization: `Bot ${token}`,
			"Content-Type": "application/json"
		},
		body: JSON.stringify({ recipient_id: userId })
	});
	if (!dmRes.ok) throw new Error(`DM channel create ${dmRes.status}: ${await dmRes.text()}`);
	const dmChannel = (await dmRes.json()) as { id: string };
	// Step 2: Send message
	await sendRestMessage(dmChannel.id, payload, file);
}
