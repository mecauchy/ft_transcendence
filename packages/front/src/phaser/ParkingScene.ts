import Phaser from "phaser";
import Popup from "./ui/Popup";

export default class ParkingScene extends Phaser.Scene {
	private readonly BASE_SIZE = 600;


	private bg!: Phaser.GameObjects.Image;
	private breathe_circle!: Phaser.GameObjects.Arc;
	private breathe_text!: Phaser.GameObjects.Text;

	private game_started: boolean = false;

	private popup!: Popup;

	constructor() {
		super("ParkingScene");
	}

	preload() {
		this.load.image("parking_bg", "assets/parking/ParkingBg.png");
	}

	create() {
		this.bg = this.add.image(0, 0, "parking_bg").setOrigin(0.5);

		this.popup = new Popup(this);

		if (!this.game_started) {
			this.popup.show(
				"You have parked your car. Now, breathe. Press ESC to go back.",
				[
					{
						label: "Got it",
						onClick: () => {
							this.popup.hide();
							this.game_started = true;
							this.breathe_exercise();
						},
					},
				]
			);
		}
		this.centerScene();

		this.scale.on("resize", this.onResize, this);
		this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.scale.off("resize", this.onResize, this);
		});
		//wait if not true
		const keyboard = this.input.keyboard;
		if (!keyboard) return;
		keyboard.once("keydown-ESC", () => {
			this.scene.start("WorldMapScene");
			this.popup.destroy();
		});
	}

	private breathe_exercise() {
		// Placeholder for breathe exercise logic
		const cx = Math.round(this.scale.width / 2);
		const cy = Math.round(this.scale.height / 2);
		this.breathe_circle = this.add.circle(cx, cy, 60, 0x88cffa)

		this.breathe_text = this.add.text(cx, cy, "Inspire", {fontSize: "24px", color: "#ffffff"}).setOrigin(0.5);

		const breatheIn = () => {
			this.breathe_text.setText("Inspire");

			this.tweens.add({
				targets: this.breathe_circle,
				radius: 120,
				duration: 4000,
				ease: "Sine.easeInOut",
				onComplete: () => hold(true)
			});
		};

		const hold = (expire: boolean) => {
			this.breathe_text.setText("Hold");
			this.time.delayedCall(2000, expire ? breatheOut : breatheIn);
		};

		const breatheOut = () => {
			this.breathe_text.setText("Expire");

			this.tweens.add({
				targets: this.breathe_circle,
				radius: 60,
				duration: 6000,
				ease: "Sine.easeInOut",
				onComplete: () => hold(false)
			});
		};

		breatheIn();
	}

	private onResize() {
		if (!this.scene.isActive()) return;
		this.centerScene();
	}

	private centerScene() {
		const size = Math.min(this.scale.width, this.scale.height);
		const cx = Math.round(this.scale.width / 2);
		const cy = Math.round(this.scale.height / 2);

		this.bg.setDisplaySize(size, size);
		this.bg.setPosition(
			cx,
			cy
		)
		if (this.breathe_circle && this.breathe_text) {
			this.breathe_circle.setPosition(cx, cy);
			this.breathe_text.setPosition(cx, cy);
		}
	}
}
