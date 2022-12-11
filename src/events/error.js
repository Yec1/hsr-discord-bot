import { client } from "../index.js";
client.on("error", error => {
	console.log(error);
});
client.on("warn", error => {
	console.log(error);
});
process.on("unhandledRejection", error => {
	console.log("Unhandled promise rejection:", error);
});

process.on("uncaughtException", console.error);
