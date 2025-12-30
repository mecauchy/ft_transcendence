// packages/shared/types/game.ts

export interface IPongGame {
	playerid: string;
	mode: "AI" | "LOCAL";
	difficulty: "EASY" | "MEDIUM" | "HARD" | "LOCAL",
	score1: string;
	score2: string;
	winner: "PLAYER" | "AI" | "PLAYER1" | "PLAYER2";
	timestamp: string;
}