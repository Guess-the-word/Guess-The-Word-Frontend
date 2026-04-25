import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Form, Button, Card } from 'react-bootstrap';
import './HomePage.css';

const HomePage: React.FC = () => {
  const [roomName, setRoomName] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomName.trim()) {
      navigate(`/room/${roomName}`);
    }
  };

  return (
    <Container className="home-container">
      <Row className="justify-content-center">
        <Col md={8} lg={6}>
          <Card className="home-card">
            <Card.Body>
              <h1 className="text-center mb-4">Guess The Word</h1>
              <p className="text-center mb-4">
                Join a room to play with friends! Describe words without saying them and see if your team can guess correctly.
              </p>
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Enter Room Name</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g., FunRoom123"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    required
                  />
                </Form.Group>
                <div className="d-grid">
                  <Button variant="primary" type="submit" size="lg">
                    Join Room
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default HomePage;
