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

		this.bg = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0.7)
			.setStrokeStyle(2, 0xffffff)
			.setOrigin(0.5);

		this.text = scene.add.text(0, 0, "", {
			fontFamily: "GameFont",
			fontSize: "1.25rem",
			color: "#ffffffff",
			align: "center",
			wordWrap: { width: 400 }
		}).setOrigin(0.5, 0);

		this.container = scene.add.container(0, 0, [
			this.bg,
			this.text
		]);

		this.container.setDepth(1000);
		this.container.setVisible(false);

		this.layout();
		scene.scale.on("resize", this.layout, this);
	}

	private prepareLayout(fullText: string, buttons: PopupButton[]) {
		const padding = 30;
		const buttonGap = 30;
		const buttonsHeight = buttons.length ? 30 : 0;

		this.text.setText(fullText);
		this.text.setWordWrapWidth(this.scene.scale.width * 0.8 - padding * 2);

		const textHeight = this.text.height;

		const totalHeight =
			padding +
			textHeight +
			buttonGap +
			buttonsHeight +
			padding;

		this.bg.setSize(
			this.scene.scale.width * 0.8,
			totalHeight
		);

		this.text.setText("");
		this.text.setPosition(
			0,
			-this.bg.height / 2 + padding
		);
	}

	show(message: string, buttons: PopupButton[]) {
		this.clearButtons();
		this.container.setVisible(true);
		this.prepareLayout(message, buttons);
		this.typeText(message, 30, () => {
			this.layoutWithContent(buttons);
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

	private layout() {
		if (this.destroyed) return;

		const width = this.scene.scale.width * 0.8;
		this.bg.setSize(width, this.bg.height);
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

	private layoutWithContent(buttons: PopupButton[]) {
		const padding = 30;
		const buttonGap = 30;
		const spacingX = 150;

		const textHeight = this.text.height;
		const buttonsHeight = buttons.length ? 30 : 0;

		const totalHeight =
			padding +
			textHeight +
			buttonGap +
			buttonsHeight +
			padding;

		this.bg.setSize(
			this.scene.scale.width * 0.8,
			totalHeight
		);

		this.text.setPosition(
			0,
			-this.bg.height / 2 + padding
		);

		const buttonsY =
			-this.bg.height / 2 +
			padding +
			textHeight +
			buttonGap;

		buttons.forEach((btn, i) => {
			const button = this.scene.add.text(
				(-buttons.length / 2 + i + 0.5) * spacingX,
				buttonsY,
				btn.label,
				{
					fontFamily: "GameFont",
					fontSize: ".8125rem",
					color: "#ffffaa"
				}
			)
				.setOrigin(0.5)
				.setInteractive()
				.on("pointerover", () => button.setScale(1.1))
				.on("pointerout", () => button.setScale(1))
				.on("pointerdown", btn.onClick);

			this.container.add(button);
		});

		this.container.setPosition(
			this.scene.scale.width / 2,
			this.scene.scale.height * 0.75
		);
	}

	private clearButtons() {
		this.container.list
			.filter(o => o !== this.bg && o !== this.text)
			.forEach(o => o.destroy());
	}
}
