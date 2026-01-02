import Phaser from "phaser";
import Popup from "./ui/Popup";
import { t } from "./i18nHelper";
import { api } from "../api/client";

// item effects on meters
const ITEM_EFFECTS: Record<string, { stress?: number; confidence?: number }> = {
	"anxiety pills": { stress: -10, confidence: -5 },
	"sleeping pills": { stress: -5, confidence: -3 },
	"wine": { confidence: 8, stress: 3 },
	"chocolate": { stress: -3 }, 
	"water": { stress: -2 }, 
	"flower": { stress: -2, confidence: 2 },
	"book": { stress: -3, confidence: 3 },
	"bear": { stress: -4 }, 
	"duck": { stress: -2, confidence: 1 }, 
	"ball": { confidence: 2 },
	"camera": { confidence: 3 },
	"controller": { stress: -2 }, 
	"phone": { stress: 2, confidence: -1 },
	"soap": { stress: -1 },
};

export default class ShopScene extends Phaser.Scene {
	private readonly BASE_SIZE = 600;
	private readonly basket_position = {x: 0.5, y: 0.85};
	

	private bg!: Phaser.GameObjects.Image;

	private game_started: boolean = false;

	private popup!: Popup;

	private popup_active: boolean = true;

	private readonly ITEMS_LAYOUT = [
		{item: "duck", x: 0.1, y: 0.15},
		{item: "ball", x: 0.3, y: 0.15},
		{item: "anxiety pills", x: 0.5, y: 0.15},
		{item: "bear", x: 0.7, y: 0.15},
		{item: "book", x: 0.88, y: 0.15},
		{item: "camera", x: 0.1, y: 0.37},
		{item: "chocolate", x: 0.3, y: 0.37},
		{item: "controller", x: 0.5, y: 0.37},
		{item: "flower", x: 0.7, y: 0.37},
		{item: "phone", x: 0.88, y: 0.37},
		{item: "sleeping pills", x: 0.1, y: 0.57},
		{item: "soap", x: 0.35, y: 0.57},
		{item: "water", x: 0.65, y: 0.57},
		{item: "wine", x: 0.88, y: 0.57},
	];

	private items_picks: string[] = [];

	private items: Record<string, Phaser.GameObjects.Sprite> = {};

	constructor() {
		super("ShopScene");
	}

	preload() {
		this.load.image("shop_bg", "assets/shop/ShopBg.png");
		this.load.image("duck", "assets/shop/duck.png");
		this.load.image("ball", "assets/shop/ball.png");
		this.load.image("anxiety pills", "assets/shop/anxiety.png");
		this.load.image("bear", "assets/shop/bear.png");
		this.load.image("book", "assets/shop/book.png");
		this.load.image("camera", "assets/shop/camera.png");
		this.load.image("chocolate", "assets/shop/chocolate.png");
		this.load.image("controller", "assets/shop/controller.png");
		this.load.image("flower", "assets/shop/flower.png");
		this.load.image("phone", "assets/shop/phone.png");
		this.load.image("sleeping pills", "assets/shop/sleep.png");
		this.load.image("soap", "assets/shop/soap.png");
		this.load.image("water", "assets/shop/water.png");
		this.load.image("wine", "assets/shop/wine.png");
	}

	create() {
		this.bg = this.add.image(0, 0, "shop_bg").setOrigin(0.5);
		this.items.duck = this.add.sprite(0, 0, "duck")
		this.items.ball = this.add.sprite(0, 0, "ball")
		this.items["anxiety pills"] = this.add.sprite(0, 0, "anxiety pills")
		this.items.bear = this.add.sprite(0, 0, "bear")
		this.items.book = this.add.sprite(0, 0, "book")
		this.items.camera = this.add.sprite(0, 0, "camera")
		this.items.chocolate = this.add.sprite(0, 0, "chocolate")
		this.items.controller = this.add.sprite(0, 0, "controller")
		this.items.flower = this.add.sprite(0, 0, "flower")
		this.items.phone = this.add.sprite(0, 0, "phone")
		this.items["sleeping pills"] = this.add.sprite(0, 0, "sleeping pills")
		this.items.soap = this.add.sprite(0, 0, "soap")
		this.items.water = this.add.sprite(0, 0, "water")
		this.items.wine = this.add.sprite(0, 0, "wine")
		this.popup = new Popup(this);
		this.items_picks = [];

		if (!this.game_started) {
			this.popup.show(
				t("scenes.shop.welcome"),
				[
					{
						label: t("scenes.shop.gotIt"),
						onClick: () => {
							this.popup.hide();
							this.game_started = true;
							this.popup_active = false;
						},
					},
				]
			);
		}
		this.centerScene();
		this.makeItemsInteractive();

		this.scale.on("resize", this.onResize, this);
		this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.scale.off("resize", this.onResize, this);
		});
	}

	private makeItemsInteractive() {
		for (const layout of this.ITEMS_LAYOUT) {
			const item = this.items[layout.item];
			if (item) {
				this.makeItemInteractive(item, layout.item);
			}
		}
	}

	private makeItemInteractive(item: Phaser.GameObjects.Sprite, itemName: string) {
		item.setInteractive();
		item.on("pointerover", () => {
			const scale = item.getData("baseScale");
			item.setScale(scale * 1.1);
			item.setTint(0xffffaa);
		});
		item.on("pointerout", () => {
			const scale = item.getData("baseScale");
			item.setScale(scale);
			item.clearTint();
		});
		item.on("pointerdown", () => {
			if (this.popup_active) return;
			this.popup_active = true;
			this.popup.show(
				t("scenes.shop.selectedItem", { item: itemName }),
				[
					{
						label: t("common.buy"),
						onClick: () => {
							this.popup.hide();
							item.setData("picked", true);
							this.tweens.add({
								targets: item,
								x: Math.round(this.scale.width * this.basket_position.x),
								y: Math.round(this.scale.height * this.basket_position.y),
								scale: 0.1,
								alpha: 0.5,
								duration: 800,
								ease: 'Cubic.easeIn',
								onComplete: () => {
									item.setVisible(false);
									this.popup_active = false;
									this.items_picks.push(itemName);
									if (this.items_picks.length >= 3) {
										this.show_purchase_popup();
									}
								}
							});
						},
					},
					{
						label: t("common.cancel"),
						onClick: () => {
							this.popup.hide();
							this.popup_active = false;
						},
					},
				]
			);
		});
	}

	private show_purchase_popup() {
		const items_list = this.items_picks.join(", ");
		if (this.popup_active) return;
		this.popup_active = true;
		this.popup.show(
			t("scenes.shop.purchased", { items: items_list }),
			[
				{
					label: t("common.ok"),
					onClick: () => {
						this.popup.hide();
						this.popup_active = false;
						this.end_shopping();
					},
				},
			]
		);
	}

	private end_shopping() {
		if (this.popup_active) return;
		this.popup_active = true;
		this.applyItemEffects();
		this.popup.show(
			t("common.returningToMap"),
			[
				{
					label: t("common.ok"),
					onClick: () => {
						this.popup.hide();
						this.popup_active = false;
						this.scene.start("WorldMapScene");
					},
				},
			]
		);
	}

	private async applyItemEffects(): Promise<void> {
		try {
			let totalStressChange = 0;
			let totalConfidenceChange = 0;

			for (const item of this.items_picks) {
				const effect = ITEM_EFFECTS[item];
				if (effect) {
					totalStressChange += effect.stress ?? 0;
					totalConfidenceChange += effect.confidence ?? 0;
				}
			}

			if (totalStressChange === 0 && totalConfidenceChange === 0) return;

			// get current profile
			const profile = await api.getProfile();
			const currentStress = profile.stressLevel ?? 50;
			const currentConfidence = profile.confidenceLevel ?? 50;

			// apply changes with clamping
			const newStress = Math.max(0, Math.min(100, currentStress + totalStressChange));
			const newConfidence = Math.max(0, Math.min(100, currentConfidence + totalConfidenceChange));

			// update profiule
			await api.updateProfile({
				stressLevel: Math.round(newStress),
				confidenceLevel: Math.round(newConfidence),
			});

			console.log(`Shop items effect: stress ${currentStress} -> ${Math.round(newStress)}, confidence ${currentConfidence} -> ${Math.round(newConfidence)}`);
		} catch (error) {
			console.error('Failed to apply shop item effects:', error);
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
		);
		const itemSize = size * 0.15;
		for (const layout of this.ITEMS_LAYOUT) {
			const item = this.items[layout.item];
			if (!item || item.getData("picked")) continue;
			const texture = item.texture.getSourceImage() as HTMLImageElement;
			const baseScale = itemSize / Math.max(texture.width, texture.height);
			item.setScale(baseScale);
			item.setData("baseScale", baseScale);
			item.setPosition(
				Math.round(cx - size / 2 + layout.x * size),
				Math.round(cy - size / 2 + layout.y * size)
			);
		}
	}
}