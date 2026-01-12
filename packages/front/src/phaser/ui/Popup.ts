import Phaser from "phaser";

export type PopupButton = {
	label: string;
	onClick: () => void;
};

export default class Popup {
	private scene: Phaser.Scene;

	private container: Phaser.GameObjects.Container;
	private bg: Phaser.GameObjects.Rectangle;
	private text: Phaser.GameObjects.Text;
	private buttons: Phaser.GameObjects.Text[] = [];

	private destroyed = false;
	private currentMessage = "";
	private currentButtons: PopupButton[] = [];

	constructor(scene: Phaser.Scene) {
		this.scene = scene;

		// Background
		this.bg = scene.add
			.rectangle(0, 0, 10, 10, 0x000000, 0.7)
			.setStrokeStyle(2, 0xffffff)
			.setOrigin(0.5);

		// Text
		this.text = scene.add
			.text(0, 0, "", {
				fontFamily: "GameFont",
				fontSize: "1.25rem",
				color: "#ffffff",
				align: "center",
				wordWrap: {width: 400}
			})
			.setOrigin(0.5, 0);

		// Container
		this.container = scene.add.container(0, 0, [
			this.bg,
			this.text
		]);

		this.container.setDepth(1000);
		this.container.setVisible(false);

		scene.scale.on("resize", this.onResize, this);
	}

	/* ---------- PUBLIC API ---------- */

	show(message:	string, buttons: PopupButton[] = []) {
		this.currentMessage = message;
		this.currentButtons = buttons;

		this.clearButtons();
		this.container.setVisible(true);

		this.layoutForContent(message, buttons);

		this.typeText(message, 30, () => {
			this.createButtons(buttons);
			this.layoutForContent(message, buttons);
		});
	}

	hide() {
		this.container.setVisible(false);
	}

	destroy() {
		if (this.destroyed) return;
		this.destroyed = true;

		this.scene.scale.off("resize", this.onResize, this);
		this.container.destroy(true);
	}

	get visible() {
		return this.container.visible;
	}

	/* ---------- LAYOUT ---------- */

	private layoutForContent(message:	string, buttons: PopupButton[]) {
		const padding = 30;
		const buttonGap = buttons.length ? 30 : 0;
		const buttonsHeight = buttons.length ? 30 : 0;
		const maxWidth = this.scene.scale.width * 0.8;

		this.text.setWordWrapWidth(maxWidth - padding * 2);
		this.text.setText(message);

		const textHeight = this.text.height;

		const totalHeight =
			padding +
			textHeight +
			buttonGap +
			buttonsHeight +
			padding;

		this.bg.setSize(maxWidth, totalHeight);

		this.text.setPosition(
			0,
			-this.bg.height / 2 + padding
		);

		const buttonsY =
			-this.bg.height / 2 +
			padding +
			textHeight +
			buttonGap;

		this.buttons.forEach((btn, i) => {
			const spacing = 150;
			btn.setPosition(
				(-this.buttons.length / 2 + i + 0.5) * spacing,
				buttonsY
			);
		});

		this.container.setPosition(
			this.scene.scale.width / 2,
			this.scene.scale.height * 0.75
		);
	}

	private onResize() {
		if (this.destroyed || !this.container.visible) return;

		this.layoutForContent(
			this.currentMessage,
			this.currentButtons
		);
	}

	/* ---------- BUTTONS ---------- */

	private createButtons(buttons: PopupButton[]) {
		this.buttons = buttons.map(btn => {
			const button = this.scene.add
				.text(0, 0, btn.label, {
					fontFamily: "GameFont",
					fontSize: ".8125rem",
					color: "#ffffaa"
				})
				.setOrigin(0.5)
				.setInteractive()
				.on("pointerover", () => button.setScale(1.1))
				.on("pointerout", () => button.setScale(1))
				.on("pointerdown", btn.onClick);

			this.container.add(button);
			return button;
		});
	}

	private clearButtons() {
		this.buttons.forEach(btn => btn.destroy());
		this.buttons = [];
	}

	/* ---------- TYPEWRITER ---------- */

	private typeText(
		fullText: string,
		speed = 40,
		onComplete?: () => void
	) {
		this.text.setText("");
		let index = 0;

		this.scene.time.addEvent({
			delay: speed,
			repeat: fullText.length - 1,
			callback: () => {
				this.text.text += fullText[index++];
				if (index === fullText.length && onComplete) {
					onComplete();
				}
			}
		});
	}
}