/** @type {import('jest').Config} */
module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	roots: ["<rootDir>/tests"],
	testMatch: ["**/?(*.)+(spec|test).ts"],
	moduleNameMapper: {
		"^@/(.*)\\.js$": "<rootDir>/src/$1",
		"^@/(.*)$": "<rootDir>/src/$1",
		"^(\\.{1,2}/.*)\\.js$": "$1"
	},
	transform: {
		"^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }]
	},
	clearMocks: true
};
