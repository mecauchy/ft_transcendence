import Phaser from "phaser";

export default class WorldMapScene extends Phaser.Scene {
	private player!: Phaser.GameObjects.Sprite;
	private bg!: Phaser.GameObjects.Image;

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

	private popupContainer!: Phaser.GameObjects.Container;
	private popupBg!: Phaser.GameObjects.Rectangle;
	private popupText!: Phaser.GameObjects.Text;

	// Normalized player position (0–1)
	private playerNX = 0.5;
	private playerNY = 0.5;

	private basePlayerScale = 0.3;

	// Normalized building positions
	private posShop = { x: 0.28, y: 0.34 };
	private posHospital = { x: 0.09, y: 0.32 };
	private posHouse = { x: 0.7, y: 0.19 };
	private posParking = { x: 0.72, y: 0.74 };
	private posCoffee = { x: 0.7, y: 0.58 };

	private waypoints = {
		shop: { x: 0.25, y: 0.49 },
		hospital: { x: 0.1, y: 0.49 },
		house: { x: 0.7, y: 0.31 },
		parking: { x: 0.79, y: 0.75 },
		coffee: { x: 0.663, y: 0.73 },
		center: { x: 0.5, y: 0.5 },
		street: { x: 0.82, y: 0.4 },
	}

	private routes: Record<string, Array<{ x: number; y: number }>> = {
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

	private moveQueue: Array<{ x: number; y: number }> = [];
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

		this.shopLabel = this.add.text(0, 0, "Shop", { fontFamily: 'GameFont', fontSize: '16px', color: '#ffffffff' });
		this.hospitalLabel = this.add.text(0, 0, "Hospital", { fontFamily: 'GameFont', fontSize: '16px', color: '#ffffffff' });
		this.houseLabel = this.add.text(0, 0, "House", { fontFamily: 'GameFont', fontSize: '16px', color: '#ffffffff' });
		this.parkingLabel = this.add.text(0, 0, "Parking", { fontFamily: 'GameFont', fontSize: '16px', color: '#ffffffff' });
		this.coffeeLabel = this.add.text(0, 0, "Coffee", { fontFamily: 'GameFont', fontSize: '16px', color: '#ffffffff' });

		this.createPopup();
		this.centerScene();


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
		if (this.popupContainer && this.popupBg && this.popupText) {
			this.layoutPopup();
		}
	}

	private createPopup() {

		this.popupBg = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.7);
		this.popupBg.setStrokeStyle(2, 0xffffff);
		this.popupBg.setOrigin(0.5);
		
		this.popupText = this.add.text(0, 0, "Welcome to the World Map!", {
			fontFamily: 'GameFont',
			fontSize: '20px',
			color: '#ffffffff',
			align: 'center',
		})
		.setOrigin(0.5)
		
		this.popupContainer = this.add.container(0, 0, [this.popupBg, this.popupText]);
		this.popupContainer.setDepth(1000);
		this.popupContainer.setVisible(false);
		this.layoutPopup();
	}

	private typeText(fullText: string, speed: number = 50, onComplete?: () => void) {
		this.popupText.setText("");
		let index = 0;

		this.time.addEvent({
			delay: speed,
			repeat: fullText.length - 1,
			callback: () => {
				this.popupText.text += fullText[index];
				index++;

				if (index === fullText.length && onComplete) {
						onComplete();
				}
			}
		});
	}

	private createPopupButton(
		label: string,
		x: number,
		y: number,
		callback : () => void
	) {
		const button = this.add.text(x, y, label, {
			fontFamily: 'GameFont',
			fontSize: '18px',
			color: "#ffffaa"
		})
		.setInteractive()
		.on("pointerover", () => button.setScale(1.1))
		.on("pointerout", () => button.setScale(1.0))
		.on("pointerdown", callback);

		this.popupContainer.add(button);
	}

	private showPopup(
		text: string,
		buttons: { label: string; onClick: () => void }[]
	) {
		this.popupContainer.setVisible(true);
		this.popupText.setText("");

		this.popupContainer.list
			.filter(obj => obj !== this.popupBg && obj !== this.popupText)
			.forEach(obj => obj.destroy());

		this.typeText(text, 30, () => {
			const startY = this.popupBg.height / 2 - 40;
			const spacing = 140;

			buttons.forEach((btn, i) => {
				this.createPopupButton(
					btn.label,
					(-buttons.length / 2 + i + 0.5) * spacing,
					startY,
					btn.onClick
				);
			});
		});
	}


	// Places a building using normalized coordinates relative to the map
	private placeBuilding(
		sprite: Phaser.GameObjects.Sprite,
		pos: { x: number; y: number },
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
			if (this.isMoving || this.popupContainer.visible) return;
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
		this.anims.create({
			key: "nurse-down",
			frames: [
				{ key: "nurse-down-1" },
				{ key: "nurse-down-2" },
				{ key: "nurse-down-3" },
				{ key: "nurse-down-4" },
				{ key: "nurse-down-5" },
				{ key: "nurse-down-6" },
				{ key: "nurse-down-7" },
				{ key: "nurse-down-8" },
			],
			frameRate: 8,
			repeat: -1,
		});

		this.anims.create({
			key: "nurse-left",
			frames: [
				{ key: "nurse-left-1" },
				{ key: "nurse-left-2" },
				{ key: "nurse-left-3" },
				{ key: "nurse-left-4" },
				{ key: "nurse-left-5" },
				{ key: "nurse-left-6" },
				{ key: "nurse-left-7" },
				{ key: "nurse-left-8" },
			],
			frameRate: 8,
			repeat: -1,
		});

		this.anims.create({
			key: "nurse-right",
			frames: [
				{ key: "nurse-right-1" },
				{ key: "nurse-right-2" },
				{ key: "nurse-right-3" },
				{ key: "nurse-right-4" },
				{ key: "nurse-right-5" },
				{ key: "nurse-right-6" },
				{ key: "nurse-right-7" },
				{ key: "nurse-right-8" },
			],
			frameRate: 8,
			repeat: -1,
		});

		this.anims.create({
			key: "nurse-up",
			frames: [
				{ key: "nurse-up-1" },
				{ key: "nurse-up-2" },
				{ key: "nurse-up-3" },
				{ key: "nurse-up-4" },
				{ key: "nurse-up-5" },
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

		// this.makeAllInteractiveBuildings();
	}

	private layoutPopup() {
		const width = this.scale.width * 0.8;
		const height = this.scale.height * 0.25;

		this.popupBg.setSize(width, height);
		this.popupText.setWordWrapWidth(width * 0.9);
		this.popupContainer.setPosition(0, -height * 0.2);

		this.popupContainer.setPosition(this.scale.width / 2, this.scale.height * 0.75);
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

	private goPopup(target: { x: number; y: number }) {
		let locationName = "";
		if (target === this.waypoints.shop) locationName = "Shop";
		else if (target === this.waypoints.hospital) locationName = "Hospital";
		else if (target === this.waypoints.house) locationName = "House";
		else if (target === this.waypoints.parking) locationName = "Parking";
		else if (target === this.waypoints.coffee) locationName = "Coffee";

		if (locationName === "") return;
		
		this.showPopup(
			`You have arrived at the ${locationName}. What would you like to do?`,
			[
				{
					label: "Enter",
					onClick: () => {
						console.log(`Entering the ${locationName}...`);
						this.popupContainer.setVisible(false);
						this.scene.start(`${locationName}Scene`);
						this.moveToCenter();
					},
				},
				{
					label: "Leave",
					onClick: () => {
						console.log(`Leaving the ${locationName}...`);
						this.popupContainer.setVisible(false);
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

	update(_: any, delta: number) {
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
