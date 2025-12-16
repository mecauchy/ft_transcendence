import Phaser from "phaser";

export default class HouseScene extends Phaser.Scene {
	constructor() {
		super("HouseScene");
	}

	create() {
		this.add.text(400, 300, "HOUSE LEVEL", {
			fontSize: "32px",
			color: "#ffffff",
		}).setOrigin(0.5);

		// bouton retour carte
		this.input.keyboard.once("keydown-ESC", () => {
			this.scene.start("WorldMapScene");
		});
	}
}
