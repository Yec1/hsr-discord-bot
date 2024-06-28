const langs = {
	// Global
	Hour: "h",
	Minute: "min",
	Second: "sec",
	isSet: "Set",
	isNotSet: "Not Set",
	ms: "ms",
	CostTime:
		"Time Cost: Request <requestTime> seconds • Draw <drawTime> seconds",
	level: "Level",
	level_Format: "Level <level>",
	lightConeLevel: "Light Cone",
	lightConeLevel_Format: "Light Cone <rank> Level",
	MainPage: "Main Page",
	Eidolon: "Eidolon <rank> Level",
	RelicGrade: "Relic Rating <grade> • Grade",
	RelicNoScore: "No relic rating data for this character yet",
	NewLocale: "Language set to `<locale>`",
	DrawError: "Drawing Failed",
	TotalScore: "Total Score",
	Cacophony: "Cacophony:",
	Finality: "Finality",
	Score: "Score:",
	MainCharacter: "Trailblazer",
	None: "None",
	True: "Yes",
	False: "No",
	Auto: "Auto",
	Current: "Current Pulls",
	Soft: "Soft Pity Pulls",
	Max: "Guaranteed Pulls",
	Chance: "5-Star Chance",
	Rateup: "Rate-Up Chance",
	Guarantee: "Guaranteed Rate-Up Next",
	waitFormat1: "Please wait `<time>` seconds and try again!",
	waitFormat2: "Please wait `<time>` and try again!",
	Searching: "Searching data, please wait...",
	TrailblazePower: "Trailblaze Power",
	TP_RecoveryTime: "Remaining Recovery Time",
	DailyTraining: "Daily Training",
	EchoOfWar: "Echo of War",
	SynchronicityPoints: "Additional Sync Points for the Week",
	OngoingAssignments: "Ongoing Assignments:",
	Remaining: "Remaining",
	Year: "year",
	Month: "month",
	Day: "日",

	// Commands
	news_Notice: "Announcement",
	news_Events: "Activities",
	news_Info: "Information",
	news_SelectType: "Please select a news category",
	news_SelectPost: "🐣 Please select an article",
	profile_UidNotSet: "UID not set yet, set it to quickly search for yourself",
	profile_UidNotSetDesc:
		"Please use the </account:1160207139151818852> command to set your account UID",
	profile_UidNotFound: "Cannot find this Trailblazer!",
	DrawInQueue: "In queue, current queue position: <position>",
	profile_NoImageData: "Unable to retrieve image data",
	profile_SelectCharacter: "Select a character to view",
	profile_TrailblazeLevel: "Trailblaze Level",
	profile_EquilibriumLevel: "Equilibrium Level",
	profile_Records: "Travel Records",
	profile_CharactersCount: "Characters Met",
	profile_AchievementsCount: "Achievements",
	profile_MemoryLevel: "Memory Progress",
	profile_MemoryOfChaosLevel: "Memory of Chaos Progress",
	profile_PureFictionLevel: "Pure Fiction Progress",

	NoSetAccount:
		"This Trailblazer has not set up an account, so this command cannot be used!",
	AccountNotFound: "Cannot find this Trailblazer!",
	AccountNotFoundDesc:
		"### Please check if the following data is set and correct\n- Cookie: `<hasCookie>`\n- UID: `<hasUid>`",

	clear_Success: "All saved data cleared!",

	account_Linked: "Linked",
	account_NotLinked: "Not Linked",
	account_ListOfAccount: "Accounts set by <Username>",
	account_SelectAccountSetCookie: "Select an account to set the Cookie",
	account_SelectAccountEdit: "Select an account to edit",
	account_SelectAccountDelete: "Select an account to delete",
	account_SetUserID: "Set UID",
	account_SetUserIDDesc: "UID in the game",
	account_SetUserCookie: "Set Cookie",
	account_NoAccount: "No account set yet",
	account_HowToSetUpAccount: "❓ How to Set Up Account",
	account_HowToSetUpAccountDesc:
		"1. Use the /account command\n2. Select `① Set UID` and `② Set Cookie`\n### 🔥 How to get the Cookie\n1. Open [Hoyolab](https://www.hoyolab.com/)\n2. After logging in, press `F12` or `Ctrl + Shift + I` to open Developer Tools\n3. Switch to `Application` and select `Cookie` on the left\n4. Copy `ltoken_v2` and `ltuid_v2` and fill them in the fields",
	account_CookieSetSuccess: "Cookie bound to <z>!",
	account_CookieSetFailed: "Cookie binding failed",
	account_CookieSetFailedDesc: "Please check if the Cookie is correct",
	account_DeletedSuccess: "Account unlinked successfully",
	account_LimitExceeded: "You can set up to `3` accounts!",
	account_AlreadySet: "You have already set <z>!",
	account_UidSetSuccess: "UID <z> set successfully!",

	admin_NoPermission: "You do not have permission to use this command!",
	admin_RemoveFail: "Failed to delete",
	admin_UserNotSet: "<user> has not set this feature",
	admin_RemoveFailUserOtherServer:
		"<user>'s set notification channel is not in this server",
	admin_RemoveSuccess: "Deleted successfully",
	admin_RemoveSuccessMessage:
		"Deleted <user>'s message notification in <channel>",
	admin_MoveFail: "Move failed",
	admin_MoveNoPermission: "I lack `Send Messages` permission in <channel>",
	admin_MoveSuccess: "Moved successfully",
	admin_MoveSuccessMessage:
		"Moved message notifications for `<count>` users to <channel>",
	admin_MoveFailMessage: "Unable to set message notification to <channel>",
	admin_NoData: "No data in the database",

	forgottenHall_NonData: "Cannot find battle records for this mode",
	forgottenHall_NonDataDesc:
		"Updating battle records may take a few hours, please try again later",
	forgottenHall_Mode1: "Memory of Chaos",
	forgottenHall_Mode2: "Pure Fiction",
	forgottenHall_Mode3: "Apocalyptic Shadow",
	forgottenHall_Title: "",
	forgottenHall_SelectFloor: "Select Floor",
	forgottenHall_FloorFormat1: "<s> Stars • <r> Rounds",
	forgottenHall_FloorFormat2: "<s> Stars • <r> Rounds • <z> Points",
	forgottenHall_FloorFormat3: "<s> Stars • <z> Points",
	forgottenHall_TimeFooter: "Statistics Period",
	forgottenHall_Level: "Highest Level",
	forgottenHall_Battle: "Battles",
	forgottenHall_UseRound: "Rounds Used",
	forgottenHall_TeamSetup: "Team Setup<z>",

	leaderboard_Character: "View Leaderboard",
	leaderboard_Title: "<z> Relic Rating Leaderboard",
	leaderboard_CharacterRange: "(Rank <s> - <e>)",
	leaderboard_Score: "**<z>** Points",

	guide_Character: "View Guide",
	guide_NonImage: "No guide image for `<z>` currently",

	daily_Failed: "Check-in failed",
	daily_Signed: "Trailblazer, you've already checked in today~",
	daily_SignSuccess: "Check-in successful!",
	daily_Description: "You've received today's reward <a>",
	daily_DescriptionTmr: "Tomorrow's reward is <b>",
	daily_Month: "Monthly Check-in",
	daily_SignedDay: "Days Checked-in: <z>",
	daily_MissedDay: "Days Missed: <z>",
	daily_NonAccount: "Account not set",
	daily_NonAccountDesc: "Please set up an account before using this command",
	autoDaily_Off: "Auto Check-in turned off",
	autoDaily_On: "Auto Check-in turned on",
	autoDaily_Time: "Auto Check-in Time: <time>",
	autoDaily_Tag: "Tag on Check-in: <z>",

	warp_TypeCharacter: "Limited Character Warp",
	warp_TypeLightcone: "Limited Light Cone Warp",
	warp_TypeRegular: "Standard Warp",
	warp_Loading: "Loading <a>",
	warplog_Title: "Warp Analysis",
	warplog_Count: "Total Warps",
	warplog_Cost: "Spent Star Jades",
	warplog_5Count: "5-Star Count",
	warplog_5CountAverage: "Average 5-Star Pulls",
	warplog_React: "Recent 5-Star Records",
	warp_SimSetError: "Please enter a valid number: <z>",
	warp_SimSetChanceError: "5-Star chance must be between 0 and 1",
	warp_SimSetRateUpError: "Rate-Up chance must be between 0 and 1",
	warp_SimSetSus: "Simulation Warp settings changed",
	warp_SimSetTitle: "Simulation Warp Settings",
	warp_Error: "Please ensure the Warp Record URL is correct",
	warp_ErrorDesc:
		"How to get the Warp Record URL </warp:1120925141338177543>",
	draw_NoData: "Failed to retrieve data",
	warp_SelectMenuTitle: "Select Warp Record",
	warp_SimFooter:
		"Please do not move or switch screens for a better warp experience",
	warp_Skip: "Skip",
	warp_Pity: "<z> pulls without a 5-star",
	warp_Title: "Query Warp Record",
	warp_Input: "Place the Warp Record URL here",
	warp_HowToGet: "How to Get Warp Record",
	warp_HowToGetDesc:
		"**1.** Open Honkai: Star Rail on PC\n**2.** Open the `Warp` `History`\n**3.** Open Windows PowerShell and paste the following command <z>\n**4.** Copy the URL and use the command </warp:1120003658243915847> to query the Warp Record"
};

export default langs;
