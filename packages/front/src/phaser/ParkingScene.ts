import Phaser from "phaser";

export default class ParkingScene extends Phaser.Scene {
	constructor() {
		super("ParkingScene");
	}

	create() {
		this.add.text(400, 300, "PARKING LEVEL", {
			fontSize: "32px",
			color: "#ffffff",
		}).setOrigin(0.5);

		const keyboard = this.input.keyboard;
		if (!keyboard) return;
		keyboard.once("keydown-ESC", () => {
			this.scene.start("WorldMapScene");
		});
	}
}
