import Phaser from "phaser";
import Popup from "./ui/Popup";
import { t } from "./i18nHelper";
import { api } from "../api/client";

type ThoughtCategory = "IMPORTANT" | "NOT_IMPORTANT" | "NEUTRAL";

type CardData = {
	container: Phaser.GameObjects.Container;
	bg: Phaser.GameObjects.Image;
	text: Phaser.GameObjects.Text;
	nx: number;
	ny: number;
};


export const THOUGHT_COEFFICIENT_KEYS: Record<string, number> = {
	"scenes.coffee.thoughts.timeChanges": 0.6,
	"scenes.coffee.thoughts.peopleDisappoint": 1.3,
	"scenes.coffee.thoughts.effortMatters": 0.7,
	"scenes.coffee.thoughts.feelingsFade": 1.0,
	"scenes.coffee.thoughts.silenceHeavy": 1.1,
	"scenes.coffee.thoughts.trustBreaks": 1.4,
	"scenes.coffee.thoughts.nothingLasts": 1.0,
	"scenes.coffee.thoughts.memoriesLie": 1.2,
	"scenes.coffee.thoughts.wordsScars": 1.4,
	"scenes.coffee.thoughts.choicesConsequences": 0.8,
	"scenes.coffee.thoughts.loveRisky": 1.1,
	"scenes.coffee.thoughts.regretLate": 1.2,
	"scenes.coffee.thoughts.painTeaches": 0.7,
	"scenes.coffee.thoughts.comfortKills": 0.8,
	"scenes.coffee.thoughts.fearLimits": 1.2,
	"scenes.coffee.thoughts.happinessTemporary": 1.0,
	"scenes.coffee.thoughts.lonelinessFamiliar": 1.3,
	"scenes.coffee.thoughts.attentionAddictive": 1.6,
	"scenes.coffee.thoughts.controlIllusion": 1.0,
	"scenes.coffee.thoughts.meaningPersonal": 0.7,
};

export function getThoughtCoefficients(): Record<string, number> {
	const result: Record<string, number> = {};
	for (const [key, coeff] of Object.entries(THOUGHT_COEFFICIENT_KEYS)) {
		result[t(key)] = coeff;
	}
	return result;
}

const clamp0to100 = (v: number) => Math.max(0, Math.min(100, v));

const DEFAULT_MAX_TOTAL_SWING = 25;


type NeutralDirection = "TINY_IMPORTANT" | "RELIEF";
const NEUTRAL_DIRECTION: NeutralDirection = "TINY_IMPORTANT";
const NEUTRAL_FACTOR = 0.1; // 10% of the weighted effect

function sumCoefficients(sentences: string[], coefficients: Record<string, number>): number {
	let sum = 0;
	for (const s of sentences) {
		const c = coefficients[s];
		// Safety: if missing, treat as 1.0
		sum += Number.isFinite(c) ? c : 1.0;
	}
		return sum;
}

function getScale(sentences: string[], maxTotalSwing = DEFAULT_MAX_TOTAL_SWING): number {
  const coefficients = getThoughtCoefficients();
  const sum = sumCoefficients(sentences, coefficients);
  if (sum <= 0) return 0;
  return maxTotalSwing / sum;
}

/**
 * Returns the per-sentence delta for a category, using coefficient + normalization.
 */
export function getThoughtDelta(
  sentence: string,
  category: ThoughtCategory,
  options?: {
    maxTotalSwing?: number;
    neutralFactor?: number;
  }
): { stress: number; confidence: number } {
  const coefficients = getThoughtCoefficients();
  const allSentences = Object.values(coefficients);
  const scale = getScale(Object.keys(coefficients), options?.maxTotalSwing ?? DEFAULT_MAX_TOTAL_SWING);

  const coeffRaw = coefficients[sentence];
  const coeff = Number.isFinite(coeffRaw) ? coeffRaw : 1.0;

  const base = coeff * scale;

  if (category === "IMPORTANT") {
    return { stress: +base, confidence: -base };
  }

  if (category === "NOT_IMPORTANT") {
    return { stress: -base, confidence: +base };
  }

  // NEUTRAL
  const nf = options?.neutralFactor ?? NEUTRAL_FACTOR;
  const tiny = base * nf;

  if (NEUTRAL_DIRECTION === "RELIEF") {
    return { stress: -tiny, confidence: +tiny };
  }

  // "TINY_IMPORTANT"
  return { stress: +tiny, confidence: -tiny };
}


export default class CoffeeScene extends Phaser.Scene {
	private readonly BASE_SIZE = 600;
	private readonly CARD_SCALE = 1.9;

	private gameSize = 0;

	private bg!: Phaser.GameObjects.Image;
	private stopButton!: Phaser.GameObjects.Image;
	private forgiveButton!: Phaser.GameObjects.Image;
	private buttonBaseScale = 1;
	private cards: CardData[] = [];

	private popup!: Popup;

	private importantThoughts: string[];
	private notImportantThoughts: string[];
	private neutralThoughts: string[];

	private game_started = false;

	constructor() {
		super({ key: "CoffeeScene" });
	}

	preload() {
		this.load.image("coffee_bg", "assets/coffee/CoffeBg.png");
		this.load.image("card_bg", "assets/coffee/card.png");
		this.load.image("stop_button", "assets/coffee/stop_button.png");
		this.load.image("forgive_button", "assets/coffee/forgive_button.png");
	}

	create(): void {
		this.bg = this.add.image(0, 0, "coffee_bg").setOrigin(0.5);
		this.stopButton = this.add.image(0, 0, "stop_button").setOrigin(0.5);
		this.forgiveButton = this.add.image(0, 0, "forgive_button").setOrigin(0.5);
		this.buttonOverEffect(this.stopButton);
		this.buttonOverEffect(this.forgiveButton);

		this.importantThoughts = [];
		this.notImportantThoughts = [];
		this.neutralThoughts = [];

		this.popup = new Popup(this);

		if (!this.game_started) {
			this.popup.show(
				t("scenes.coffee.welcome"),
				[
					{
						label: t("scenes.coffee.gotIt"),
						onClick: () => {
							this.popup.hide();
							this.game_started = true;
						}
					}
				]
			);
		}

		// Example cards
		this.createCard(t("scenes.coffee.thoughts.timeChanges"));
		this.createCard(t("scenes.coffee.thoughts.peopleDisappoint"));
		this.createCard(t("scenes.coffee.thoughts.effortMatters"));
		this.createCard(t("scenes.coffee.thoughts.feelingsFade"));
		this.createCard(t("scenes.coffee.thoughts.silenceHeavy"));
		this.createCard(t("scenes.coffee.thoughts.trustBreaks"));
		this.createCard(t("scenes.coffee.thoughts.nothingLasts"));
		this.createCard(t("scenes.coffee.thoughts.memoriesLie"));
		this.createCard(t("scenes.coffee.thoughts.wordsScars"));
		this.createCard(t("scenes.coffee.thoughts.choicesConsequences"));
		this.createCard(t("scenes.coffee.thoughts.loveRisky"));
		this.createCard(t("scenes.coffee.thoughts.regretLate"));
		this.createCard(t("scenes.coffee.thoughts.painTeaches"));
		this.createCard(t("scenes.coffee.thoughts.comfortKills"));
		this.createCard(t("scenes.coffee.thoughts.fearLimits"));
		this.createCard(t("scenes.coffee.thoughts.happinessTemporary"));
		this.createCard(t("scenes.coffee.thoughts.lonelinessFamiliar"));
		this.createCard(t("scenes.coffee.thoughts.attentionAddictive"));
		this.createCard(t("scenes.coffee.thoughts.controlIllusion"));
		this.createCard(t("scenes.coffee.thoughts.meaningPersonal"));

		this.centerScene();

		this.scale.on("resize", this.onResize, this);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.scale.off("resize", this.onResize, this);
			this.popup.destroy();
			this.cleanup()
		});
	}

	private cleanup() {
		for (const card of this.cards) {
			card.container.destroy(true);
		}
		this.cards = [];
	}


	private buttonOverEffect(buttonObject: Phaser.GameObjects.Image) {
		buttonObject.setInteractive();
		buttonObject.on("pointerover", () => {
			this.tweens.add({
				targets: buttonObject,
				scale: buttonObject.scale * 1.1,
				duration: 100,
				ease: "Power2"
			});
		});
		buttonObject.on("pointerout", () => {
			this.tweens.add({
				targets: buttonObject,
				scale: this.buttonBaseScale,
				duration: 100,
				ease: "Power2"
			});
		});
		if (buttonObject === this.forgiveButton) {
			buttonObject.on("pointerdown", () => {

				this.scene.start("WorldMapScene");
				console.log("Forgive button clicked");
			});
		}
		else if (buttonObject === this.stopButton) {
			buttonObject.on("pointerdown", () => {
				console.log("Stop button clicked");
				this.endGame();
			});
		}
	}

	private buildClassifications(
		important: string[],
		notImportant: string[],
		neutral: string[]
	): Partial<Record<string, ThoughtCategory>> {
		const map: Partial<Record<string, ThoughtCategory>> = {};

		for (const s of important) map[s] = "IMPORTANT";
		for (const s of notImportant) map[s] = "NOT_IMPORTANT";
		for (const s of neutral) map[s] = "NEUTRAL";

		return map;
	}

	private async endGame() {
		// Classify thoughts based on card positions
		for (const card of this.cards) {
			if (card.nx > 0.5 && card.nx < 0.95 && card.ny > 0.3 && card.ny < 0.8) {
				this.notImportantThoughts.push(card.text.text);
			}
			else if (card.nx >= 0.05 && card.nx <= 0.5 && card.ny > 0.3 && card.ny < 0.8) {
				this.importantThoughts.push(card.text.text);
			}
			else {
				this.neutralThoughts.push(card.text.text);
			}
		}
		console.log("Important Thoughts:", this.importantThoughts);
		console.log("Not Important Thoughts:", this.notImportantThoughts);
		console.log("Neutral Thoughts:", this.neutralThoughts);

		await this.updateStressConfidence();

		this.scene.start("WorldMapScene");
	}

	private async updateStressConfidence() {
		try {
			let totalStressChange = 0;
			let totalConfidenceChange = 0;

			for (const thought of this.importantThoughts) {
				const delta = getThoughtDelta(thought, "IMPORTANT");
				totalStressChange += delta.stress;
				totalConfidenceChange += delta.confidence;
			}

			for (const thought of this.notImportantThoughts) {
				const delta = getThoughtDelta(thought, "NOT_IMPORTANT");
				totalStressChange += delta.stress;
				totalConfidenceChange += delta.confidence;
			}

			for (const thought of this.neutralThoughts) {
				const delta = getThoughtDelta(thought, "NEUTRAL");
				totalStressChange += delta.stress;
				totalConfidenceChange += delta.confidence;
			}

			const profile = await api.getProfile();
			const currentStress = profile.stressLevel ?? 50;
			const currentConfidence = profile.confidenceLevel ?? 50;

			const newStress = clamp0to100(currentStress + totalStressChange);
			const newConfidence = clamp0to100(currentConfidence + totalConfidenceChange);

			await api.updateProfile({
				stressLevel: Math.round(newStress),
				confidenceLevel: Math.round(newConfidence)
			});

			console.log(`Coffee reflection: stress changed by ${totalStressChange.toFixed(2)} (${currentStress} -> ${newStress.toFixed(2)}), confidence changed by ${totalConfidenceChange.toFixed(2)} (${currentConfidence} -> ${newConfidence.toFixed(2)})`);
		} catch (error) {
			console.error('Failed to update stress/confidence levels:', error);
		}
	}

	// --------------------------------------------------
	// Card factory
	// --------------------------------------------------

	private createCard(text: string) {
		const bg = this.add.image(0, 0, "card_bg");

		const baseFontSize = 8;
		const txt = this.add.text(0, 0, text, {
			fontSize: `${baseFontSize}px`,
			color: "#000000",
			align: "center",
			wordWrap: { width: bg.width * 0.8 }
		}).setOrigin(0.5);

		const container = this.add.container(0, 0, [bg, txt]);

		// Random normalized position (inside safe area)
		const nx = Phaser.Math.FloatBetween(0.2, 0.8);
		const ny = Phaser.Math.FloatBetween(0.2, 0.8);

		const card: CardData = { container, bg, text: txt, nx, ny };
		this.cards.push(card);

		container.setInteractive(
			new Phaser.Geom.Rectangle(
				-bg.width / 2,
				-bg.height / 2,
				bg.width,
				bg.height
			),
			Phaser.Geom.Rectangle.Contains
		);

		this.input.setDraggable(container);

		this.input.on("drag", (_p, obj, x, y) => {
			if (obj !== container) return;

			const cx = this.scale.width / 2;
			const cy = this.scale.height / 2;

			card.nx = Phaser.Math.Clamp((x - cx) / this.gameSize + 0.5, 0, 1);
			card.ny = Phaser.Math.Clamp((y - cy) / this.gameSize + 0.5, 0, 1);

			this.updateSingleCardPosition(card);
		});

		container.on("dragstart", () => {
			this.tweens.add({
				targets: bg,
				scale: bg.scale * 1.05,
				angle: Phaser.Math.Between(-2, 2),
				duration: 100,
				ease: "Power2"
			});
		});

		container.on("dragend", () => {
			this.tweens.add({
				targets: bg,
				scale: bg.scale / 1.05,
				angle: 0,
				duration: 100,
				ease: "Power2"
			});
		});
	}

	// --------------------------------------------------
	// Layout
	// --------------------------------------------------

	private onResize() {
		if (!this.scene.isActive()) return;
		this.centerScene();
	}

	private centerScene() {
		const size = Math.min(this.scale.width, this.scale.height);
		this.gameSize = size;
		const scaleButton = size / 400;

		// Square background
		this.bg.setDisplaySize(size, size);
		this.bg.setPosition(
			Math.round(this.scale.width / 2),
			Math.round(this.scale.height / 2)
		);
		this.stopButton.setPosition(
			Math.round(this.scale.width / 2) - size / 4,
			size / 8
		);
		this.forgiveButton.setPosition(
			Math.round(this.scale.width / 2) + size / 4,
			size / 8
		);
		this.buttonBaseScale = scaleButton;
		this.stopButton.setScale(this.buttonBaseScale);
		this.forgiveButton.setScale(this.buttonBaseScale);

		const scaleFactor = (size / this.BASE_SIZE) * this.CARD_SCALE;

		for (const card of this.cards) {
			card.bg.setScale(scaleFactor);
			card.text.setFontSize(Math.round(8 * scaleFactor));
			card.text.setWordWrapWidth(card.bg.width * scaleFactor * 0.8);
			card.container.setScale(1);

			this.updateSingleCardPosition(card);
		}
	}

	private updateSingleCardPosition(card: CardData) {
		const cx = this.scale.width / 2;
		const cy = this.scale.height / 2;

		card.container.x = cx + (card.nx - 0.5) * this.gameSize;
		card.container.y = cy + (card.ny - 0.5) * this.gameSize;
	}
}
