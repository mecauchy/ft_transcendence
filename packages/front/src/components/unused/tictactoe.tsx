import { useEffect, useRef } from "react";
import "./styles/game.css";

function TicTacToe() {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const map = useRef<number[][]>([
		[0, 0, 0],
		[0, 0, 0],
		[0, 0, 0],
	]);
	const currentPlayer = useRef<1 | 2>(1);

	useEffect(() => {
		const canva = canvasRef.current;
		if (!canva) return;

		const context = canva.getContext("2d");
		if (!context) return;

		const drawGrid = () => {
			context.clearRect(0, 0, canva.width, canva.height);
			context.strokeStyle = "white";
			context.lineWidth = 5;
			for (let i = 1; i <= 2; i++) {
				context.beginPath();
				context.moveTo((canva.width / 3) * i, 0);
				context.lineTo((canva.width / 3) * i, canva.height);
				context.stroke();

				context.beginPath();
				context.moveTo(0, (canva.height / 3) * i);
				context.lineTo(canva.width, (canva.height / 3) * i);
				context.stroke();
			}
		};

		const drawMarks = () => {
			for (let row = 0; row < 3; row++) {
				for (let col = 0; col < 3; col++) {
					const mark = map.current[row][col];
					const centerX = (col + 0.5) * (canva.width / 3);
					const centerY = (row + 0.5) * (canva.height / 3);

					if (mark === 1) {
						context.strokeStyle = "red";
						context.beginPath();
						context.moveTo(centerX - 50, centerY - 50);
						context.lineTo(centerX + 50, centerY + 50);
						context.moveTo(centerX + 50, centerY - 50);
						context.lineTo(centerX - 50, centerY + 50);
						context.stroke();
					} else if (mark === 2) {
						context.strokeStyle = "blue";
						context.beginPath();
						context.arc(centerX, centerY, 50, 0, Math.PI * 2);
						context.stroke();
					}
				}
			}
		};

		const checkWin = (): number | null => {
			const m = map.current;
			for (let i = 0; i < 3; i++) {
				if (m[i][0] && m[i][0] === m[i][1] && m[i][1] === m[i][2]) return m[i][0];
				if (m[0][i] && m[0][i] === m[1][i] && m[1][i] === m[2][i]) return m[0][i];
			}
			if (m[0][0] && m[0][0] === m[1][1] && m[1][1] === m[2][2]) return m[0][0];
			if (m[0][2] && m[0][2] === m[1][1] && m[1][1] === m[2][0]) return m[0][2];
			return null;
		};


		drawGrid();
		drawMarks();
		void checkWin();
		void currentPlayer.current;

	}, []);

	return (
		<canvas
			ref={canvasRef}
			width={700}
			height={700}
			className="tictactoeCanvas"
		/>
	);
}

export default TicTacToe;
