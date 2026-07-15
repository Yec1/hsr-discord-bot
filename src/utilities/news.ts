import axios from "axios";
import emoji from "@/assets/emoji.js";

const BASE_URL = "https://bbs-api-os.hoyolab.com/community/post/wapi/";

export async function getNewsList(lang: string, type: string): Promise<any> {
	return axios({
		headers: {
			"x-rpc-app_version": "2.43.0",
			"x-rpc-client_type": 4,
			"X-Rpc-Language": lang
		},
		method: "get",
		url: BASE_URL + "getNewsList",
		params: { gids: 6, page_size: 25, type }
	}).then(response => response.data);
}

export async function getPostFull(lang: string, postId: string): Promise<any> {
	return axios({
		headers: {
			"x-rpc-app_version": "2.43.0",
			"x-rpc-client_type": 4,
			"X-Rpc-Language": lang
		},
		method: "get",
		url: BASE_URL + "getPostFull",
		params: { gids: 6, post_id: postId }
	}).then(response => response.data.data);
}

export async function parsePostContent(content: string): Promise<string> {
	content = content
		.replace(/<br\s*\/?>/g, "\n")
		.replace(/<\p[^>]*>/g, "\n")
		.replace(/<\/p>/g, "")
		.replace(/<\/?strong[^>]*>/g, "**")
		.replace(/<\/?em[^>]*>/g, "*")
		.replace(/<\/?span[^>]*>/g, "")
		.replace(/<\/?div[^>]*>/g, "")
		.replace(/<\/?img[^>]*>/g, "")
		.replace(/<h4[^>]*>/g, "\n### ")
		.replace(/<\/h4>/g, "")
		.replace(/<h3[^>]*>/g, "\n## ")
		.replace(/<\/h3>/g, "")
		.replace(/&gt;/g, ">")
		.replace(/&lt;/g, "<")
		.replace(/&nbsp;/g, " ")
		.replace(
			/<([a-z]+)\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/\1>/gi,
			(_match: string, _tag: string, href: string, text: string) =>
				href == text
					? `${emoji.link}${href}`
					: `${emoji.link}[${text}](${href})`
		)
		.replace(
			/<iframe[^>]*src="([^"]*)"[^>]*><\/iframe>/gi,
			(_match: string, url: string) => `### ${emoji.link}[影片](${url})`
		)
		.replace(/\s*class="[^"]*"/g, "");

	return content;
}
