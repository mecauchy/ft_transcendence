import Phaser from "phaser";

export default class HospitalScene extends Phaser.Scene {
	constructor() {
		super("HospitalScene");
	}

	create() {
		this.add.text(400, 300, "HOSPITAL LEVEL", {
			fontSize: "32px",
			color: "#ffffff",
		}).setOrigin(0.5);

		// bouton retour carte
		this.input.keyboard.once("keydown-ESC", () => {
			this.scene.start("WorldMapScene");
		});
	}
}
