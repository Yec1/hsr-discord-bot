import { parsePostContent } from "@/utilities/news";

describe("parsePostContent", () => {
	it("converts the supported Hoyolab markup without a network call", async () => {
		const result = await parsePostContent(
			'<h3>News</h3><strong>Trailblazer</strong><br><a href="https://example.com">Read</a>'
		);

		expect(result).toContain("## News");
		expect(result).toContain("**Trailblazer**\n");
		expect(result).toContain("[Read](https://example.com)");
	});
});
