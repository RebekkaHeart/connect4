import { Player } from './player'
import { BoardBase, BoardPiece } from '../board'
import {
  BIG_POSITIVE_NUMBER,
  BIG_NEGATIVE_NUMBER,
  getMockPlayerAction,
  choose,
  clone,
} from '../utils'

export class PlayerAi extends Player {
  static readonly MAX_DEPTH = 2
  private ownBoardPieceValue: number
  private enemyBoardPiece: BoardPiece
  private firstMove: boolean
  constructor(boardPiece: BoardPiece, label: string) {
    super(boardPiece, label)
    this.ownBoardPieceValue = this.getBoardPieceValue(boardPiece)
    this.enemyBoardPiece =
      boardPiece === BoardPiece.PLAYER_1
        ? BoardPiece.PLAYER_2
        : BoardPiece.PLAYER_1
    this.firstMove = true
  }
  private getBoardPieceValue(boardPiece: BoardPiece): number {
    return boardPiece === BoardPiece.EMPTY
      ? 0
      : boardPiece === this.boardPiece
        ? 1
        : -1
  }
  private getStateValue(state: Array<Array<BoardPiece>>): {
    winnerBoardPiece: BoardPiece
    chain: number
  } {
    let winnerBoardPiece = BoardPiece.EMPTY
    let chainValue = 0
    for (let i = 0; i < BoardBase.ROWS; i++) {
      for (let j = 0; j < BoardBase.COLUMNS; j++) {
        let tempRight = 0,
          tempBottom = 0,
          tempBottomRight = 0,
          tempTopRight = 0
        for (let k = 0; k <= 3; k++) {
          // from (i,j) to right
          if (j + k < BoardBase.COLUMNS) {
            tempRight += this.getBoardPieceValue(state[i][j + k])
          }

          // from (i,j) to bottom
          if (i + k < BoardBase.ROWS) {
            tempBottom += this.getBoardPieceValue(state[i + k][j])
          }

          // from (i,j) to bottom-right
          if (i + k < BoardBase.ROWS && j + k < BoardBase.COLUMNS) {
            tempBottomRight += this.getBoardPieceValue(state[i + k][j + k])
          }

          // from (i,j) to top-right
          if (i - k >= 0 && j + k < 7) {
            tempTopRight += this.getBoardPieceValue(state[i - k][j + k])
          }
        }
        chainValue += tempRight * tempRight * tempRight
        chainValue += tempBottom * tempBottom * tempBottom
        chainValue += tempBottomRight * tempBottomRight * tempBottomRight
        chainValue += tempTopRight * tempTopRight * tempTopRight

        if (Math.abs(tempRight) === 4) {
          winnerBoardPiece =
            tempRight > 0 ? this.boardPiece : this.enemyBoardPiece
        } else if (Math.abs(tempBottom) === 4) {
          winnerBoardPiece =
            tempBottom > 0 ? this.boardPiece : this.enemyBoardPiece
        } else if (Math.abs(tempBottomRight) === 4) {
          winnerBoardPiece =
            tempBottomRight > 0 ? this.boardPiece : this.enemyBoardPiece
        } else if (Math.abs(tempTopRight) === 4) {
          winnerBoardPiece =
            tempTopRight > 0 ? this.boardPiece : this.enemyBoardPiece
        }
      }
    }
    return {
      winnerBoardPiece: winnerBoardPiece,
      chain: chainValue,
    }
  }

  /**
   * @return transformed value, so the AI could take a "lower hanging fruit",
   *          i.e. a reward in closer future worth more than the same reward in distant future
   * @param returnValue
   * @param winnerBoardPiece
   * @param depth
   */
  private transformValues(
    returnValue: number,
    winnerBoardPiece: BoardPiece,
    depth: number,
  ): number {
    const isWon = winnerBoardPiece === this.boardPiece
    const isLost = winnerBoardPiece === this.enemyBoardPiece
    returnValue -= depth * depth
    if (isWon) {
      // Prefer to win in closer steps
      returnValue = BIG_POSITIVE_NUMBER - 100 - depth * depth
    } else if (isLost) {
      // Prefer to lose in more steps
      returnValue = BIG_NEGATIVE_NUMBER + 100 + depth * depth
    }
    return returnValue
  }
  private getMove(
    state: Array<Array<BoardPiece>>,
    depth: number,
    alpha: number,
    beta: number,
  ): {
    value: number
    move: number
  } {
    const stateValue = this.getStateValue(state)
    const isWon = stateValue.winnerBoardPiece === this.boardPiece
    const isLost = stateValue.winnerBoardPiece === this.enemyBoardPiece

    if (depth >= PlayerAi.MAX_DEPTH || isWon || isLost) {
      return {
        value:
          this.transformValues(
            stateValue.chain,
            stateValue.winnerBoardPiece,
            depth,
          ) * this.ownBoardPieceValue,
        move: -1, // leaf node
      }
    }

    return depth % 2 === 0
      ? this.minState(state, depth + 1, alpha, beta) // next is enemy's turn
      : this.maxState(state, depth + 1, alpha, beta) // next is my turn
  }

  private maxState(
    state: Array<Array<BoardPiece>>,
    depth: number,
    alpha: number,
    beta: number,
  ): {
    value: number
    move: number
  } {
    let value = BIG_NEGATIVE_NUMBER
    let moveQueue: Array<number> = []
    for (let column = 0; column < BoardBase.COLUMNS; column++) {
      const { success: actionSuccessful, map: nextState } = getMockPlayerAction(
        state,
        this.boardPiece,
        column,
      )
      if (!actionSuccessful) {
        continue
      }
      const { value: nextValue } = this.getMove(nextState, depth, alpha, beta)
      if (nextValue > value) {
        value = nextValue
        moveQueue = [column]
      } else if (nextValue === value) {
        moveQueue.push(column)
      }

      // alpha-beta pruning
      if (value > beta) {
        return {
          value: value,
          move: choose(moveQueue),
        }
      }
      alpha = Math.max(alpha, value)
    }

    return {
      value: value,
      move: choose(moveQueue),
    }
  }
  private minState(
    state: Array<Array<BoardPiece>>,
    depth: number,
    alpha: number,
    beta: number,
  ): {
    value: number
    move: number
  } {
    let value = BIG_POSITIVE_NUMBER
    let moveQueue: Array<number> = []
    for (let column = 0; column < BoardBase.COLUMNS; column++) {
      const { success: actionSuccessful, map: nextState } = getMockPlayerAction(
        state,
        this.enemyBoardPiece,
        column,
      )
      if (!actionSuccessful) {
        continue
      }
      const { value: nextValue } = this.getMove(nextState, depth, alpha, beta)
      if (nextValue < value) {
        value = nextValue
        moveQueue = [column]
      } else if (nextValue === value) {
        moveQueue.push(column)
      }

      // alpha-beta pruning
      if (value < alpha) {
        return {
          value: value,
          move: choose(moveQueue),
        }
      }
      beta = Math.min(beta, value)
    }

    return {
      value: value,
      move: choose(moveQueue),
    }
  }

  private randomMove(state: Array<Array<BoardPiece>>): number
  {
    let list = [];
    for (let i = 2; i < 5; i++) {
      const isFree = state[5][i] == BoardPiece.EMPTY;
      if (isFree) {
        list.push(i);
      }
    }

    let index = Math.floor(Math.random() * list.length);
    return list[index]
  }

  private delay(state: Array<Array<BoardPiece>>) 
  {
    let freeColumns = 0;
    for (let i = 0; i < BoardBase.COLUMNS; i++) {
      const isFree = state[1][i] == BoardPiece.EMPTY;
      if (isFree) {
        freeColumns = freeColumns + 1;
      }
    }

    let freeRowFour = 0;
    for (let i = 0; i < BoardBase.COLUMNS; i++) {
      const isFree = state[4][i] == BoardPiece.EMPTY;
      if (isFree) {
        freeRowFour = freeRowFour + 1;
      }
    }

    const rndInt = Math.floor(Math.random() * 1000) + 1 + (1000 * (freeColumns - freeRowFour));
    return rndInt;
  }

  async getAction(board: BoardBase): Promise<number> {
    const state = clone(board.map)

    if(this.firstMove){
      this.firstMove = false
      return this.randomMove(state);
    }
    const action = this.maxState(
      state,
      0,
      BIG_NEGATIVE_NUMBER,
      BIG_POSITIVE_NUMBER,
    )

    // makes delay so that move isn't instant
    await new Promise(f => setTimeout(f, this.delay(state)));

    console.log(
      `AI ${this.boardPiece} choose column ${action.move} with value of ${action.value}`,
    )
    return action.move
  }
}
