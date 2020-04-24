import React from 'react';
import {useRef} from 'react';

interface ChatProps {
    onChatMessage: (message: string) => void;
}

export const ChatInput: React.FC<ChatProps> = (
    {
        onChatMessage,
    }
) => {

    const messageInputRef = useRef(null);


    const onFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (messageInputRef.current) {

            const input = messageInputRef.current as HTMLInputElement;

            const value = input.value.trim();
            if ('' !== value) {
                onChatMessage(value);
                // say it and then clear it
                input.value = '';
            }

        }
    };

    return (<div className="message-form">
            <form onSubmit={onFormSubmit}>
                <div className="input-group">
                    <input ref={messageInputRef}
                           id="message-input"
                           name="message-input"
                           type="text"
                           className="form-control input-sm"
                           placeholder="Type your guess or message here.."/>
                    <span className="input-group-btn">
                        <button
                            className="btn btn-primary">
                            Send
                        </button>
                    </span>
                </div>
            </form>
        </div>
    );

};
