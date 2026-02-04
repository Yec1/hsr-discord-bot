import { WebSocket } from "ws";
import { EventEmitter } from "node:events";
import { ClusterClient } from "discord-hybrid-sharding";
import Logger from "./logger.js";
import { getConfig } from "./config.js";

export class VerificationServer {
	private static ws: WebSocket | null = null;
	private static logger = new Logger("VerifyHubClient");
	private static config = getConfig();
	private static cluster: ClusterClient | null = null;

	private static events = new EventEmitter();
	private static pendingRegistrations = new Set<string>();

	constructor(cluster?: ClusterClient) {
		if (cluster) {
			VerificationServer.cluster = cluster;
		}
	}

	public static onResult(sessionId: string, callback: (result: any) => void) {
		this.registerSession(sessionId);
		this.events.once(`result:${sessionId}`, callback);
	}

	public static registerSession(sessionId: string) {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify({ type: "register", sessionId }));
		} else {
			this.pendingRegistrations.add(sessionId);
		}

		// Timeout registration cleanup
		setTimeout(
			() => this.pendingRegistrations.delete(sessionId),
			15 * 60 * 1000
		);
	}

	public start() {
		this.connect();
	}

	private connect() {
		// As the Master Hub, we connect to ourselves
		const hubUrl =
			(VerificationServer.config as any).VERIFY_HUB_URL ||
			`ws://localhost:${VerificationServer.config.WEBSERVER_PORT || 3000}`;

		VerificationServer.ws = new WebSocket(hubUrl);

		VerificationServer.ws.on("open", () => {
			VerificationServer.logger.success(
				`Connected to Verification Hub: ${hubUrl}`
			);

			// Flush pending registrations
			for (const sid of VerificationServer.pendingRegistrations) {
				VerificationServer.ws?.send(
					JSON.stringify({ type: "register", sessionId: sid })
				);
			}
			VerificationServer.pendingRegistrations.clear();
		});

		VerificationServer.ws.on("message", data => {
			try {
				const message = JSON.parse(data.toString());
				if (message.type === "result") {
					VerificationServer.events.emit(
						`result:${message.sessionId}`,
						message.result
					);
				}
			} catch (e) {
				// Ignore
			}
		});

		VerificationServer.ws.on("close", () => {
			VerificationServer.logger.warn(
				"Disconnected from Hub. Reconnecting in 5s..."
			);
			setTimeout(() => this.connect(), 5000);
		});

		VerificationServer.ws.on("error", err => {
			// Don't log error if it's just during startup and hub isn't ready yet
			// VerificationServer.logger.error(`WebSocket Error: ${err.message}`);
		});
	}

	public stop() {
		if (VerificationServer.ws) {
			VerificationServer.ws.close();
		}
	}
}

(global as any).VerificationServerClass = VerificationServer;
