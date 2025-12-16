import Phaser from "phaser";

export default class CoffeeScene extends Phaser.Scene {
	constructor() {
		super({ key: "CoffeeScene" });
	}

	preload(): void {}

	create(): void {
		const card = this.add.text(400, 300, "A thought card", {
			fontSize: "20px",
			backgroundColor: "#ffffff",
			color: "#000000",
			padding: { x: 12, y: 8 }
		});

		card.setInteractive({ draggable: true });
		this.input.setDraggable(card);

		this.input.on("drag", (_pointer, gameObject, x, y) => {
			gameObject.x = x;
			gameObject.y = y;
		});
	}

	update(): void {}
}
