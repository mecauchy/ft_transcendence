import Phaser from "phaser";
import Popup from "./ui/Popup";
import { t } from "./i18nHelper";

type CardData = {
	container: Phaser.GameObjects.Container;
	bg: Phaser.GameObjects.Image;
	text: Phaser.GameObjects.Text;
	nx: number;
	ny: number;
};

export default class CoffeeScene extends Phaser.Scene {
	private readonly BASE_SIZE = 600;
	private readonly CARD_SCALE = 1.9;

	private gameSize = 0;

	private bg!: Phaser.GameObjects.Image;
	private stopButton!: Phaser.GameObjects.Image;
	private forgiveButton!: Phaser.GameObjects.Image;
	private buttonBaseScale = 1;
	private cards: CardData[] = [];

	private popup!: Popup;

	private importantThoughts: string[];
	private notImportantThoughts: string[];
	private neutralThoughts: string[];

	private game_started = false;

	constructor() {
		super({key: "CoffeeScene"});
	}

	preload() {
		this.load.image("coffee_bg", "assets/coffee/CoffeBg.png");
		this.load.image("card_bg", "assets/coffee/card.png");
		this.load.image("stop_button", "assets/coffee/stop_button.png");
		this.load.image("forgive_button", "assets/coffee/forgive_button.png");
	}

	create(): void {
		this.bg = this.add.image(0, 0, "coffee_bg").setOrigin(0.5);
		this.stopButton = this.add.image(0, 0, "stop_button").setOrigin(0.5);
		this.forgiveButton = this.add.image(0, 0, "forgive_button").setOrigin(0.5);
		this.buttonOverEffect(this.stopButton);
		this.buttonOverEffect(this.forgiveButton);

		this.importantThoughts = [];
		this.notImportantThoughts = [];
		this.neutralThoughts = [];

		this.popup = new Popup(this);

		if (!this.game_started) {
			this.popup.show(
				t("scenes.coffee.welcome"),
				[
					{
						label: t("scenes.coffee.gotIt"),
						onClick: () => {
							this.popup.hide();
							this.game_started = true;
						}
					}
				]
			);
		}

		// Example cards
		this.createCard(t("scenes.coffee.thoughts.timeChanges"));
		this.createCard(t("scenes.coffee.thoughts.peopleDisappoint"));
		this.createCard(t("scenes.coffee.thoughts.effortMatters"));
		this.createCard(t("scenes.coffee.thoughts.feelingsFade"));
		this.createCard(t("scenes.coffee.thoughts.silenceHeavy"));
		this.createCard(t("scenes.coffee.thoughts.trustBreaks"));
		this.createCard(t("scenes.coffee.thoughts.nothingLasts"));
		this.createCard(t("scenes.coffee.thoughts.memoriesLie"));
		this.createCard(t("scenes.coffee.thoughts.wordsScars"));
		this.createCard(t("scenes.coffee.thoughts.choicesConsequences"));
		this.createCard(t("scenes.coffee.thoughts.loveRisky"));
		this.createCard(t("scenes.coffee.thoughts.regretLate"));
		this.createCard(t("scenes.coffee.thoughts.painTeaches"));
		this.createCard(t("scenes.coffee.thoughts.comfortKills"));
		this.createCard(t("scenes.coffee.thoughts.fearLimits"));
		this.createCard(t("scenes.coffee.thoughts.happinessTemporary"));
		this.createCard(t("scenes.coffee.thoughts.lonelinessFamiliar"));
		this.createCard(t("scenes.coffee.thoughts.attentionAddictive"));
		this.createCard(t("scenes.coffee.thoughts.controlIllusion"));
		this.createCard(t("scenes.coffee.thoughts.meaningPersonal"));

		this.centerScene();

		this.scale.on("resize", this.onResize, this);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.scale.off("resize", this.onResize, this);
			this.popup.destroy();
			this.cleanup()
		});
	}

	private cleanup() {
		for (const card of this.cards) {
			card.container.destroy(true);
		}
		this.cards = [];
	}


	private buttonOverEffect(buttonObject: Phaser.GameObjects.Image)
		{
		buttonObject.setInteractive();
		buttonObject.on("pointerover", () => {
			this.tweens.add({
				targets: buttonObject,
				scale: buttonObject.scale * 1.1,
				duration: 100,
				ease: "Power2"
			});
		});
		buttonObject.on("pointerout", () => {
			this.tweens.add({
				targets: buttonObject,
				scale: this.buttonBaseScale,
				duration: 100,
				ease: "Power2"
			});
		});
		if (buttonObject === this.forgiveButton) {
			buttonObject.on("pointerdown", () => {
				
				this.scene.start("WorldMapScene");
				console.log("Forgive button clicked");
			});
		}
		else if (buttonObject === this.stopButton) {
			buttonObject.on("pointerdown", () => {
				console.log("Stop button clicked");
				this.endGame();
			});
		}
	}

	private endGame() {
		// Logic to end the game or return to main menu
		for (const card of this.cards) {
			if (card.nx > 0.5 && card.nx < 0.95 && card.ny > 0.3 && card.ny < 0.8) {
				this.notImportantThoughts.push(card.text.text);
			}
			else if (card.nx >= 0.05 && card.nx <= 0.5 && card.ny > 0.3 && card.ny < 0.8) {
				this.importantThoughts.push(card.text.text);
			}
			else {
				this.neutralThoughts.push(card.text.text);
			}
		}
		console.log("Important Thoughts:", this.importantThoughts);
		console.log("Not Important Thoughts:", this.notImportantThoughts);
		console.log("Neutral Thoughts:", this.neutralThoughts);
		this.scene.start("WorldMapScene");
	}

	// --------------------------------------------------
	// Card factory
	// --------------------------------------------------

	private createCard(text: string) {
		const bg = this.add.image(0, 0, "card_bg");

		const baseFontSize = 8;
		const txt = this.add.text(0, 0, text, {
			fontSize: `${baseFontSize}px`,
			color: "#000000",
			align: "center",
			wordWrap: {width: bg.width * 0.8}
		}).setOrigin(0.5);

		const container = this.add.container(0, 0, [bg, txt]);

		// Random normalized position (inside safe area)
		const nx = Phaser.Math.FloatBetween(0.2, 0.8);
		const ny = Phaser.Math.FloatBetween(0.2, 0.8);

		const card: CardData = {container, bg, text: txt, nx, ny};
		this.cards.push(card);

		container.setInteractive(
			new Phaser.Geom.Rectangle(
				-bg.width / 2,
				-bg.height / 2,
				bg.width,
				bg.height
			),
			Phaser.Geom.Rectangle.Contains
		);

		this.input.setDraggable(container);

		this.input.on("drag", (_p, obj, x, y) => {
			if (obj !== container) return;

			const cx = this.scale.width / 2;
			const cy = this.scale.height / 2;

			card.nx = Phaser.Math.Clamp((x - cx) / this.gameSize + 0.5, 0, 1);
			card.ny = Phaser.Math.Clamp((y - cy) / this.gameSize + 0.5, 0, 1);

			this.updateSingleCardPosition(card);
		});

		container.on("dragstart", () => {
			this.tweens.add({
				targets: bg,
				scale: bg.scale * 1.05,
				angle: Phaser.Math.Between(-2, 2),
				duration: 100,
				ease: "Power2"
			});
		});

		container.on("dragend", () => {
			this.tweens.add({
				targets: bg,
				scale: bg.scale / 1.05,
				angle: 0,
				duration: 100,
				ease: "Power2"
			});
		});
	}

	// --------------------------------------------------
	// Layout
	// --------------------------------------------------

	private onResize() {
		if (!this.scene.isActive()) return;
		this.centerScene();
	}

	private centerScene() {
		const size = Math.min(this.scale.width, this.scale.height);
		this.gameSize = size;
		const scaleButton = size / 400;

		// Square background
		this.bg.setDisplaySize(size, size);
		this.bg.setPosition(
			Math.round(this.scale.width / 2),
			Math.round(this.scale.height / 2)
		);
		this.stopButton.setPosition(
			Math.round(this.scale.width / 2) - size / 4,
			size / 8
		);
		this.forgiveButton.setPosition(
			Math.round(this.scale.width / 2) + size / 4,
			size / 8
		);
		this.buttonBaseScale = scaleButton;
		this.stopButton.setScale(this.buttonBaseScale);
		this.forgiveButton.setScale(this.buttonBaseScale);

		const scaleFactor = (size / this.BASE_SIZE) * this.CARD_SCALE;

		for (const card of this.cards) {
			card.bg.setScale(scaleFactor);
			card.text.setFontSize(Math.round(8 * scaleFactor));
			card.text.setWordWrapWidth(card.bg.width * scaleFactor * 0.8);
			card.container.setScale(1);

			this.updateSingleCardPosition(card);
		}
	}

	private updateSingleCardPosition(card: CardData) {
		const cx = this.scale.width / 2;
		const cy = this.scale.height / 2;

		card.container.x = cx + (card.nx - 0.5) * this.gameSize;
		card.container.y = cy + (card.ny - 0.5) * this.gameSize;
	}
}
