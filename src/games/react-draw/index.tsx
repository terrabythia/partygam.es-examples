import React from 'react';
import ReactDOM from 'react-dom';
import {App} from "./Components/App";

import 'bootstrap/dist/css/bootstrap.css';

interface DrawAppOptions {
    el: string;
}

export const startGame = function ({el = '#app'}: DrawAppOptions) {
    return ReactDOM.render(
        <App />,
        document.querySelector(el)
    );
};
