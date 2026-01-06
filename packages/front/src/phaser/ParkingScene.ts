import Phaser from "phaser";
import Popup from "./ui/Popup";
import BackButton from "./ui/BackButton";
import { t } from "./i18nHelper";
import { api } from "../api/client";

export default class ParkingScene extends Phaser.Scene {
	private readonly BASE_SIZE = 600;


	private bg!: Phaser.GameObjects.Image;
	private breathe_circle!: Phaser.GameObjects.Arc;
	private breathe_text!: Phaser.GameObjects.Text;

	private game_started: boolean = false;
	private session_start_time: number | null = null;

	private popup!: Popup;
	private BackButton!: BackButton;

	constructor() {
		super("ParkingScene");
	}

	preload() {
		this.load.image("parking_bg", "assets/parking/ParkingBg.png");
	}

	create() {
		this.bg = this.add.image(0, 0, "parking_bg").setOrigin(0.5);

		this.popup = new Popup(this);
		this.backButton = new BackButton(this, async () => {
			if (this.session_start_time !== null) {
				await this.sendBreatheStats();
			}
			this.backButton?.destroy();
			this.popup.destroy();
			this.scene.start("WorldMapScene");
		});

		if (!this.game_started) {
			this.popup.show(
				t("scenes.parking.welcome"),
				[
					{
						label: t("scenes.parking.gotIt"),
						onClick: () => {
							this.popup.hide();
							this.game_started = true;
							this.session_start_time = Date.now();
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
		keyboard.once("keydown-ESC", async () => {
			// if a session is started await sending breathe stats before reloading
			if (this.session_start_time !== null) {
				await this.sendBreatheStats();
			}
			this.scene.start("WorldMapScene");
			this.popup.destroy();
		});
	}

	private breathe_exercise() {
		// Placeholder for breathe exercise logic
		const cx = Math.round(this.scale.width / 2);
		const cy = Math.round(this.scale.height / 2);
		this.breathe_circle = this.add.circle(cx, cy, 60, 0x88cffa)

		this.breathe_text = this.add.text(cx, cy, t("scenes.parking.inspire"), {fontSize: "24px", color: "#ffffff"}).setOrigin(0.5);

		const breatheIn = () => {
			this.breathe_text.setText(t("scenes.parking.inspire"));

			this.tweens.add({
				targets: this.breathe_circle,
				radius: 120,
				duration: 4000,
				ease: "Sine.easeInOut",
				onComplete: () => hold(true)
			});
		};

		const hold = (expire: boolean) => {
			this.breathe_text.setText(t("scenes.parking.hold"));
			this.time.delayedCall(2000, expire ? breatheOut : breatheIn);
		};

		const breatheOut = () => {
			this.breathe_text.setText(t("scenes.parking.expire"));

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

	private async sendBreatheStats(): Promise<void> {
		if (this.session_start_time === null) return;

		try {
			const payload = {
				playerid: "",
				timestamp1: new Date(this.session_start_time).toISOString(),
				timestamp2: new Date().toISOString(),
			};

			await api.sendBreathe(payload);
			console.log('Breathe session saved successfully');

			const sessionDurationMs = Date.now() - this.session_start_time;
			const sessionDurationMinutes = sessionDurationMs / (1000 * 60);
			const stressReduction = sessionDurationMinutes * 2.5;

			if (stressReduction > 0) {
				try {
					const profile = await api.getProfile();
					const currentStress = profile.stressLevel ?? 50;
					const newStress = Math.max(0, currentStress - stressReduction);

					await api.updateProfile({
						stressLevel: Math.round(newStress),
					});
					console.log(`Breathe session: reduced stress by ${stressReduction.toFixed(1)} (${currentStress} -> ${Math.round(newStress)})`);
				} catch (e) {
					console.error('Failed to update stress level:', e);
				}
			}
		} catch (error) {
			console.error('Failed to save breathe session:', error);
		}
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
