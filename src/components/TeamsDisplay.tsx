import React from 'react';
import { Card, Badge, ListGroup } from 'react-bootstrap';
import './TeamsDisplay.css';

interface TeamsDisplayProps {
  teams: {
    [teamId: string]: string[]
  };
  score: {
    [teamId: string]: number
  };
  nicknames: {
    [socketId: string]: string
  };
  describer: string;
  currentTeam: string;
}

const TeamsDisplay: React.FC<TeamsDisplayProps> = ({ 
  teams, 
  score, 
  nicknames, 
  describer,
  currentTeam
}) => {
  // Get nickname for a socket ID
  const getNickname = (socketId: string) => {
    return nicknames[socketId] || socketId.substring(0, 6);
  };

  return (
    <Card className="teams-display">
      <Card.Header>
        <h4>Teams & Scores</h4>
      </Card.Header>
      <Card.Body>
        {Object.keys(teams).map((teamId) => (
          <div 
            key={teamId} 
            className={`team-section team-${teamId} mb-3 ${currentTeam === teamId ? 'current-team' : ''}`}
          >
            <h5>
              Team {teamId} <Badge bg="info">{score[teamId]} points</Badge>
              {currentTeam === teamId && <Badge bg="success" className="ms-2">Current Turn</Badge>}
            </h5>
            <ListGroup>
              {teams[teamId].map((playerId) => (
                <ListGroup.Item 
                  key={playerId}
                  active={describer === playerId}
                  className={describer === playerId ? 'describer' : ''}
                >
                  {getNickname(playerId)}
                  {describer === playerId && ' (Describer)'}
                </ListGroup.Item>
              ))}
              {teams[teamId].length === 0 && (
                <ListGroup.Item className="text-muted">No players</ListGroup.Item>
              )}
            </ListGroup>
          </div>
        ))}
      </Card.Body>
    </Card>
  );
};

export default TeamsDisplay;
