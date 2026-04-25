import React from 'react';
import { Card, ListGroup } from 'react-bootstrap';
import './PlayersList.css';

interface PlayersListProps {
  players: string[];
  nicknames: {
    [socketId: string]: string
  };
  describer: string;
}

const PlayersList: React.FC<PlayersListProps> = ({ players, nicknames, describer }) => {
  // Get nickname for a socket ID
  const getNickname = (socketId: string) => {
    return nicknames[socketId] || socketId.substring(0, 6);
  };

  return (
    <Card className="players-list">
      <Card.Header>
        <h4>Players in Room</h4>
      </Card.Header>
      <Card.Body>
        <ListGroup>
          {players.map((playerId) => (
            <ListGroup.Item 
              key={playerId}
              active={describer === playerId}
              className={describer === playerId ? 'describer' : ''}
            >
              {getNickname(playerId)}
              {describer === playerId && ' (Describer)'}
            </ListGroup.Item>
          ))}
        </ListGroup>
      </Card.Body>
    </Card>
  );
};

export default PlayersList;
