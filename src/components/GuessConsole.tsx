import React from 'react';
import { Card, Badge } from 'react-bootstrap';
import './GuessConsole.css';

interface GuessConsoleProps {
  guessConsole: {
    player: string;
    guess: string;
    correct: boolean;
    timestamp: number;
  }[];
  nicknames: {
    [socketId: string]: string
  };
}

const GuessConsole: React.FC<GuessConsoleProps> = ({ guessConsole, nicknames }) => {
  // Get nickname for a socket ID
  const getNickname = (socketId: string) => {
    return nicknames[socketId] || socketId.substring(0, 6);
  };

  return (
    <Card className="guess-console">
      <Card.Header>
        <h4>Guess Console</h4>
      </Card.Header>
      <Card.Body>
        <div className="console-messages">
          {guessConsole.length === 0 ? (
            <div className="text-muted text-center">No guesses yet</div>
          ) : (
            guessConsole.slice().reverse().map((entry, index) => (
              <div 
                key={index} 
                className={`console-entry ${entry.correct ? 'correct-guess' : 'incorrect-guess'}`}
              >
                <span className="player-name">{getNickname(entry.player)}:</span>
                <span className="guess-text">{entry.guess}</span>
                <Badge bg={entry.correct ? 'success' : 'danger'}>
                  {entry.correct ? 'Correct!' : 'Incorrect'}
                </Badge>
              </div>
            ))
          )}
        </div>
      </Card.Body>
    </Card>
  );
};

export default GuessConsole;
