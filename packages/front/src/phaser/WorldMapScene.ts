import Phaser from "phaser";
import Popup from "./ui/Popup";
import { t } from "./i18nHelper";
import {api} from "../api"

export default class WorldMapScene extends Phaser.Scene {
	private player!: Phaser.GameObjects.Sprite;
	private bg!: Phaser.GameObjects.Image;

	private popup!: Popup;

	private shop!: Phaser.GameObjects.Sprite;
	private hospital!: Phaser.GameObjects.Sprite;
	private house!: Phaser.GameObjects.Sprite;
	private parking!: Phaser.GameObjects.Sprite;
	private coffee!: Phaser.GameObjects.Sprite;
	private shopLabel!: Phaser.GameObjects.Text;
	private hospitalLabel!: Phaser.GameObjects.Text;
	private houseLabel!: Phaser.GameObjects.Text;
	private parkingLabel!: Phaser.GameObjects.Text;
	private coffeeLabel!: Phaser.GameObjects.Text;

	// meters
	private stressMeterBg!: Phaser.GameObjects.Rectangle;
	private stressMeterFill!: Phaser.GameObjects.Rectangle;
	private stressMeterLabel!: Phaser.GameObjects.Text;
	private confidenceMeterBg!: Phaser.GameObjects.Rectangle;
	private confidenceMeterFill!: Phaser.GameObjects.Rectangle;
	private confidenceMeterLabel!: Phaser.GameObjects.Text;
	private stressValue: number = 50;
	private confidenceValue: number = 50;

	// Normalized player position (0–1)
	private playerNX = 0.5;
	private playerNY = 0.5;

	private basePlayerScale = 0.3;

	// Normalized building positions
	private posShop = {x: 0.28, y: 0.34};
	private posHospital = {x: 0.09, y: 0.32};
	private posHouse = {x: 0.7, y: 0.19};
	private posParking = {x: 0.72, y: 0.74};
	private posCoffee = {x: 0.7, y: 0.58};

	private waypoints = {
		shop: {x: 0.25, y: 0.49},
		hospital: {x: 0.1, y: 0.49},
		house: {x: 0.7, y: 0.31},
		parking: {x: 0.79, y: 0.75},
		coffee: {x: 0.663, y: 0.73},
		center: {x: 0.5, y: 0.5},
		street: {x: 0.82, y: 0.4},
	}

	private routes: Record<string, Array<{x: number; y: number}>> = {
		shop: [
			this.waypoints.center,
			this.waypoints.shop,
		],
		hospital: [
			this.waypoints.center,
			this.waypoints.hospital,
		],
		house: [
			this.waypoints.center,
			this.waypoints.house,
		],
		parking: [
			this.waypoints.center,
			this.waypoints.street,
			this.waypoints.parking,
		],
		coffee: [
			this.waypoints.center,
			this.waypoints.street,
			this.waypoints.parking,
			this.waypoints.coffee,
		],
	};

	private moveQueue: Array<{x: number; y: number}> = [];
	private isMoving = false;
	private moveSpeed = 0.25;

	constructor() {
		super("WorldMapScene");
	}

	preload() {
		this.load.image("map", "/assets/map.png");
		this.load.image("shop", "/assets/buildings/shop.png");
		this.load.image("hospital", "/assets/buildings/hospital.png");
		this.load.image("house", "/assets/buildings/house.png");
		this.load.image("parking", "/assets/buildings/parking.png");
		this.load.image("coffee", "/assets/buildings/coffee.png");
		for (let i = 1; i <= 8; i++) {
			if (i <= 5) {
				this.load.image(`nurse-up-${i}`, `/assets/nurse/nurse_up/nurseu${i}.png`);
			}
			this.load.image(`nurse-down-${i}`, `/assets/nurse/nurse_down/nursed${i}.png`);
			this.load.image(`nurse-left-${i}`, `/assets/nurse/nurse_left/nursel${i}.png`);
			this.load.image(`nurse-right-${i}`, `/assets/nurse/nurse_right/nurser${i}.png`);
		}
		this.load.once('complete', () => {
			const font = new FontFace(
				'GameFont',
				'url(/assets/fonts/game.ttf)'
			);

			font.load().then((loadedFont) => {
				document.fonts.add(loadedFont);
			});
		});
	}

	create() {
		this.bg = this.add.image(0, 0, "map").setOrigin(0.5);
		this.player = this.add.sprite(0, 0, "nurse-down-1");

		this.shop = this.add.sprite(0, 0, "shop");
		this.hospital = this.add.sprite(0, 0, "hospital");
		this.house = this.add.sprite(0, 0, "house");
		this.parking = this.add.sprite(0, 0, "parking");
		this.coffee = this.add.sprite(0, 0, "coffee");

		this.shopLabel = this.add.text(0, 0, t("scenes.worldMap.shop"), {fontFamily: 'GameFont', fontSize: '16px', color: '#ffffffff'});
		this.hospitalLabel = this.add.text(0, 0, t("scenes.worldMap.hospital"), {fontFamily: 'GameFont', fontSize: '16px', color: '#ffffffff'});
		this.houseLabel = this.add.text(0, 0, t("scenes.worldMap.house"), {fontFamily: 'GameFont', fontSize: '16px', color: '#ffffffff'});
		this.parkingLabel = this.add.text(0, 0, t("scenes.worldMap.parking"), {fontFamily: 'GameFont', fontSize: '16px', color: '#ffffffff'});
		this.coffeeLabel = this.add.text(0, 0, t("scenes.worldMap.coffee"), {fontFamily: 'GameFont', fontSize: '16px', color: '#ffffffff'});

		// create the meters
		this.createMeters();
		
		this.popup = new Popup(this);
		this.centerScene();

		// fetch initial values
		this.fetchStressConfidence();


		this.scale.on("resize", this.onResize, this);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.scale.off("resize", this.onResize, this);
		});
		this.createNurseAnimations();
		const canvas = this.game.canvas;
		canvas.style.cursor = 'url("/assets/cursor.png"), auto';
		this.makeAllInteractiveBuildings();
		this.shop.setData("label", this.shopLabel);
		this.hospital.setData("label", this.hospitalLabel);
		this.house.setData("label", this.houseLabel);
		this.parking.setData("label", this.parkingLabel);
		this.coffee.setData("label", this.coffeeLabel);
	}

	private onResize() {
		if (!this.scene.isActive()) return;
		if (!this.player || !this.bg) return;	
		this.centerScene();
	}

	// Places a building using normalized coordinates relative to the map
	private placeBuilding(
		sprite: Phaser.GameObjects.Sprite,
		pos: {x: number; y: number},
		size: number
	) {
		sprite.x = this.bg.x + (pos.x - 0.5) * size;
		sprite.y = this.bg.y + (pos.y - 0.5) * size;

		const baseScale = 0.6 * (size / 600);
		sprite.setScale(baseScale);

		// Store base scale for hover animations
		sprite.setData("baseScale", baseScale);
	}

	private placeLabel(
		label: Phaser.GameObjects.Text,
		target: Phaser.GameObjects.Sprite,
		size: number,
		offsetY: number = 20,
		offsetX: number = 0
	) {
		const scaleFactor = size / 600;
		label.setOrigin(0.5, 1);
		label.x = target.x;
		label.y = target.y - offsetY * scaleFactor;
		label.setFontSize(16 * scaleFactor);
		if (offsetX !== 0) {
			label.x += offsetX * scaleFactor;
		}
		label.setScale(1);
		label.setData("baseScale", 1);
	}

	// Adds a safe hover animation that cannot desync
	private makeInteractiveBuilding(sprite: Phaser.GameObjects.Sprite) {
		sprite.setInteractive();

		const label = sprite.getData("label") as Phaser.GameObjects.Text | undefined;

		sprite.on("pointerover", () => {
			const baseScale = sprite.getData("baseScale");
			const labelBaseScale = label?.getData("baseScale") ?? 1;

			sprite.clearTint();
			this.tweens.killTweensOf(sprite);
			if (label) this.tweens.killTweensOf(label);

			this.tweens.add({
				targets: sprite,
				scale: baseScale * 1.15,
				duration: 120,
				ease: "Power1",
			});

			if (label) {
				this.tweens.add({
					targets: label,
					scale: labelBaseScale * 1.15,
					duration: 120,
					ease: "Power1",
				});
			}

			sprite.setTint(0xffffcc);
		});

		sprite.on("pointerout", () => {
			const baseScale = sprite.getData("baseScale");
			const labelBaseScale = label?.getData("baseScale") ?? 1;

			this.tweens.killTweensOf(sprite);
			if (label) this.tweens.killTweensOf(label);

			this.tweens.add({
				targets: sprite,
				scale: baseScale,
				duration: 120,
				ease: "Power1",
			});

			if (label) {
				this.tweens.add({
					targets: label,
					scale: labelBaseScale,
					duration: 120,
					ease: "Power1",
				});
			}

			sprite.clearTint();
		});

		sprite.on("pointerdown", () => {
			if (this.isMoving || this.popup.visible) return;
			console.log(`Clicked on ${sprite.texture.key}`);
			const destinationKey = sprite.texture.key;
			this.moveTo(destinationKey);
		});
	}

	private moveTo(destination: keyof typeof this.routes) {
		if (this.isMoving) return;

		this.moveQueue = [...this.routes[destination]];
		this.isMoving = true;
	}

	private createNurseAnimations() {
		// fixes warnings for animations
		if (this.anims.exists('nurse-down')) return;

		this.anims.create({
			key: "nurse-down",
			frames: [
				{key: "nurse-down-1"},
				{key: "nurse-down-2"},
				{key: "nurse-down-3"},
				{key: "nurse-down-4"},
				{key: "nurse-down-5"},
				{key: "nurse-down-6"},
				{key: "nurse-down-7"},
				{key: "nurse-down-8"},
			],
			frameRate: 8,
			repeat: -1,
		});

		this.anims.create({
			key: "nurse-left",
			frames: [
				{key: "nurse-left-1"},
				{key: "nurse-left-2"},
				{key: "nurse-left-3"},
				{key: "nurse-left-4"},
				{key: "nurse-left-5"},
				{key: "nurse-left-6"},
				{key: "nurse-left-7"},
				{key: "nurse-left-8"},
			],
			frameRate: 8,
			repeat: -1,
		});

		this.anims.create({
			key: "nurse-right",
			frames: [
				{key: "nurse-right-1"},
				{key: "nurse-right-2"},
				{key: "nurse-right-3"},
				{key: "nurse-right-4"},
				{key: "nurse-right-5"},
				{key: "nurse-right-6"},
				{key: "nurse-right-7"},
				{key: "nurse-right-8"},
			],
			frameRate: 8,
			repeat: -1,
		});

		this.anims.create({
			key: "nurse-up",
			frames: [
				{key: "nurse-up-1"},
				{key: "nurse-up-2"},
				{key: "nurse-up-3"},
				{key: "nurse-up-4"},
				{key: "nurse-up-5"},
			],
			frameRate: 8,
			repeat: -1,
		});
	}

	private placeAllLabels(size: number) {
		this.placeLabel(this.shopLabel, this.shop, size, 85);
		this.placeLabel(this.hospitalLabel, this.hospital, size, 90, 15);
		this.placeLabel(this.houseLabel, this.house, size, 55);
		this.placeLabel(this.parkingLabel, this.parking, size, 25);
		this.placeLabel(this.coffeeLabel, this.coffee, size, 60);
	}

	private placeAllBuildings(size: number) {
		this.placeBuilding(this.shop, this.posShop, size);
		this.placeBuilding(this.hospital, this.posHospital, size);
		this.placeBuilding(this.house, this.posHouse, size);
		this.placeBuilding(this.parking, this.posParking, size);
		this.placeBuilding(this.coffee, this.posCoffee, size,);
	}

	private makeAllInteractiveBuildings() {
		this.makeInteractiveBuilding(this.shop);
		this.makeInteractiveBuilding(this.hospital);
		this.makeInteractiveBuilding(this.house);
		this.makeInteractiveBuilding(this.parking);
		this.makeInteractiveBuilding(this.coffee);
	}

	private createMeters() {
		const meterWidth = 100;
		const meterHeight = 14;
		
		// stress meter
		this.stressMeterBg = this.add.rectangle(0, 0, meterWidth, meterHeight, 0x333333);
		this.stressMeterBg.setOrigin(0, 0.5);
		this.stressMeterFill = this.add.rectangle(0, 0, meterWidth * (this.stressValue / 100), meterHeight - 4, 0xff4444);
		this.stressMeterFill.setOrigin(0, 0.5);
		this.stressMeterLabel = this.add.text(0, 0, t("common.stress") + ":", {
			fontSize: '12px',
			color: '#ffffff',
		});
		this.stressMeterLabel.setOrigin(1, 0.5);

		// confidence meter
		this.confidenceMeterBg = this.add.rectangle(0, 0, meterWidth, meterHeight, 0x333333);
		this.confidenceMeterBg.setOrigin(0, 0.5);
		this.confidenceMeterFill = this.add.rectangle(0, 0, meterWidth * (this.confidenceValue / 100), meterHeight - 4, 0x44cc44);
		this.confidenceMeterFill.setOrigin(0, 0.5);
		this.confidenceMeterLabel = this.add.text(0, 0, t("common.confidence") + ":", {
			fontSize: '12px',
			color: '#ffffff',
		});
		this.confidenceMeterLabel.setOrigin(1, 0.5);

		this.stressMeterBg.setDepth(100);
		this.stressMeterFill.setDepth(101);
		this.stressMeterLabel.setDepth(100);
		this.confidenceMeterBg.setDepth(100);
		this.confidenceMeterFill.setDepth(101);
		this.confidenceMeterLabel.setDepth(100);
	}

	private async fetchStressConfidence(): Promise<void> {
		try {
			const profile = await api.getProfile();
			this.stressValue = profile.stressLevel ?? 50;
			this.confidenceValue = profile.confidenceLevel ?? 50;
			this.updateMeterFills();
		} catch (error) {
			console.error('Failed to fetch stress/confidence:', error);
		}
	}

	private updateMeterFills() {
		const meterWidth = 100;
		// const meterHeight = 14;

		this.stressMeterFill.width = Math.max(2, meterWidth * (this.stressValue / 100));
		this.confidenceMeterFill.width = Math.max(2, meterWidth * (this.confidenceValue / 100));

		// color gradient for stress green to red
		const stressR = Math.floor(255 * (this.stressValue / 100));
		const stressG = Math.floor(255 * (1 - this.stressValue / 100));
		this.stressMeterFill.fillColor = (stressR << 16) | (stressG << 8) | 0x44;

		// color for confidence green to blue
		const confG = Math.floor(150 + 105 * (this.confidenceValue / 100));
		this.confidenceMeterFill.fillColor = (0x44 << 16) | (confG << 8) | 0x44;
	}

	private positionMeters() {
		const padding = 15;
		// const labelGap = 5;
		// const meterWidth = 100;
		const scaleFactor = Math.min(this.scale.width, this.scale.height) / 600;

		const scale = Math.max(0.8, Math.min(1.5, scaleFactor));

		const stressY = padding + 15;
		this.stressMeterLabel.setPosition(padding + 60 * scale, stressY);
		this.stressMeterLabel.setScale(scale);
		this.stressMeterBg.setPosition(padding + 65 * scale, stressY);
		this.stressMeterBg.setScale(scale);
		this.stressMeterFill.setPosition(padding + 67 * scale, stressY);
		this.stressMeterFill.setScale(scale);
		
		// Position confidence meter below stress
		const confidenceY = stressY + 22 * scale;
		this.confidenceMeterLabel.setPosition(padding + 60 * scale, confidenceY);
		this.confidenceMeterLabel.setScale(scale);
		this.confidenceMeterBg.setPosition(padding + 65 * scale, confidenceY);
		this.confidenceMeterBg.setScale(scale);
		this.confidenceMeterFill.setPosition(padding + 67 * scale, confidenceY);
		this.confidenceMeterFill.setScale(scale);
	}

	// Recomputes layout when screen size or player position changes
	centerScene() {
		const size = Math.min(this.scale.width, this.scale.height);

		this.bg.setDisplaySize(size, size);
		this.bg.setPosition(this.scale.width / 2, this.scale.height / 2);

		const playerScale = this.basePlayerScale * (size / 600);
		this.player.setScale(playerScale);

		this.player.x = this.bg.x + (this.playerNX - 0.5) * size;
		this.player.y = this.bg.y + (this.playerNY - 0.5) * size;

		this.placeAllBuildings(size);

		this.placeAllLabels(size);

		// Position stress/confidence meters
		this.positionMeters();

		// this.makeAllInteractiveBuildings();
	}


	private playWalkAnimation(dx: number, dy: number) {
		if (Math.abs(dx) > Math.abs(dy)) {
			// Moving horizontally
			if (dx > 0) {
				this.player.anims.play("nurse-right", true);
			} else {
				this.player.anims.play("nurse-left", true);
			}
		} else {
			// Moving vertically
			if (dy > 0) {
				this.player.anims.play("nurse-down", true);
			} else {
				this.player.anims.play("nurse-up", true);
			}
		}
	}

	private showHospitalWarning(locationName: string) {
		const translatedLocation = t(`scenes.worldMap.${locationName.toLowerCase()}`);
		this.popup.show(
			t("scenes.worldMap.hospitalWarning", { location: translatedLocation }),
			[
				{
					label: t("common.ok"),
					onClick: () => {
						this.popup.hide();
						this.moveToCenter();
					},
				},
			]
		);
	}

	private goPopup(target: {x: number; y: number}) {
		let locationName = "";
		if (target === this.waypoints.shop) locationName = "Shop";
		else if (target === this.waypoints.hospital) locationName = "Hospital";
		else if (target === this.waypoints.house) locationName = "House";
		else if (target === this.waypoints.parking) locationName = "Parking";
		else if (target === this.waypoints.coffee) locationName = "Coffee";

		if (locationName === "") return;

		if (locationName === "Hospital")
		{
			this.fetchStressConfidence();
			if (this.stressValue > 40 || this.confidenceValue < 60) {
				this.showHospitalWarning(locationName);
				return;
			}
		}

		const translatedLocation = t(`scenes.worldMap.${locationName.toLowerCase()}`);
		
		this.popup.show(
			t("scenes.worldMap.arrivedAt", { location: translatedLocation }),
			[
				{
					label: t("common.enter"),
					onClick: () => {
						console.log(`Entering the ${locationName}...`);
						this.popup.hide();
						this.scene.start(`${locationName}Scene`);
						this.moveToCenter();
					},
				},
				{
					label: t("common.leave"),
					onClick: () => {
						console.log(`Leaving the ${locationName}...`);
						this.popup.hide();
						this.moveToCenter();
					},
				},
			]
		);
	}

	private moveToCenter() {
		if (this.isMoving) return;

		const currentPos = Object.keys(this.waypoints).find(key => {
			const wp = this.waypoints[key as keyof typeof this.waypoints];
			return this.playerNX === wp.x && this.playerNY === wp.y;
		});
		this.moveQueue = [...this.routes[currentPos as keyof typeof this.routes]].reverse();
		this.isMoving = true;
	}

	update(_: unknown, delta: number) {
		if (!this.isMoving || this.moveQueue.length === 0) return;
		
		const target = this.moveQueue[0];
		const dt = delta / 1000;
		const dx = target.x - this.playerNX;
		const dy = target.y - this.playerNY;
		const distance = Math.hypot(dx, dy);

		if (distance < this.moveSpeed * dt) {
			// Reached the waypoint
			this.playerNX = target.x;
			this.playerNY = target.y;
			this.moveQueue.shift();
			if (this.moveQueue.length === 0) {
				this.isMoving = false;
				this.player.anims.stop();
				//if the buildgin reached is parking, look left
				if (target === this.waypoints.parking) {
					this.player.setTexture("nurse-left-1");
				}
				else if (target === this.waypoints.center) this.player.setTexture("nurse-down-1");
				else this.player.setTexture("nurse-up-1");
				this.goPopup(target);
			}
		} else {
			this.playerNX += (dx / distance) * this.moveSpeed * dt;
			this.playerNY += (dy / distance) * this.moveSpeed * dt;

			this.playWalkAnimation(dx, dy);
		}
		this.centerScene();
	}
}
