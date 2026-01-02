import Phaser from "phaser";
import Popup from "./ui/Popup";
import { api } from "../api/client";
import { t } from "./i18nHelper";

type PongMode = "AI" | "LOCAL";
type PongDifficulty = "EASY" | "MEDIUM" | "HARD" | "LOCAL";
type PongWinner = "PLAYER" | "AI" | "PLAYER1" | "PLAYER2";

export default class HouseScene extends Phaser.Scene {

	private readonly PADDLE_WIDTH_N = 0.02;
	private readonly PADDLE_HEIGHT_N = 0.18;
	private readonly PADDLE_MARGIN_N = 0.04;
	private readonly BALL_SIZE_N = 0.03;
	private readonly PADDLE_SPEED_N = 0.01;

	private game_started = false;
	private welcome_shown = false;
	private ia_mode = false;

	private ia_move_up = false;
	private ia_move_down = false;
	private ia_difficulty = 0;

	private paddle1!: Phaser.GameObjects.Rectangle;
	private paddle2!: Phaser.GameObjects.Rectangle;
	private ball!: Phaser.GameObjects.Ellipse;
	private middleLine!: Phaser.GameObjects.Line;
	private borders!: Phaser.GameObjects.Graphics;
	private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
	private scoreText1!: Phaser.GameObjects.Text;
	private scoreText2!: Phaser.GameObjects.Text;

	private popup!: Popup;

	private gameSize = 0;
	private offsetX = 0;
	private offsetY = 0;

	private paddle2y_n = 0.5;
	private paddle1y_n = 0.5;
	private ballx_n = 0.5;
	private bally_n = 0.5;
	private ballSpeedX_n = 0.005;
	private ballSpeedY_n = 0.005;

	private score1 = 0;
	private score2 = 0;

	private startTimeStamp: string | null = null;
	private matchSent = false;

	private keyW!: Phaser.Input.Keyboard.Key;
	private keyS!: Phaser.Input.Keyboard.Key;

	constructor() {
		super({key: "HouseScene"});
	}

	preload() {}

	create(): void {
		this.resetState();
		this.listenKeys();
		this.paddle1 = this.add.rectangle(0, 0, 0, 0, 0xffffff);
		this.paddle2 = this.add.rectangle(0, 0, 0, 0, 0xffffff);
		this.ball = this.add.ellipse(0, 0, 0, 0, 0xffffff);
		this.middleLine = this.add.line(0, 0, 0, 0, 0, 0, 0xffffff)
			.setOrigin(0.5, 0);
		this.borders = this.add.graphics();
		this.renderScore();

		this.popup = new Popup(this);
		this.centerScene();

		this.scale.on("resize", this.onResize, this);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.scale.off("resize", this.onResize, this);
		});
	}

	private resetState () {
		this.game_started = false;
		this.welcome_shown = false;
		this.ia_mode = false;
		this.ia_move_up = false;
		this.ia_move_down = false;
		this.ia_difficulty = 0;
		this.paddle2y_n = 0.5;
		this.paddle1y_n = 0.5;
		this.ballx_n = 0.5;
		this.bally_n = 0.5;
		this.ballSpeedX_n = 0.005;
		this.ballSpeedY_n = 0.005;
		this.score1 = 0;
		this.score2 = 0;
		this.startTimeStamp = new Date().toISOString();
		this.matchSent = false;
	}

	private showWelcomePopup() {
		this.popup.show(
			t("scenes.house.welcome"),
			[
				{
					label: t("scenes.house.iaOpponent"),
					onClick: () => {
						this.popup.hide();
						this.ia_mode = true;
						this.paddle1.setStrokeStyle(3, 0xff0000);
						const keyboard = this.input.keyboard;
						keyboard.removeCapture([
							Phaser.Input.Keyboard.KeyCodes.W,
							Phaser.Input.Keyboard.KeyCodes.S
						]);
						this.keyW.destroy();
						this.keyS.destroy();
						this.ia_popup();
					}
				},
				{
					label: t("scenes.house.localMultiplayer"),
					onClick: () => {
						this.popup.hide();
						this.game_started = true;
					}
				},
				{
					label: t("common.cancel"),
					onClick: () => {
						this.scene.start("WorldMapScene");
					}
				}
			]
		);
	}

	private ia_popup() {
		this.popup.show(
			t("scenes.house.chooseDifficulty"),
			[
				{
					label: t("scenes.house.easy"),
					onClick: () => {
						this.ia_difficulty = 0.7;
						this.popup.hide();
						this.game_started = true;
					}
				},
				{
					label: t("scenes.house.medium"),
					onClick: () => {
						this.ia_difficulty = 0.3;
						this.popup.hide();
						this.game_started = true;
					}
				},
				{
					label: t("scenes.house.hard"),
					onClick: () => {
						this.ia_difficulty = 0.0;
						this.popup.hide();
						this.game_started = true;
					}
				}
			]
		)
	}





	private renderScore() {
		this.scoreText1 = this.add.text(
			this.offsetX + this.gameSize * 0.25,
			this.offsetY + this.gameSize * 0.1,
			this.score1.toString(),
			{fontSize: `${this.gameSize * 0.1}px`, color: "#ffffff", fontFamily: 'GameFont'}
		).setOrigin(0.5);
		this.scoreText2 = this.add.text(
			this.offsetX + this.gameSize * 0.75,
			this.offsetY + this.gameSize * 0.1,
			this.score2.toString(),
			{fontSize: `${this.gameSize * 0.1}px`, color: "#ffffff", fontFamily: 'GameFont'}
		).setOrigin(0.5);
	}

	private onResize() {
		if (!this.scene.isActive()) return;
		this.centerScene();
	}

	private listenKeys() {
		const keyboard = this.input.keyboard;
		keyboard.addCapture([
			Phaser.Input.Keyboard.KeyCodes.UP,
			Phaser.Input.Keyboard.KeyCodes.DOWN,
			Phaser.Input.Keyboard.KeyCodes.W,
			Phaser.Input.Keyboard.KeyCodes.S
		])
		this.cursors = keyboard.createCursorKeys();
		this.keyW = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
		this.keyS = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
	}

	private centerScene() {
		const screenW = this.scale.width;
		const screenH = this.scale.height;

		this.gameSize = Math.min(screenW, screenH);
		this.offsetX = (screenW - this.gameSize) / 2;
		this.offsetY = (screenH - this.gameSize) / 2;

		const paddleWidth = this.gameSize * this.PADDLE_WIDTH_N;
		const paddleHeight = this.gameSize * this.PADDLE_HEIGHT_N;
		const paddleMargin = this.gameSize * this.PADDLE_MARGIN_N;
		const ballSize = this.gameSize * this.BALL_SIZE_N;

		this.paddle1.setSize(paddleWidth, paddleHeight);
		this.paddle1.setPosition(
			this.offsetX + paddleMargin,
			this.offsetY + this.gameSize * 0.5
		);

		this.paddle2.setSize(paddleWidth, paddleHeight);
		this.paddle2.setPosition(
			this.offsetX + this.gameSize - paddleMargin,
			this.offsetY + this.gameSize * 0.5
		);

		this.ball.setSize(ballSize, ballSize);
		this.ball.setPosition(
			this.offsetX + this.gameSize * 0.5,
			this.offsetY + this.gameSize * 0.5
		);

		this.middleLine
			.setPosition(this.offsetX + this.gameSize * 0.5, this.offsetY)
			.setTo(0, 0, 0, this.gameSize);

		this.borders.clear();
		this.borders.lineStyle(4, 0xffffff);
		this.borders.strokeRect(
			this.offsetX,
			this.offsetY,
			this.gameSize,
			this.gameSize
		);
		this.scoreText1.setFontSize(this.gameSize * 0.1);
		this.scoreText1.setPosition(
			this.offsetX + this.gameSize * 0.25,
			this.offsetY + this.gameSize * 0.1
		);
		this.scoreText2.setFontSize(this.gameSize * 0.1);
		this.scoreText2.setPosition(
			this.offsetX + this.gameSize * 0.75,
			this.offsetY + this.gameSize * 0.1
		);
	}

	update(): void {
		if (!this.game_started) {
			if (this.welcome_shown) return;
			this.welcome_shown = true;
			this.showWelcomePopup();
			return;
		}
		if (this.ia_mode) this.ia_actions();
		this.checkMovement();

		this.ballx_n += this.ballSpeedX_n;
		this.bally_n += this.ballSpeedY_n;

		if (this.bally_n <= 0 || this.bally_n >= 1) {
			this.ballSpeedY_n = -this.ballSpeedY_n;
		}

		this.checkCollision();
		this.ball.x = this.offsetX + this.gameSize * this.ballx_n;
		this.ball.y = this.offsetY + this.gameSize * this.bally_n;
		this.pointScored();
	}

	private ia_actions() {
		const targetY = this.bally_n;
		const diff = targetY - this.paddle1y_n;
		const threshold = 0.02;

		if (Math.random() <= this.ia_difficulty) {
			this.ia_move_up = false;
			this.ia_move_down = false;
			return;
		}

		if (Math.abs(diff) < threshold) {
			this.ia_move_up = false;
			this.ia_move_down = false;
		} else if (diff < 0) {
			this.ia_move_up = true;
			this.ia_move_down = false;
		} else {
			this.ia_move_up = false;
			this.ia_move_down = true;
		}
	}

	private checkMovement() {
		if (this.cursors.up?.isDown) {
			this.paddle2y_n -= this.PADDLE_SPEED_N;
		}
		if (this.cursors.down?.isDown) {
			this.paddle2y_n += this.PADDLE_SPEED_N;
		}
		if ((this.keyW?.isDown && !this.ia_mode) || (this.ia_mode && this.ia_move_up)) {
			this.paddle1y_n -= this.PADDLE_SPEED_N;
		}
		if ((this.keyS?.isDown && !this.ia_mode) || (this.ia_mode && this.ia_move_down)) {
			this.paddle1y_n += this.PADDLE_SPEED_N;
		}
		const halfH1 = (this.paddle1.height / this.gameSize) / 2;
		const halfH2 = (this.paddle2.height / this.gameSize) / 2;
		this.paddle1y_n = Phaser.Math.Clamp(this.paddle1y_n, halfH1, 1 - halfH1);
		this.paddle2y_n = Phaser.Math.Clamp(this.paddle2y_n, halfH2, 1 - halfH2);
		this.paddle1.y = this.offsetY + this.gameSize * this.paddle1y_n;
		this.paddle2.y = this.offsetY + this.gameSize * this.paddle2y_n;
	}

	private checkCollision() {
		const maxBounce = 0.012;

		if (this.ballx_n <= this.PADDLE_MARGIN_N + this.PADDLE_WIDTH_N) {
			const paddleTop = this.paddle1y_n - this.PADDLE_HEIGHT_N / 2;
			const paddleBottom = this.paddle1y_n + this.PADDLE_HEIGHT_N / 2;
			if (this.bally_n >= paddleTop && this.bally_n <= paddleBottom) {
				const impact = this.bally_n - this.paddle1y_n;
				const normalized = impact / (this.PADDLE_HEIGHT_N / 2);
				this.ballSpeedY_n = normalized * maxBounce;
				this.ballSpeedX_n = Math.abs(this.ballSpeedX_n);
				this.ballSpeedX_n += 0.0005;
				this.ballSpeedY_n += 0.0005;
			}
		}
		else if (this.ballx_n >= 1 - this.PADDLE_MARGIN_N - this.PADDLE_WIDTH_N) {
			const paddleTop = this.paddle2y_n - this.PADDLE_HEIGHT_N / 2;
			const paddleBottom = this.paddle2y_n + this.PADDLE_HEIGHT_N / 2;
			if (this.bally_n >= paddleTop && this.bally_n <= paddleBottom) {
				const impact = this.bally_n - this.paddle2y_n;
				const normalized = impact / (this.PADDLE_HEIGHT_N / 2);
				this.ballSpeedY_n = normalized * maxBounce;
				this.ballSpeedX_n = -Math.abs(this.ballSpeedX_n);
				this.ballSpeedX_n -= 0.0005;
				this.ballSpeedY_n -= 0.0005;
			}
		}
	}

	private pointScored() {
		if (this.ballx_n < 0) {
			this.score2 += 1;
			this.updateScore();
			this.resetBall();
		}
		else if (this.ballx_n > 1) {
			this.score1 += 1;
			this.updateScore();
			this.resetBall();
		}
	}

	private resetBall() {
		this.ballx_n = 0.5;
		this.bally_n = 0.5;
		this.ballSpeedX_n = Phaser.Math.Between(0, 1) ? 0.005 : -0.005;
		this.ballSpeedY_n = Phaser.Math.Between(-0.005, 0.005);
	}

	private difficultyLabel(): PongDifficulty {
		if (!this.ia_mode)
			return "LOCAL";
		if (this.ia_difficulty >= 0.6)
			return "EASY";
		if (this.ia_difficulty >= 0.2)
			return "MEDIUM";
		return "HARD";
	}

	private winnerValue(): PongWinner {
		if (this.ia_mode)
		{
			if (this.score2 >= 5)
				return "PLAYER";
			return "AI";
		}
		if (this.score2 >= 5)
			return "PLAYER1";
		return "PLAYER2";
	}

	private modeValue(): PongMode {
		if (this.ia_mode)
			return "AI";
		return "LOCAL";
	}

	private async sendPongStats(): Promise<void> {
		if (this.matchSent)
			return ;
		this.matchSent = true;

		const startedAt = this.startTimeStamp ?? new Date().toISOString();
		const endedAt = new Date().toISOString();

		const payload = {
			playerid:	"",
			mode:		this.modeValue(),
			difficulty:	this.difficultyLabel(),
			score1:		String(this.score1),
			score2:		String(this.score2),
			winner:		this.winnerValue(),
			timestamp1:	startedAt,
			timestamp2: endedAt,
		};

		try {
			await api.sendPong(payload);
			console.log("Successfully sent pong stats");

			// update stress/confidence
			if (this.ia_mode) {
				await this.updateStressConfidence();
			}
		} catch (e) {
			console.error("Failed to send pong stats [network error]", e);
		}
	}

	private async updateStressConfidence(): Promise<void> {
		// get current profile to know meter levels
		try {
			const profile = await api.getProfile();
			const currentStress = profile.stressLevel ?? 50;
			const currentConfidence = profile.confidenceLevel ?? 50;
			
			// calculate based on diff
			let difficultyMultiplier = 1;
			if (this.ia_difficulty < 0.2) {
				difficultyMultiplier = 3; // HARD
			} else if (this.ia_difficulty < 0.6) {
				difficultyMultiplier = 2; // MEDIUM
			} else {
				difficultyMultiplier = 1; // EASY
			}

			const playerWon = this.score2 >= 5;
			let newStress = currentStress;
			let newConfidence = currentConfidence;

			if (playerWon) {
				newConfidence = Math.min(100, currentConfidence + (5 * difficultyMultiplier));
				newStress = Math.max(0, currentStress - (2 * difficultyMultiplier));
			} else {
				newStress = Math.min(100, currentStress + (3 * difficultyMultiplier));
				newConfidence = Math.max(0, currentConfidence - (2 * difficultyMultiplier));
			}

			// update profile with new values
			await api.updateProfile({
				stressLevel: Math.round(newStress),
				confidenceLevel: Math.round(newConfidence),
			});
			console.log(`Updated stress: ${currentStress} -> ${Math.round(newStress)}, confidence: ${currentConfidence} -> ${Math.round(newConfidence)}`);
		} catch (e) {
			console.error("Failed to update stress/confidence:", e);
		}
	}

	private updateScore() {
		this.scoreText1.setText(this.score1.toString());
		this.scoreText2.setText(this.score2.toString());
		if (this.score1 >= 5 || this.score2 >= 5) {
			// sends game stat to backend
			console.log("sending pong stats...");
			try {
				this.sendPongStats();
			} catch (e) {
				console.error("Failed to send pong stats", e);
			}
			this.game_started = false;
			if (!this.ia_mode) {
				const winner = this.score1 >= 5 ? t("scenes.house.player1") : t("scenes.house.player2");
				this.popup.show(
					t("scenes.house.gameOverPlayer", { player: winner }),
					[
						{
							label: t("common.ok"),
							onClick: async () => {
								this.score1 = 0;
								this.score2 = 0;
								this.updateScore();
								this.scene.start("WorldMapScene");
							}
						}
					]
				)
			}
			else {
				const message = this.score2 >= 5 ? t("scenes.house.youWin") : t("scenes.house.iaWins");
				this.popup.show(
					message,
					[
						{
							label: t("common.ok"),
							onClick: async () => {
								this.score1 = 0;
								this.score2 = 0;
								this.updateScore();
								this.scene.start("WorldMapScene");
							}
						}
					]
				)
			}
		}
	}
}
