import express from "express";
import dotenv from "dotenv";
import path from "path";
import { createMmt, verifyMmt } from "./geetest.js";
import { connectDb, getUserDetails } from "./db.js";
import { Logger } from "../utilities/core/logger.js";

dotenv.config({ path: `${process.cwd()}/../../.env` });

// Connect to database
export const webServerDb = await connectDb();

const app = express();
const PORT = process.env.WEBSERVER_PORT || 3000;

// Show server state
app.get("/", (req, res) => {
	res.json({ status: 200 });
});

const publicPath = path.join(process.cwd(), "src/geetestServer/public");
app.use(express.static(publicPath));

app.use(express.json());

// Api route for creating mmt
app.get("/geetest/mmt/:userid", async (req, res) => {
	const { userid } = req.params;
	new Logger("Webserver").command(`User ${userid}: going to create mmt`);

	try {
		// Get cookies and language preference from database by discord id
		const userInf = await getUserDetails(userid);

		// Create mmt
		let mmt = await createMmt(userInf.cookie);

		// Set default language to english if not specified by user
		userInf.lang ? (mmt.lang = userInf.lang) : (mmt.lang = "en");
		// Match locale zh-tw with geetest language setting
		if (mmt.lang === "tw") mmt.lang = "zh-tw";

		res.status(200).json(mmt);
	} catch (error) {
		new Logger("Webserver").error(
			`User ${userid}: Failed to create mmt. ${error.message}`
		);
		res.status(500).json({ message: error.message });
	}
});

// Front page route
app.get("/geetest/:userid", (req, res) => {
	const userid = req.params;
	if (userid) {
		res.sendFile(path.join(publicPath, "index.html"));
	}
});

// Route for receiving and verifying geetest result completed by user
app.post("/geetest/:userid", async (req, res) => {
	const { userid } = req.params;
	new Logger("Webserver").command(`User ${userid}: going to verify mmt`);

	try {
		// Get cookies from database by discord id
		const userInf = await getUserDetails(userid);

		// console.log(`body : ${JSON.stringify(req.body)}`);

		// Verify mmt
		await verifyMmt(req.body, userInf.cookie);

		res.status(200).json({ message: "Geetest Verification success" });
	} catch (error) {
		new Logger("Webserver").error(
			`User ${userid}: Failed to verify mmt. ${error.message}`
		);
		res.status(500).json({ message: error.message });
	}
});

app.listen(PORT, () => {
	new Logger("Webserver").info(
		`Geetest Webserver is running on PORT ${PORT}`
	);
});
