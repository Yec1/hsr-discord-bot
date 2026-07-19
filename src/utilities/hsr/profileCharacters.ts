export interface ProfileCharacterSupportLike {
	_assist?: boolean;
	pos?: number;
}

export function isSupportProfileCharacter(character: ProfileCharacterSupportLike): boolean {
	return character._assist === true || (typeof character.pos === "number" && character.pos <= 2);
}

export function getProfileCharacterNameColor(character: ProfileCharacterSupportLike): string {
	return isSupportProfileCharacter(character) ? "#FFD89C" : "white";
}
