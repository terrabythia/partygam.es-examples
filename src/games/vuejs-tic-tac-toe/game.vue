<template>

    <div>
        <h2 class="title is-2">Tic Tac Toe - Let's Play!</h2>
        <div id="tic">
            <div class="columns is-mobile">
                <div @click.prevent="onClickBox($event, 0)" class="column" :class="{'move-o': this.moves.get(0) === 'o', 'move-x': this.moves.get(0) === 'x'}"></div>
                <div @click.prevent="onClickBox($event, 1)" class="column" :class="{'move-o': this.moves.get(1) === 'o', 'move-x': this.moves.get(1) === 'x'}"></div>
                <div @click.prevent="onClickBox($event, 2)" class="column" :class="{'move-o': this.moves.get(2) === 'o', 'move-x': this.moves.get(2) === 'x'}"></div>
            </div>
            <div class="columns is-mobile">
                <div @click.prevent="onClickBox($event, 3)" class="column" :class="{'move-o': this.moves.get(3) === 'o', 'move-x': this.moves.get(3) === 'x'}"></div>
                <div @click.prevent="onClickBox($event, 4)" class="column" :class="{'move-o': this.moves.get(4) === 'o', 'move-x': this.moves.get(4) === 'x'}"></div>
                <div @click.prevent="onClickBox($event, 5)" class="column" :class="{'move-o': this.moves.get(5) === 'o', 'move-x': this.moves.get(5) === 'x'}"></div>
            </div>
            <div class="columns is-mobile">
                <div @click.prevent="onClickBox($event, 6)" class="column" :class="{'move-o': this.moves.get(6) === 'o', 'move-x': this.moves.get(6) === 'x'}"></div>
                <div @click.prevent="onClickBox($event, 7)" class="column" :class="{'move-o': this.moves.get(7) === 'o', 'move-x': this.moves.get(7) === 'x'}"></div>
                <div @click.prevent="onClickBox($event, 8)" class="column" :class="{'move-o': this.moves.get(8) === 'o', 'move-x': this.moves.get(8) === 'x'}"></div>
            </div>
        </div>
    </div>

</template>
<script lang="ts">

import {List} from 'immutable';
import {onPlayersUpdate, broadcastMessage, emitMessage, onMessageReceived} from "partygam.es-client-api/src";
import {IPlayer} from "partygam.es-client-api/src/protocol";

interface IGameDataInterface {
    players: ReadonlyArray<IPlayer>;
    gamesWon: number;
    xPlayerId: string;
    oPlayerId: string;
    currentPlayer: 'x' | 'o';
    moves: List<string>;
}

const winningConditions = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
];

const newGame = () => List.of(...new Array(9).fill(null));

export default {

    data: (): IGameDataInterface => ({
        players: [],
        gamesWon: 0,
        xPlayerId: null,
        oPlayerId: null,
        currentPlayer: 'x',
        moves: newGame(),
    }),

    watch: {
        moves() {
            if (null !== this.winningPlayerId) {
                setTimeout(() => {
                    if (this.winningPlayerId === this.thisPlayer.id) {
                        alert('You won! Great!');
                        broadcastMessage({
                            type: 'reset',
                        });
                    }
                    else {
                        alert('You lose! Boo!');
                    }
                }, 100);
            }
            else if (true === this.isTie) {
                console.log('is a tie', this.moves);
                setTimeout(() => {
                    // alert('Nobody won!');
                    broadcastMessage({
                        type: 'move',
                        moves: newGame().toArray(),
                        currentPlayer: 'x'
                    });
                }, 100);
            }
        }
    },

    computed: {
        playerIds(): ReadonlyArray<string> { return  this.players.map(p => p.id); },
        thisPlayer(): IPlayer { return this.players.find((p: IPlayer) => p.isCurrent) || null; },
        isCurrentPlayersTurn(): boolean {
            if (this.xPlayerId === null || this.oPlayerId === null) {
                // not playing, there are not two players yet
                return false;
            }
            const player = this.thisPlayer;
            if (null === player) {
                return false;
            }
            if ('x' === this.currentPlayer && this.xPlayerId === player.id) {
                return true;
            }
            if ('o' === this.currentPlayer && this.oPlayerId === player.id) {
                return true;
            }
            return false;
        },
        isTie() {
            return null === this.winningPlayerId && this.moves.filter(m => null !== m).size === 0;
        },
        winningPlayerId() {
            const moves = this.moves as List;
            let winningSymbol = null;
            for (let [a, b, c] of winningConditions) {
                const [aVal, bVal, cVal] = [moves.get(a), moves.get(b), moves.get(c)];
                if (null !== aVal && aVal === bVal && cVal === bVal) {
                    winningSymbol = bVal;
                    break;
                }
            }
            if (null === winningSymbol) {
                return null;
            }
            if ('o' === winningSymbol) {
                return this.oPlayerId;
            }
            return this.xPlayerId;
        }
    },

    methods: {
        onClickBox($event: MouseEvent, index: number) {
            if (null !== this.moves.get(index)) {
                // this box is already played
                console.log('ALREADY PLAYED!');
                return;
            }
            if (!this.isCurrentPlayersTurn) {
                console.log('NOT YOUR TURN!');
                return;
            }
            // emit that a new move has just been played
            // send along the whole array of moves, so they are now all in sync
            broadcastMessage({
                type: 'move',
                moves: this.moves.set(index, this.currentPlayer).toArray(),
                currentPlayer: 'x' === this.currentPlayer ? 'o' : 'x'
            });
        },
        onPlayersUpdate(players: ReadonlyArray<IPlayer>) {
            console.log('players updated', players);
            this.players = players;
            this.xPlayerId = this.players[0]?.id || null;
            this.oPlayerId = this.players[1]?.id || null;
        },
        onMessageReceived(playerId: string, payload: any) {
            if (payload.type === 'move') {
                this.moves = List.of(...payload.moves);
                this.currentPlayer = payload.currentPlayer;
            }
            else if (payload.type === 'reset') {
                this.moves = newGame();
                this.currentPlayer = 'x';
            }
        }
    },


    mounted() {
        onPlayersUpdate((players) => this.onPlayersUpdate(players), { immediate: true });
        onMessageReceived((playerId, payload) => this.onMessageReceived(playerId, payload));
    }
}

</script>
<style lang="scss" scoped>
    #tic {
        width: 600px;
        margin: 0 auto;
        .columns {

            .column {
                cursor: pointer;
                min-height: 200px;
                border: 4px solid black;
                font-size: 100px;
                text-align: center;

                &.move-x::after {
                   content: 'X';
                }
                &.move-o::after {
                    content: 'O';
                }
            }
        }
    }
</style>
