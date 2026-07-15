import axios from "axios";
import type { Interaction } from "discord.js";
import { database } from "@/index.js";

export interface PlayerDataResponse {
	status: number;
	playerData: any;
}

export interface PlayerActivityResponse {
	status: number;
	playerActivity: any;
}

function languageParam(interaction?: Interaction): Promise<string> {
	const userId = interaction?.user?.id;
	if (!userId) {
		return Promise.resolve(
			interaction && "locale" in interaction && interaction.locale === "zh-TW"
				? "?lang=cht"
				: "?lang=en"
		);
	}

	return (async () => {
		const key = `${userId}.locale`;
		if (await database.has(key)) {
			return (await database.get(key)) === "tw" ? "?lang=cht" : "?lang=en";
		}
		return interaction && "locale" in interaction && interaction.locale === "zh-TW"
			? "?lang=cht"
			: "?lang=en";
	})();
}

export async function requestPlayerDataEnka(
	uid: string
): Promise<PlayerDataResponse> {
	try {
		const response = await axios.get(`https://enka.network/api/hsr/uid/${uid}`);
		console.log(response.data);
		return { status: response.status, playerData: response.data };
	} catch (error: any) {
		return {
			status: 400,
			playerData: {
				detail: error.response?.data?.detail,
				message: error.message
			}
		};
	}
}

export async function requestPlayerData(
	uid: string,
	interaction?: Interaction
): Promise<PlayerDataResponse> {
	try {
		const response = await axios.get(
			`https://api.mihomo.me/sr_info_parsed/${uid}${await languageParam(interaction)}`
		);
		return { status: response.status, playerData: response.data };
	} catch (error: any) {
		return {
			status: 400,
			playerData: {
				detail: error.response?.data?.detail,
				message: error.message
			}
		};
	}
}

export async function requestPlayerActivity(
	uid: string,
	interaction?: Interaction
): Promise<PlayerActivityResponse> {
	try {
		const response = await axios.get(
			`https://api.mihomo.me/sr_activity/${uid}${await languageParam(interaction)}`
		);
		return { status: response.status, playerActivity: response.data };
	} catch (error: any) {
		return {
			status: 400,
			playerActivity: {
				detail: error.response?.data?.detail,
				message: error.message
			}
		};
	}
}
