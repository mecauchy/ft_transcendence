import Phaser from "phaser";
import Popup from "./ui/Popup";
import { t } from "./i18nHelper";
import { api } from "../api/client";

export default class HospitalScene extends Phaser.Scene {
	private readonly BASE_SIZE = 600;

	private bg!: Phaser.GameObjects.Image;

	private popup!: Popup;
	private popup_active: boolean = true;

	private game_started: boolean = false;

	private patientsSaved: number = 0;
	private readonly TOTAL_PATIENTS = 3;

	private readonly DROP_ZONE = {
		x: 0.5,
		y: 0.15,
		radius: 0.2,
	}

	private readonly FOLDERS_LAYOUT = [
		{folder:"folder1", x: 0.2, y: 0.64},
		{folder:"folder2", x: 0.5, y: 0.59},
		{folder:"folder3", x: 0.8, y: 0.64},
	];

	private folders: Record<string, Phaser.GameObjects.Sprite> = {};
	private documents: Record<string, Phaser.GameObjects.Sprite> = {};
	private document_open: boolean = false;

	private lastClickTime: number = 0;
	private readonly DOUBLE_CLICK_THRESHOLD = 300; // milliseconds

	constructor() {
		super("HospitalScene");
	}

	preload() {
		this.load.image("hospital_bg", "assets/hospital/HospitalBg.png");
		this.load.image("folder1", "assets/hospital/folder1.png");
		this.load.image("folder2", "assets/hospital/folder2.png");
		this.load.image("folder3", "assets/hospital/folder3.png");
		this.load.image("document1", "assets/hospital/document1.png");
		this.load.image("document2", "assets/hospital/document2.png");
		this.load.image("document3", "assets/hospital/document3.png");
	}

	create() {
		this.bg = this.add.image(0, 0, "hospital_bg").setOrigin(0.5);
		this.folders.folder1 = this.add.sprite(0, 0, "folder1");
		this.folders.folder2 = this.add.sprite(0, 0, "folder2");
		this.folders.folder3 = this.add.sprite(0, 0, "folder3");
		this.documents.document1 = this.add.sprite(0, 0, "document1").setVisible(false);
		this.documents.document2 = this.add.sprite(0, 0, "document2").setVisible(false);
		this.documents.document3 = this.add.sprite(0, 0, "document3").setVisible(false);

		this.popup = new Popup(this);

		// load saved patients
		const savedFolders = this.getSavedFolders();
		this.patientsSaved = savedFolders.length;

		// hide folders for saved patients
		for (const folderKey of savedFolders) {
			const folder = this.folders[folderKey];
			if (folder) {
				folder.setVisible(false);
				folder.disableInteractive();
			}
		}

		// check if all patients are saved
		if (this.patientsSaved >= this.TOTAL_PATIENTS) {
			this.popup.show(
				t("scenes.hospital.allSaved"),
				[
					{
						label: t("common.ok"),
						onClick: () => {
							this.popup.hide();
							this.scene.start("WorldMapScene");
							this.popup.destroy();
						},
					},
				]
			);
			this.centerScene();
			this.scale.on("resize", this.onResize, this);
			this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
				this.scale.off("resize", this.onResize, this);
			});
			return;
		}

		if (!this.game_started) {
			this.popup.show(
				t("scenes.hospital.welcome"),
				[
					{
						label: t("scenes.hospital.gotIt"),
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
		this.makeFolderInteractive(this.folders.folder1, "folder1", t("scenes.hospital.folder1"));
		this.makeFolderInteractive(this.folders.folder2, "folder2", t("scenes.hospital.folder2"));
		this.makeFolderInteractive(this.folders.folder3, "folder3", t("scenes.hospital.folder3"));
		this.makeDocumentInteractive(this.documents.document1);
		this.makeDocumentInteractive(this.documents.document2);
		this.makeDocumentInteractive(this.documents.document3);
		this.setOriginalPositions();

		this.scale.on("resize", this.onResize, this);
		this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.scale.off("resize", this.onResize, this);
		});
	}

	private setOriginalPositions() {
		for (const layout of this.FOLDERS_LAYOUT) {
			const folder = this.folders[layout.folder];
			if (folder) {
				folder.setData("originalX", folder.x);
				folder.setData("originalY", folder.y);
			}
		}
	}

	private makeDocumentInteractive(document: Phaser.GameObjects.Sprite) {
		document.setInteractive();
		document.on("pointerdown", () => {
			if (!this.document_open) return;
			this.document_open = false;
			const size = Math.min(this.scale.width, this.scale.height);
			const cy = Math.round(this.scale.height / 2);
			this.tweens.add({
				targets: document,
				y: cy + size,
				duration: 1000,
				ease: "Cubic.easeIn",
				onComplete: () => {
					document.setVisible(false);
					this.popup_active = false;
				}
			});
		});
	}

	private makeFolderInteractive(folder: Phaser.GameObjects.Sprite, folderKey: string, folderName: string) {
		folder.setInteractive({draggable: true});
		folder.on("pointerover", () => {
			const baseScale = folder.getData("baseScale");
			folder.setScale(baseScale * 1.05);
			folder.setTint(0xdddddd);
		});
		folder.on("pointerout", () => {
			const baseScale = folder.getData("baseScale");
			folder.setScale(baseScale);
			folder.clearTint();
		});
		folder.on("pointerdown", () => {
			if (this.popup_active) return;
			const currentTime = this.time.now;
			if (currentTime - this.lastClickTime < this.DOUBLE_CLICK_THRESHOLD) {
				// Detected double click - use folderKey to determine which document
				this.openDocument(
					folderKey === "folder1" ? this.documents.document1 :
					folderKey === "folder2" ? this.documents.document2 :
					this.documents.document3
				);
				this.popup_active = true;
			}
			this.lastClickTime = currentTime;
		});
		folder.on("drag", (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
			if (this.popup_active) return;
			folder.x = dragX;
			folder.y = dragY;
		});
		folder.on("dragend", () => {
			const size = Math.min(this.scale.width, this.scale.height);
			const cx = Math.round(this.scale.width / 2);
			const cy = Math.round(this.scale.height / 2);
			const centerX = folder.x;
			const centerY = folder.y;
			const nx = (centerX - (cx - size / 2)) / size;;
			const ny = (centerY - (cy - size / 2)) / size;
			const dx = nx - this.DROP_ZONE.x;
			const dy = ny - this.DROP_ZONE.y;
			const distance = Math.sqrt(dx * dx + dy * dy);
			if (distance <= this.DROP_ZONE.radius) {
				const targetX = cx + (this.DROP_ZONE.x - 0.5) * size;
				const targetY = cy + (this.DROP_ZONE.y - 0.5) * size;
				this.tweens.add({
					targets: folder,
					x: targetX,
					y: targetY,
					duration: 300,
					ease: "Cubic.easeOut"
				});
				folder.setData("dropped", true);
				folder.setData("dropNX", this.DROP_ZONE.x);
				folder.setData("dropNY", this.DROP_ZONE.y);
				this.confirmFolderDrop(folder, folderKey);
				return;
			}
			this.tweens.add({
				targets: folder,
				x: folder.getData("originalX"),
				y: folder.getData("originalY"),
				duration: 500,
				ease: "Cubic.easeOut"
			});
			folder.setData("dropped", false);
		});
	}

	private confirmFolderDrop(folder: Phaser.GameObjects.Sprite, folderKey: string) {
		let name;
		if (folderKey === "folder1") {
			name = "Alex";
		} else if (folderKey === "folder2") {
			name = "Maya";
		} else {
			name = "Daniel";
		}
		if (this.popup_active) return;
		this.popup_active = true;
		this.popup.show(
			t("scenes.hospital.confirmReview", { name }),
			[
				{
					label: t("common.yes"),
					onClick: () => {
						this.popup.hide();
						this.popup_active = false;
						folder.setVisible(false);
						folder.disableInteractive();
						this.end_game(folderKey);
					},
				},
				{
					label: t("common.no"),
					onClick: () => {
						this.popup.hide();
						this.popup_active = false;
						this.tweens.add({
							targets: folder,
							x: folder.getData("originalX"),
							y: folder.getData("originalY"),
							duration: 500,
							ease: "Cubic.easeOut"
						});
						folder.setData("dropped", false);
					},
				},
			]
		);
	}

	private async updateStressConfidence() {
		// Placeholder for updating stress and confidence values
		try {
			const stressIncrease = 20; // Example value
			const confidenceDecrease = 20; // Example value
			const profile = await api.getProfile();
			const currentStress = profile.stressLevel ?? 50;
			const currentConfidence = profile.confidenceLevel ?? 50;
			const newConfidence = Math.min(100, currentConfidence - confidenceDecrease);
			const newStress = Math.max(0, currentStress + stressIncrease);

			await api.updateProfile({
				stressLevel: newStress,
				confidenceLevel: newConfidence
			});
			console.log(`Hospital visit: increased stress by ${stressIncrease} (${currentStress} -> ${newStress}), decreased confidence by ${confidenceDecrease} (${currentConfidence} -> ${newConfidence})`);
		} catch (error) {
			console.error('Failed to update stress/confidence levels:', error);
		}
	}

	private async end_game(folderKey?: string) {
		this.patientsSaved++;

		// save completed folder
		if (folderKey) {
			this.saveFolderToStorage(folderKey);
		}
		
		await this.updateStressConfidence();

		// send result to backend for achievements
		try {
			await api.sendHospitalResult({
				patientsSaved: this.patientsSaved,
				totalPatients: this.TOTAL_PATIENTS,
			});
			console.log('Hospital result sent to backend:', this.patientsSaved, '/', this.TOTAL_PATIENTS);
		} catch (error) {
			console.error('Failed to send hospital result:', error);
		}

		if (this.popup_active) return;
		this.popup_active = true;
		this.popup.show(
			t("scenes.hospital.thankYou"),
			[
				{
					label: t("common.finish"),
					onClick: () => {
						this.popup.hide();
						this.popup_active = false;
						this.scene.start("WorldMapScene");
						this.popup.destroy();
					},
				},
			]
		);
	}

	private getSavedFolders(): string[] {
		try {
			const saved = localStorage.getItem('hospitalSavedFolders');
			return saved ? JSON.parse(saved) : [];
		} catch {
			return [];
		}
	}

	private saveFolderToStorage(folderKey: string): void {
		try {
			const savedFolders = this.getSavedFolders();
			if (!savedFolders.includes(folderKey)) {
				savedFolders.push(folderKey);
				localStorage.setItem('hospitalSavedFolders', JSON.stringify(savedFolders));
			}
		} catch (error) {
			console.error('Failed to save folder to localStorage:', error);
		}
	}

	private openDocument(document: Phaser.GameObjects.Sprite) {
		if (this.document_open) return;
		this.document_open = true;
		const cy = Math.round(this.scale.height / 2);
		document.setVisible(true);
		document.setDepth(1000);
		this.tweens.add({
			targets: document,
			y: cy,
			duration: 1000,
			ease: "Cubic.easeOut"
		});
	}

	private centerScene() {
		const size = Math.min(this.scale.width, this.scale.height);
		const cx = Math.round(this.scale.width / 2);
		const cy = Math.round(this.scale.height / 2);
		this.bg.setPosition(cx, cy);
		this.bg.setDisplaySize(size, size);

		const folderSize = size * 0.3;
		for (const layout of this.FOLDERS_LAYOUT) {
			const folder = this.folders[layout.folder];
			if (folder) {
				const texture = folder.texture.getSourceImage() as HTMLImageElement;
				const baseScale = folderSize / Math.max(texture.width, texture.height);
				folder.setScale(baseScale);
				folder.setData("baseScale", baseScale);
				folder.setData("originalX", Math.round(cx + (layout.x - 0.5) * size));
				folder.setData("originalY", Math.round(cy + (layout.y - 0.5) * size));
				if (folder.getData("dropped")) {
					const nx = folder.getData("dropNX");
					const ny = folder.getData("dropNY");
					folder.setPosition(
						Math.round(cx + (nx - 0.5) * size),
						Math.round(cy + (ny - 0.5) * size)
					);
				}
				else {
					folder.setPosition(
						Math.round(cx + (layout.x - 0.5) * size),
						Math.round(cy + (layout.y - 0.5) * size)
					);
				}
			}
		}
		for (const docKey in this.documents) {
			const docSize = size * 1.6;
			const document = this.documents[docKey];
			const texture = document.texture.getSourceImage() as HTMLImageElement;
			const baseScale = docSize / Math.max(texture.width, texture.height);
			document.setScale(baseScale);
			if (!this.document_open) {
			document.setPosition(cx, cy + size);
			}
			else {
				document.setPosition(cx, cy);
			}
		}
	}

	private onResize() {
		this.centerScene();
	}
}
