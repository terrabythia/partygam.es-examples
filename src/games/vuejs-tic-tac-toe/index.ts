import Vue from 'vue/dist/vue.esm';
import Game from './game.vue';

// for now just import everything from bulma, it's just an example
import 'bulma/bulma.sass';

interface TicTacToeAppOptions {
    el: string;
}

export const startGame = function({ el = '#app' }: TicTacToeAppOptions) {

    return new Vue({

        el,

        template: '<Game />',

        components: {Game},

    });

};

