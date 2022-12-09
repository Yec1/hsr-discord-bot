import { Database } from "quickmongo";

const db = new Database(
	"mongodb+srv://iCE:luna4ever@cluster0.ex03kqs.mongodb.net/?retryWrites=true&w=majority"
);

await db.connect();

console.log("connected");
const tb1 = new db.table("dev");

console.log("created table");
await tb1.set("sb", 1);
console.log(await tb1.get("sb"));

await db.set("sb2", 1);
console.log(await db.get("sb2"));
