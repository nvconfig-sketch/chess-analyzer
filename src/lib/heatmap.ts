import { Chess, SQUARES, type Square, type Color } from "chess.js";
import type { CSSProperties } from "react";

const PLAYER_CONTROL = "rgba(34, 197, 94, 0.35)";
const OPPONENT_CONTROL = "rgba(239, 68, 68, 0.35)";
const CONTESTED_CONTROL = "rgba(250, 204, 21, 0.3)";

export type SquareControl = {
  white: number;
  black: number;
  player: number;
  opponent: number;
  style: CSSProperties;
};

export function calculateSquareControl(
  fen: string,
  playerColor: Color,
): Record<Square, SquareControl> {
  const chess = new Chess(fen);

  return Object.fromEntries(
    SQUARES.map((square) => {
      const white = chess.attackers(square, "w").length;
      const black = chess.attackers(square, "b").length;
      const player = playerColor === "w" ? white : black;
      const opponent = playerColor === "w" ? black : white;
      const contested = player > 0 && opponent > 0 && player === opponent;
      const backgroundColor =
        contested
          ? CONTESTED_CONTROL
          : player > opponent
            ? PLAYER_CONTROL
            : opponent > player
              ? OPPONENT_CONTROL
              : undefined;

      return [
        square,
        {
          white,
          black,
          player,
          opponent,
          style: backgroundColor ? { backgroundColor } : {},
        },
      ];
    }),
  ) as Record<Square, SquareControl>;
}

export function squareControlCss(
  controls: Record<Square, SquareControl>,
  lastMoveSquares: string[] = [],
): string {
  return SQUARES.flatMap((square) => {
    const backgroundColor = controls[square].style.backgroundColor;
    const lastMove = lastMoveSquares.includes(square);
    if (!backgroundColor && !lastMove) return [];

    const declarations = [
      backgroundColor ? `background-color: ${backgroundColor} !important;` : "",
      lastMove ? "box-shadow: inset 0 0 0 4px rgba(250, 204, 21, 0.95) !important;" : "",
    ].join("\n");

    return [`.analysis-board [data-square="${square}"] { ${declarations} }`];
  }).join("\n");
}
