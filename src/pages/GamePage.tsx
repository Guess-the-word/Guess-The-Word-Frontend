import React from 'react';
import { Socket } from 'socket.io-client';
import { Container, Row, Col, Card, Button, Form, Badge, ListGroup } from 'react-bootstrap';
import './GamePage.css';

// Define types for the game state
interface GameState {
  roomName: string;
  players: string[];
  teams: {
    [teamId: string]: string[]
  };
  score: {
    [teamId: string]: number
  };
  status: "waiting" | "playing";
  currentTeam: string;
  describer: string;
  isDescriber: boolean;
  word: string;
  timeLeft: number;
  nicknames: {
    [socketId: string]: string
  };
  guessConsole: {
    player: string;
    guess: string;
    correct: boolean;
    timestamp: number;
  }[];
}

interface GamePageProps {
  socket: Socket;
  gameState: GameState;
  onStartGame: () => void;
  onResetGame: () => void;
  onGuessSubmit: (guess: string) => void;
}

const GamePage: React.FC<GamePageProps> = ({
  gameState,
  onStartGame,
  onResetGame,
  onGuessSubmit
}) => {
  const [guess, setGuess] = React.useState('');

  const handleGuessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (guess.trim()) {
      onGuessSubmit(guess);
      setGuess('');
    }
  };

  // Get nickname for a socket ID
  const getNickname = (socketId: string) => {
    return gameState.nicknames[socketId] || socketId.substring(0, 6);
  };

  // Determine if current user is the describer
  const isDescriber = gameState.isDescriber;

  return (
    <Container fluid className="game-container">
      <Row className="mb-4">
        <Col>
          <h1 className="text-center">Guess The Word</h1>
          <h3 className="text-center">Room: {gameState.roomName}</h3>
        </Col>
      </Row>

      <Row>
        {/* Game Status Panel */}
        <Col md={8}>
          <Card className="game-panel mb-4">
            <Card.Body>
              <Row>
                <Col>
                  <h4>Status: <Badge bg={gameState.status === 'playing' ? 'success' : 'warning'}>
                    {gameState.status === 'playing' ? 'Playing' : 'Waiting'}
                  </Badge></h4>
                </Col>
                <Col className="text-end">
                  <h4>Time Left: <Badge bg={gameState.timeLeft > 10 ? 'info' : 'danger'}>
                    {gameState.timeLeft}s
                  </Badge></h4>
                </Col>
              </Row>

              {gameState.status === 'playing' && (
                <Row className="mt-4">
                  <Col>
                    <h5>Current Team: <Badge bg="primary">Team {gameState.currentTeam}</Badge></h5>
                    <h5>Describer: <Badge bg="secondary">
                      {getNickname(gameState.describer)}
                    </Badge></h5>
                  </Col>
                </Row>
              )}

              {/* Word display for describer */}
              {gameState.status === 'playing' && isDescriber && (
                <div className="word-display mt-4 p-3">
                  <h3 className="text-center">Your Word:</h3>
                  <h2 className="text-center secret-word">{gameState.word}</h2>
                  <p className="text-center text-muted">
                    Describe this word to your team without saying it!
                  </p>
                </div>
              )}

              {/* Guess input for non-describers */}
              {gameState.status === 'playing' && !isDescriber && (
                <Form onSubmit={handleGuessSubmit} className="mt-4">
                  <Form.Group>
                    <Form.Label>Enter your guess:</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Type your guess here..."
                      value={guess}
                      onChange={(e) => setGuess(e.target.value)}
                    />
                  </Form.Group>
                  <Button type="submit" variant="primary" className="mt-2">
                    Submit Guess
                  </Button>
                </Form>
              )}

              {/* Game controls */}
              <div className="game-controls mt-4">
                {gameState.status === 'waiting' && (
                  <Button variant="success" onClick={onStartGame} size="lg" className="w-100">
                    Start Game
                  </Button>
                )}
                {gameState.status === 'playing' && (
                  <Button variant="warning" onClick={onResetGame}>
                    Reset Game
                  </Button>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Teams and Scores Panel */}
        <Col md={4}>
          <Card className="teams-box mb-4">
            <Card.Header>
              <h4>Teams & Scores</h4>
            </Card.Header>
            <Card.Body>
              {Object.keys(gameState.teams).map((teamId) => (
                <div key={teamId} className={`team-section team-${teamId} mb-3`}>
                  <h5>
                    Team {teamId} <Badge bg="info">{gameState.score[teamId]} points</Badge>
                  </h5>
                  <ListGroup>
                    {gameState.teams[teamId].map((playerId) => (
                      <ListGroup.Item 
                        key={playerId}
                        active={gameState.describer === playerId}
                      >
                        {getNickname(playerId)}
                        {gameState.describer === playerId && ' (Describer)'}
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                </div>
              ))}
            </Card.Body>
          </Card>

          {/* Guess Console */}
          <Card className="guess-console">
            <Card.Header>
              <h4>Guess Console</h4>
            </Card.Header>
            <Card.Body>
              <div className="console-messages">
                {gameState.guessConsole.slice().reverse().map((entry, index) => (
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
                ))}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default GamePage;
