import { client } from "../index.js";
import { GuildSchema, UserSchema } from "./Schema.js";

const { db } = client;

class Profile {
	constructor(id, prefix, schema) {
		this.__id = id;
		this.__schema = schema;
		this.__prefix = `${prefix}:`;
	}
	async init() {
		const data = (await db.get(`${this.__prefix}${this.__id}`)) ?? -1;
		if (data == -1) return this;
		for (const [key, value] of Object.entries(data)) {
			this[key] = value;
		}
		return this;
	}
	async check() {
		return (await db.get(`${this.__prefix}${this.__id}`)) ? true : false;
	}
	async checkAndUpdate() {
		if (!(await this.check())) {
			await this.newSchema();
		}
		this.updateSchema();
		return true;
	}
	get db() {
		return db;
	}
	async newSchema(initType = "user") {
		if (!this.__schema) return false;
		Object.assign(this, this.__schema);
		return void this.save();
	}
	async updateSchema() {
		if (!this.__schema) return false;
		let raw = this.raw;
		Object.assign(this, this.__schema, raw);
		return this.save();
	}
	async save() {
		const data = JSON.parse(JSON.stringify(this));
		delete data["__id"];
		delete data["__schema"];
		delete data["__prefix"];
		return (
			void (await db.set(`${this.__prefix}${this.__id}`, data)) ?? this
		);
	}
	get raw() {
		const data = JSON.parse(JSON.stringify(this));
		delete data["__id"];
		delete data["__schema"];
		delete data["__prefix"];
		return data;
	}
}

export async function GuildProfile(id) {
	return await new Profile(id?.guild?.id ?? id, "guild", GuildSchema).init();
}
export async function UserProfile(id) {
	return await new Profile(
		id?.author?.id ?? id?.user?.id ?? id,
		"user",
		UserSchema
	).init();
}
