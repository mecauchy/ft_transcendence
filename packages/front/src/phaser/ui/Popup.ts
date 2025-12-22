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

	private destroyed = false;

	constructor(scene: Phaser.Scene) {
		this.scene = scene;

		this.bg = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0.7);
		this.bg.setStrokeStyle(2, 0xffffff);
		this.bg.setOrigin(0.5);

		this.text = scene.add.text(0, 0, "", {
			fontFamily: "GameFont",
			fontSize: "1.25rem",
			color: "#ffffffff",
			align: "center",
			wordWrap: { width: 400 }
		}).setOrigin(0.5);

		this.container = scene.add.container(0, 0, [
			this.bg,
			this.text,
		]);

		this.container.setDepth(1000);
		this.container.setVisible(false);

		this.layout();
		scene.scale.on("resize", this.layout, this);
	}

	/* ---------- PUBLIC API ---------- */

	show(message: string, buttons: PopupButton[]) {
		this.clearButtons();
		this.container.setVisible(true);
		this.typeText(message, 30, () => {
			this.createButtons(buttons);
		});
	}

	hide() {
		this.container.setVisible(false);
	}

	destroy() {
		if (this.destroyed) return;
		this.destroyed = true;
		
		this.scene.scale.off("resize", this.layout, this);
		this.container.destroy(true);
	}

	get visible() {
		return this.container.visible;
	}

	/* ---------- PRIVATE ---------- */

	private layout() {
		if (this.destroyed ||
			!this.bg ||
			!this.bg.geom ||
			!this.text ||
			!this.text.texture ||
			!this.text.texture.source[0]
		) {
			return;
		}
		const width = this.scene.scale.width * 0.8;
		const height = this.scene.scale.height * 0.25;

		this.bg.setSize(width, height);
		this.text.setWordWrapWidth(width * 0.9);

		this.container.setPosition(
			this.scene.scale.width / 2,
			this.scene.scale.height * 0.75
		);
	}

	private typeText(fullText: string, speed = 40, onComplete?: () => void) {
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

	private createButtons(buttons: PopupButton[]) {
		const startY = this.bg.height / 2 - 40;
		const spacing = 150;

		buttons.forEach((btn, i) => {
			const button = this.scene.add.text(
				(-buttons.length / 2 + i + 0.5) * spacing,
				startY,
				btn.label,
				{
					fontFamily: "GameFont",
					fontSize: ".8125rem",
					color: "#ffffaa"
				}
			)
				.setInteractive()
				.on("pointerover", () => button.setScale(1.1))
				.on("pointerout", () => button.setScale(1))
				.on("pointerdown", btn.onClick);

			this.container.add(button);
		});
	}

	private clearButtons() {
		this.container.list
			.filter(obj => obj !== this.bg && obj !== this.text)
			.forEach(obj => obj.destroy());
	}
}
