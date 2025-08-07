import chalk from "chalk";

class Logger {
	private origin: string;

	constructor(origin: string) {
		this.origin = origin;
	}

	info(message: string): void {
		console.log(
			`${chalk.gray(new Date().toLocaleString())} ${chalk.cyan(
				`[${this.origin}]`
			)} ${message}`
		);
	}

	command(message: string): void {
		console.log(
			`${chalk.gray(new Date().toLocaleString())} ${chalk.hex("#F3CCF3")(
				`[${this.origin}]`
			)} ${message}`
		);
	}

	success(message: string): void {
		console.log(
			`${chalk.gray(new Date().toLocaleString())} ${chalk.green(
				`[${this.origin}]`
			)} ${message}`
		);
	}

	warn(message: string): void {
		console.warn(
			`${chalk.gray(new Date().toLocaleString())} ${chalk.yellow(
				`[${this.origin}]`
			)} ${message}`
		);
	}

	error(message: string): void {
		console.error(
			`${chalk.gray(new Date().toLocaleString())} ${chalk.red(
				`[${this.origin}]`
			)} ${message}`
		);
	}
}

export default Logger;
