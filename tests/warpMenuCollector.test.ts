import { EventEmitter } from "node:events";
import { registerPersistentWarpMenuCollector } from "@/events/warpMenuCollector.js";

class FakeCollector extends EventEmitter {
	stop = jest.fn();
}

describe("registerPersistentWarpMenuCollector", () => {
	it("handles multiple menu selections without stopping after the first one", () => {
		const collector = new FakeCollector();
		const selections: string[] = [];

		registerPersistentWarpMenuCollector<string>(collector, selection => {
			selections.push(selection);
		});

		collector.emit("collect", "collaboration_character");
		collector.emit("collect", "regular");

		expect(selections).toEqual(["collaboration_character", "regular"]);
		expect(collector.stop).not.toHaveBeenCalled();
	});

	it("runs cleanup when the collector ends", () => {
		const collector = new FakeCollector();
		const cleanup = jest.fn();

		registerPersistentWarpMenuCollector(collector, jest.fn(), cleanup);
		collector.emit("end");

		expect(cleanup).toHaveBeenCalledTimes(1);
	});
});
