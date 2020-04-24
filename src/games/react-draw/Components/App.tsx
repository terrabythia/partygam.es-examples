import React from 'react';
import {useEffect, useState, useMemo, useRef, useCallback} from "react";
import {directMessage, broadcastMessage, onMessageReceived, onPlayersUpdate, showToast, showPlayerToast} from 'partygam.es-client-api/src';
import {IPlayer} from 'partygam.es-client-api/src/protocol';

import {Canvas} from "./Canvas";
import {ChatInput} from "./ChatInput";
import {ChooseWordOverlay} from "./ChooseWordOverlay";

// create dynamic modules for all languages but don't include them yet
interface WindowSize {
    width: number;
    height: number;
}

enum MessageType {
    MESSAGE_DRAW_PREVIEW,
    MESSAGE_DRAWING,
}

enum GameStatus {
    STATUS_WAITING,
    STATUS_CHOOSING_WORD,
    STATUS_PLAYING,
    STATUS_ENDED,
}

const getLangWords = (lang): Promise<any> => {
    switch (lang) {
        case 'nl-NL':
            return import('./../words/nl-NL');
        default:
            return import('./../words/en-EN');
    }
};

const queryString = window.location.search;

export const App: React.FC = () => {

    /**
     * TODO: how to know which player's turn it is?
     * Keep scores...
     * Timer...
     * Words.. +guess..
     *
     */

    const [language, setLanguage] = useState<string>(null);
    const [guessWords, setGuessWords] = useState<ReadonlyArray<string>>(null);
    const [chosenWord, setChosenWord] = useState<string>(null);
    const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.STATUS_WAITING);
    const [players, setPlayers] = useState<ReadonlyArray<IPlayer>>([]);
    const [currentPlayerIndex, setCurrentPlayerIndex] = useState<number>(0);
    const [windowSize, setWindowSize] = useState<WindowSize>({ width: document.documentElement.clientWidth, height: document.documentElement.clientHeight });

    const playerMe = useMemo<IPlayer>(() => players.find(p => p.isCurrent), [players]);
    const playerHost = useMemo<IPlayer>(() => players.find(p => p.isHost), [players]);

    const isMyTurn = useMemo<boolean>(() => {
        if (!playerMe) return false;
        return players.map(p => p.id).indexOf(playerMe.id) === currentPlayerIndex;
    }, [currentPlayerIndex, playerMe]);

    const iCanDraw = useMemo<boolean>(() => {
       return true === isMyTurn && null !== chosenWord;
    }, [isMyTurn, chosenWord]);

    const gameCanStart = useMemo<boolean>(() => {
        return null !== guessWords && players.length >= 2;
    }, [language, players]);

    const currentPlayer = useMemo<IPlayer>((): IPlayer => {
       return players[currentPlayerIndex] || null;
    }, [players, currentPlayerIndex]);

    const getPlayer = useCallback((playerId: string): IPlayer => {
        return players.find(p => playerId === p.id);
    }, [players]);

    // is only player left??
    useEffect(() => {

        if (players.length === 1 && GameStatus.STATUS_PLAYING !== gameStatus) {
            setGameStatus(GameStatus.STATUS_WAITING);
        }

    }, [players]);

    useEffect(() => {

        // game can start if guesswords is not null
        if (false === gameCanStart) {
            return;
        }

        // when 1 player: show waiting for other players (+ settings)
        // when 2 players+: show/enable start game button
        console.log('start game?, my turn?', isMyTurn);

    }, [gameCanStart]);

    useEffect(() => {

        // load language words
        if (null !== language && null === guessWords) {
            getLangWords(language)
                .then(({words}) => {
                    setGuessWords(words);
                })
                .catch(err => {
                    console.error('err', err);
                });
        }

        const removeOnMessageListener = onMessageReceived((playerId, payload) => {
            switch(payload.type) {
                case 'player_guess':
                    // check if the word is correct!
                    console.log(`player ${playerId} guessed ${payload.answer}`);
                    // update state if state is added
                    if (isMyTurn) {
                        if (chosenWord && payload.answer.toLowerCase() === chosenWord.toLowerCase()) {
                            console.log(`${payload.answer} is the right word! You win!`);
                            directMessage(playerId, {
                                type: 'right_guess',
                                answer: payload.answer,
                            });
                        }
                        else {
                            directMessage(playerId, {
                                type: 'wrong_guess',
                                message: payload.answer,
                            });
                        }
                    }
                    break;
                case 'wrong_guess':
                    // == direct message we got back because the answer is wrong
                    // TODO: maybe show toast but only to current player?
                    showPlayerToast({
                        message: payload.message,
                    });
                    break;
                case 'right_guess':
                    showToast({
                        message: `${playerMe.username} has guessed the word!`
                    });
                    break;
                case 'game_status_update':
                    setGameStatus(payload.gameStatus as GameStatus);
                    if (payload.language) {
                        setLanguage(payload.language);
                    }
                    break;
            }
        });

        const removeOnPlayersUpdateListener = onPlayersUpdate((players) => {
              setPlayers(players);
        }, { immediate: true });

        let windowResizeTimeout = null;
        const onWindowResize = () => {
            if (windowResizeTimeout) {
                clearTimeout(windowResizeTimeout);
            }
            windowResizeTimeout = setTimeout(() => {
               setWindowSize({
                   width: document.documentElement.clientWidth,
                   height: document.documentElement.clientHeight,
               });
            }, 500);
        };

        window.addEventListener('resize', onWindowResize);

        return () => {
            removeOnMessageListener();
            removeOnPlayersUpdateListener();
            window.removeEventListener('resize', onWindowResize);
            if (windowResizeTimeout) {
                clearTimeout(windowResizeTimeout);
            }
        }

    }, [language, chosenWord]);

    const onChatMessage = (message: string) => {
        if (currentPlayer && !isMyTurn) {
            if (!isMyTurn) {
                directMessage(currentPlayer.id, {
                    type: 'player_guess',
                    answer: message,
                });
            }
        }
        else if (playerMe && isMyTurn) {
           showPlayerToast({
               message
           });
        }
    };

    const onStartGameFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const formData = new FormData(e.currentTarget);
        broadcastMessage({
            type: 'game_status_update',
            status: GameStatus.STATUS_CHOOSING_WORD,
            language: formData.get('language').toString()
        });

    };

    const onWordSelected = (word: string) => {
        broadcastMessage({
            type: 'game_status_update',
            status: GameStatus.STATUS_PLAYING,
        });
        setChosenWord(word);
        setGameStatus(GameStatus.STATUS_PLAYING);
    };

    if (GameStatus.STATUS_WAITING === gameStatus) {
        return (
            <div className="container-fluid">
                <div className="row">
                    <div className="col-12">
                        Waiting for other players...
                        {JSON.stringify(playerMe)}
                        {
                            playerMe
                            &&
                            playerMe.isHost
                            &&
                            <form onSubmit={onStartGameFormSubmit}>
                                <div>
                                    Settings: you can change settings here!
                                    <ul>
                                        <li>Language
                                            <select name="language">
                                                <option value="en-EN">English</option>
                                                <option value="nl-NL">Nederlands</option>
                                            </select>
                                        </li>
                                        <li>Time on clock</li>
                                        <li>Rounds</li>
                                        <li>Difficulty?</li>
                                        <li>Maybe more</li>
                                    </ul>
                                </div>
                                <button type="submit"
                                        className="btn"
                                        disabled={players.length <= 1}>
                                    Start
                                </button>
                            </form>
                        }
                        {
                            players.length >= 2
                            &&
                            playerMe
                            &&
                            !playerMe.isHost
                            &&
                            playerHost
                            &&
                            <p>Waiting for {playerHost.username} to start the game.</p>
                        }

                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div>
                <div className="row justify-content-center" style={{ backgroundColor: '#FAFAFA', paddingTop: "20px" }}>
                    <div>
                        <div>
                            <Canvas width={windowSize.width * 0.9} drawColor={playerMe.assignedColor} isInteractive={iCanDraw} />
                        </div>
                        <ChatInput onChatMessage={onChatMessage}/>
                    </div>
                </div>

            </div>
            { isMyTurn && guessWords && null === chosenWord && <ChooseWordOverlay words={guessWords} onWordSelected={onWordSelected} /> }
        </div>
    );
};
