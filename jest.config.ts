import type { Config } from "jest";

const config: Config = {
	preset: "ts-jest",
	testEnvironment: "node",
	roots: ["<rootDir>/tests"],
	testMatch: ["**/?(*.)+(spec|test).ts"],
	moduleNameMapper: {
		"^@/(.*)\\.js$": "<rootDir>/src/$1",
		"^@/(.*)$": "<rootDir>/src/$1"
	},
	transform: {
		"^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }]
	},
	clearMocks: true
};

export default config;
