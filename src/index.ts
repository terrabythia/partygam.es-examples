
const onLoad = async function() {

    const hash = window.location.pathname.replace('/', '');

    if ('tic-tac-toe' === hash) {

        const {startGame} = await import('./games/vuejs-tic-tac-toe/index');

        startGame({
            el: '#app'
        });

    }
    else if ('draw' === hash) {

        const {startGame} = await import('./games/react-draw/index');

        startGame({
            el: '#app'
        });

    }

    // TODO: more examples

};

window.addEventListener('load', onLoad);



