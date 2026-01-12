import Phaser from "phaser";
import { t } from "../i18nHelper";

export default class BackButton {
	private scene: Phaser.Scene;
	private container: Phaser.GameObjects.Container;
	private bg: Phaser.GameObjects.Rectangle;
	private text: Phaser.GameObjects.Text;
	private destroyed = false;

	constructor(scene: Phaser.Scene, onBack: () => void) {
		this.scene = scene;

		// text first to measure it
		this.text = scene.add
			.text(0, 0, `← ${t("common.back")}`, {
				fontFamily: "GameFont",
				fontSize: "14px",
				color: "#ffffff",
				align: "center",
			})
			.setOrigin(0.5);

		// bg sized to fit text with padding
		const textWidth = this.text.width;
		const bgWidth = Math.max(80, textWidth + 20); // minimum 80px, or text width + padding
		this.bg = scene.add
			.rectangle(0, 0, bgWidth, 36, 0x000000, 0.7)
			.setStrokeStyle(2, 0xffffff)
			.setOrigin(0.5);

		this.container = scene.add.container(0, 0, [this.bg, this.text]);
		this.container.setDepth(999);

		this.bg.setInteractive({ useHandCursor: true });
		this.bg.on("pointerover", () => {
			this.bg.setFillStyle(0x333333, 0.9);
		});
		this.bg.on("pointerout", () => {
			this.bg.setFillStyle(0x000000, 0.7);
		});
		this.bg.on("pointerdown", () => {
			onBack();
		});

		this.updatePosition();

		scene.scale.on("resize", this.onResize, this);
	}

	private onResize = () => {
		if (this.destroyed) return;
		this.updatePosition();
	};

	private updatePosition() {
		const padding = 15;
		this.container.setPosition(padding + 40, padding + 18);
	}

	destroy() {
		if (this.destroyed) return;
		this.destroyed = true;
		this.scene.scale.off("resize", this.onResize, this);
		this.container.destroy(true);
	}

	setVisible(visible: boolean) {
		this.container.setVisible(visible);
	}

	get visible() {
		return this.container.visible;
	}
}
