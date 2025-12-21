import Phaser from "phaser";
import WorldMapScene from "./WorldMapScene";

export default class HouseScene extends Phaser.Scene {

	private readonly PADDLE_WIDTH_N = 0.02;
	private readonly PADDLE_HEIGHT_N = 0.18;
	private readonly PADDLE_MARGIN_N = 0.04;
	private readonly BALL_SIZE_N = 0.03;
	private readonly PADDLE_SPEED_N = 0.01;

	private paddle1!: Phaser.GameObjects.Rectangle;
	private paddle2!: Phaser.GameObjects.Rectangle;
	private ball!: Phaser.GameObjects.Ellipse;
	private middleLine!: Phaser.GameObjects.Line;
	private borders!: Phaser.GameObjects.Graphics;
	private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
	private scoreText1!: Phaser.GameObjects.Text;
	private scoreText2!: Phaser.GameObjects.Text;

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

	private keyW!: Phaser.Input.Keyboard.Key;
	private keyS!: Phaser.Input.Keyboard.Key;

	constructor() {
		super({ key: "HouseScene" });
	}

	preload() {}

	create(): void {
		this.paddle1 = this.add.rectangle(0, 0, 0, 0, 0xffffff);
		this.paddle2 = this.add.rectangle(0, 0, 0, 0, 0xffffff);
		this.ball = this.add.ellipse(0, 0, 0, 0, 0xffffff);
		this.middleLine = this.add.line(0, 0, 0, 0, 0, 0, 0xffffff)
			.setOrigin(0.5, 0);
		this.borders = this.add.graphics();
		this.renderScore();

		this.centerScene();

		this.listenKeys();
		this.scale.on("resize", this.onResize, this);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.scale.off("resize", this.onResize, this);
		});
	}

	private renderScore() {
		this.scoreText1 = this.add.text(
			this.offsetX + this.gameSize * 0.25,
			this.offsetY + this.gameSize * 0.1,
			this.score1.toString(),
			{ fontSize: `${this.gameSize * 0.1}px`, color: "#ffffff", fontFamily: 'GameFont'}
		).setOrigin(0.5);
		this.scoreText2 = this.add.text(
			this.offsetX + this.gameSize * 0.75,
			this.offsetY + this.gameSize * 0.1,
			this.score2.toString(),
			{ fontSize: `${this.gameSize * 0.1}px`, color: "#ffffff", fontFamily: 'GameFont'}
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
		this.checkMocvement();
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

	private checkMocvement() {
		if (this.cursors.up?.isDown) {
			this.paddle2y_n -= this.PADDLE_SPEED_N;
		}
		if (this.cursors.down?.isDown) {
			this.paddle2y_n += this.PADDLE_SPEED_N;
		}
		if (this.keyW?.isDown) {
			this.paddle1y_n -= this.PADDLE_SPEED_N;
		}
		if (this.keyS?.isDown) {
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
		if (this.ballx_n <= this.PADDLE_MARGIN_N + this.PADDLE_WIDTH_N) {
			// collision with left paddle
			const paddleTop = this.paddle1y_n - (this.PADDLE_HEIGHT_N / 2);
			const paddleBottom = this.paddle1y_n + (this.PADDLE_HEIGHT_N / 2);
			if (this.bally_n >= paddleTop && this.bally_n <= paddleBottom) {
				this.ballSpeedX_n = -this.ballSpeedX_n;
			}
		}
		else if (this.ballx_n >= 1 - this.PADDLE_MARGIN_N - this.PADDLE_WIDTH_N) {
			// collision with right paddle
			const paddleTop = this.paddle2y_n - (this.PADDLE_HEIGHT_N / 2);
			const paddleBottom = this.paddle2y_n + (this.PADDLE_HEIGHT_N / 2);
			if (this.bally_n >= paddleTop && this.bally_n <= paddleBottom) {
				this.ballSpeedX_n = -this.ballSpeedX_n;
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
	}

	private updateScore() {
		this.scoreText1.setText(this.score1.toString());
		this.scoreText2.setText(this.score2.toString());
		if (this.score1 >= 10 || this.score2 >= 10) {
			this.score1 = 0;
			this.score2 = 0;
			this.updateScore();
			this.scene.start('WorldMapScene');
		}
	}
}
