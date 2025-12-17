import Phaser from "phaser";

export default class CoffeeScene extends Phaser.Scene {
	private readonly BASE_SIZE = 600;
	private readonly CARD_SCALE = 1.9;
	private readonly CARD_SIZE = 200;

	private gameSize = 0;

	// private card!: Phaser.GameObjects.Text;
	private cardContainer!: Phaser.GameObjects.Container;
	private cardText!: Phaser.GameObjects.Text;
	private cardBg!: Phaser.GameObjects.Image;
	private bg!: Phaser.GameObjects.Image;
	private cardBaseScale = 1;

	private cardNX = 0.5;
	private cardNY = 0.5;

	constructor() {
		super({ key: "CoffeeScene" });
	}

	preload() {
		this.load.image("coffee_bg", "assets/CoffeBg.png");
		this.load.image("card_bg", "assets/card.png");
	}

	create(): void {
		this.bg = this.add.image(0, 0, "coffee_bg").setOrigin(0.5);
		this.createCard();
		this.centerScene();

		this.scale.on("resize", this.onResize, this);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.scale.off("resize", this.onResize, this);
		});
	}

	private createCard() {
		this.cardBg = this.add.image(0, 0, "card_bg");

		const baseFontSize = (this.cardBg.width / this.BASE_SIZE) * 50;
		this.cardText = this.add.text(0, 0, "Coffee Scene", {
			fontSize: `${baseFontSize}px`,
			color: "#000000",
			align: "center",
			wordWrap: { width: this.cardBg.width * 0.8 }
		}).setOrigin(0.5);

		this.cardContainer = this.add.container(0, 0, [
			this.cardBg,
			this.cardText
		]);

		this.cardContainer.setInteractive(
			new Phaser.Geom.Rectangle(
				-this.cardBg.width / 2,
				-this.cardBg.height / 2,
				this.cardBg.width,
				this.cardBg.height
			),
			Phaser.Geom.Rectangle.Contains
		);

		this.input.setDraggable(this.cardContainer);

		this.input.on("drag", (_p, obj, x, y) => {
			if (obj !== this.cardContainer) return;

			const cx = this.scale.width / 2;
			const cy = this.scale.height / 2;

			this.cardNX = Phaser.Math.Clamp((x - cx) / this.gameSize + 0.5, 0, 1);
			this.cardNY = Phaser.Math.Clamp((y - cy) / this.gameSize + 0.5, 0, 1);

			this.updateCardPosition();
		});

		this.cardContainer.on("dragstart", () => {
			this.tweens.add({
				targets: this.cardBg,
				scale: this.cardBaseScale * 1.05,
				angle: Phaser.Math.Between(-2, 2),
				duration: 100,
				ease: "Power2"
			});
		});

		this.cardContainer.on("dragend", () => {
			this.tweens.add({
				targets: this.cardBg,
				scale: this.cardBaseScale,
				angle: 0,
				duration: 100,
				ease: "Power2"
			});
		});
	}

	private onResize() {
		if (!this.scene.isActive()) return;
		if (!this.cardContainer) return;

		this.centerScene();
	}

	private centerScene() {
		const size = Math.min(this.scale.width, this.scale.height);
		this.gameSize = size;

		this.bg.setDisplaySize(size, size);
		this.bg.setPosition(this.scale.width / 2, this.scale.height / 2);

		const scaleFactor = size / this.BASE_SIZE;
		this.cardBaseScale = scaleFactor * this.CARD_SCALE;
		this.cardBg.setScale(this.cardBaseScale);
		this.cardContainer.setScale(1);

		const baseFontSize = 8;
		this.cardText.setFontSize(Math.round(baseFontSize * this.cardBaseScale));
		this.cardText.setWordWrapWidth(this.cardBg.width * this.cardBaseScale * 0.8);

		this.updateCardPosition();
	}

	private updateCardPosition() {
		const centerX = this.scale.width / 2;
		const centerY = this.scale.height / 2;

		this.cardContainer.x = centerX + (this.cardNX - 0.5) * this.gameSize;
		this.cardContainer.y = centerY + (this.cardNY - 0.5) * this.gameSize;
	}
}
