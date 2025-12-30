export interface IPongGame {
	playerid: string;
	mode: "AI" | "LOCAL";
	difficulty: "EASY" | "MEDIUM" | "HARD" | "LOCAL",
	score1: string;
	score2: string;
	winner: "PLAYER" | "AI" | "PLAYER1" | "PLAYER2";
	timestamp1: string;
	timestamp2: string;
}

export interface IBreatheGame {
	playerid: string;
	timestamp1: string;
	timestamp2: string;
}