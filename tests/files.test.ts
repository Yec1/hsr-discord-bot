import { getAllFilesFromFs } from "@/utilities/files";

describe("getAllFilesFromFs", () => {
	it("recursively finds files matching the requested extensions", async () => {
		const files = await getAllFilesFromFs("src/handlers", [".ts"]);
		expect(files.some(file => file.endsWith("account.ts"))).toBe(true);
		expect(files.every(file => file.endsWith(".ts"))).toBe(true);
	});
});
