import chalk from "chalk";

class Logger {
	constructor(origin) {
		this.origin = origin;
	}
	info(message) {
		console.log(
			`${chalk.gray(new Date().toLocaleString())} ${chalk.cyan(
				`[${this.origin}]`
			)} ${message}`
		);
	}

	success(message) {
		console.log(
			`${chalk.gray(new Date().toLocaleString())} ${chalk.green(
				`[${this.origin}]`
			)} ${message}`
		);
	}

	warn(message) {
		console.warn(
			`${chalk.gray(new Date().toLocaleString())} ${chalk.yellow(
				`[${this.origin}]`
			)} ${message}`
		);
	}

	error(message) {
		console.error(
			`${chalk.gray(new Date().toLocaleString())} ${chalk.red(
				`[${this.origin}]`
			)} ${message}`
		);
	}
}

export { Logger };
