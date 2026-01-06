import {useState, useEffect, useRef} from "react";
import Phaser from "phaser";
import WorldMapScene from "./phaser/WorldMapScene";
import ShopScene from "./phaser/ShopScene";
import CoffeeScene from "./phaser/CoffeeScene";
import HouseScene from "./phaser/HouseScene";
import ParkingScene from "./phaser/ParkingScene";
import HospitalScene from "./phaser/HospitalScene";
import "./styles/game.css";
import {useTranslation} from "react-i18next";

export default function Game() {
	const gameContainerRef = useRef<HTMLDivElement | null>(null);
	const phaserRef = useRef<Phaser.Game | null>(null);
	const {t} = useTranslation();

	const [gameInPlay, setGameInPlay] = useState(false);
	const [isFullscreen, setIsFullscreen] = useState(false);

	// Responsive game size
	const getGameSize = () => {
		const vwSize = window.innerWidth * 0.9;
		return Math.min(600, vwSize);
	};

	useEffect(() => {
		return () => {
			phaserRef.current?.destroy(true);
			phaserRef.current = null;
		};
	}, []);

	useEffect(() => {
		if (!gameInPlay || !gameContainerRef.current) return;
		if (phaserRef.current) return;

		const container = gameContainerRef.current;
		const size = getGameSize();
		container.style.width = `${size}px`;
		container.style.height = `${size}px`;

		phaserRef.current = new Phaser.Game({
			type: Phaser.WEBGL,
			parent: container,
			width: "100%",
			height: "100%",
			scale: {
				mode: Phaser.Scale.RESIZE,
				autoCenter: Phaser.Scale.CENTER_BOTH,
			},
			scene: [WorldMapScene,
				ShopScene,
				CoffeeScene,
				HouseScene,
				ParkingScene,
				HospitalScene
			],
			backgroundColor: "#353131ff"
		});
	}, [gameInPlay]);

	const exitFullscreen = () => {
		const scale = phaserRef.current?.scale;
		if (!scale) return;

		if (scale.isFullscreen) scale.stopFullscreen();
		setIsFullscreen(false);

		const el = gameContainerRef.current;
		if (el) {
			el.classList.remove("fullscreen");
			const size = getGameSize();
			el.style.width = `${size}px`;
			el.style.height = `${size}px`;
		}

		setTimeout(() => {
			const size = getGameSize();
			scale.setParentSize(size, size);
			scale.refresh();
		}, 0);
	};

	useEffect(() => {
		const onFullscreenChange = () => {
			const fs = !!document.fullscreenElement;
			if (!fs && isFullscreen) exitFullscreen();
		};

		document.addEventListener("fullscreenchange", onFullscreenChange);
		return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
	}, [isFullscreen]);

	const toggleFullscreen = () => {
		if (!phaserRef.current) return;
		const scale = phaserRef.current.scale;

		if (scale.isFullscreen) {
			exitFullscreen();
			return;
		}

		setIsFullscreen(true);

		const el = gameContainerRef.current;
		if (el) {
			el.classList.add("fullscreen");
			el.style.width = "100vw";
			el.style.height = "100vh";
		}

		scale.startFullscreen();
		setTimeout(() => scale.refresh(), 0);
	};

	return (
		<div className="game_container">

			{!gameInPlay && (
				<button
					className="start_game_btn"
					onClick={() => setGameInPlay(true)}
				>
					{t('game.launchGame')}
				</button>
			)}

			{gameInPlay &&
			<div ref={gameContainerRef} className="phaser_container">
					<div className="fullscreen_btn" onClick={toggleFullscreen}>
						⛶
					</div>
			</div>
			}
		</div>
	);
}
