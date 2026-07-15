import tseslint from "typescript-eslint";

// ponytail: curated baseline; enable typescript-eslint recommended after the existing unused-code debt is removed.
export default tseslint.config(
	{
		ignores: ["dist/**", "node_modules/**"]
	},
	{
		files: ["src/**/*.ts", "tests/**/*.ts"],
		languageOptions: {
			parser: tseslint.parser
		},
		rules: {
			"no-constant-binary-expression": "error",
			"no-debugger": "error",
			"no-duplicate-case": "error",
			"no-unsafe-finally": "error",
			"no-unreachable": "error"
		}
	}
);
