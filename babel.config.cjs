module.exports = {
	presets: [["@babel/preset-env", { targets: { node: "current" } }]],
	plugins: [
		"@babel/plugin-proposal-async-do-expressions",
		["@babel/plugin-proposal-decorators", { "version": "2023-11" }],
	]
};
