import React from 'react';
import {useMemo} from "react";

interface ChooseWordOverlayProps {
    words: ReadonlyArray<string>;
    onWordSelected: (word: string) => void;
}

const randomWord = (options: ReadonlyArray<string>, excludeWords: ReadonlyArray<string> = []) => {
    let word;
    while ('undefined' === typeof word || excludeWords.includes(word)) {
        word = options[Math.floor(Math.random() * options.length)]
    }
    return word;
};

export const ChooseWordOverlay: React.FC<ChooseWordOverlayProps> =
    ({ words, onWordSelected }) => {

        const onWordButtonClick = (word: string) => {
            onWordSelected(word);
        };

        // select three random words
        const wordOptions = useMemo<ReadonlyArray<string>>(() => Array.from(Array(3)).reduce((arr) => {
            return arr.concat(
                randomWord(words, arr)
            );
        }, []), []);

        console.log({wordOptions});

        return <div>
            <div className="modal fade show" style={{ display: 'block' }} id="exampleModal" tabIndex={-1} role="dialog"
                 aria-labelledby="exampleModalLabel" aria-hidden="true">
                <div className="modal-dialog" role="document">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title" id="exampleModalLabel">Choose a new word</h5>
                        </div>
                        <div className="modal-body">
                            {
                                wordOptions.map((word) =>
                                    <button key={word} onClick={() => onWordButtonClick(word)}>{word}</button>)
                            }
                        </div>
                    </div>
                </div>
            </div>
            <div className="modal-backdrop fade show"></div>
        </div>;

    };
