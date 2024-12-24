import React, { useState, useEffect } from "react";
import "./HomePage.css";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Image from "react-bootstrap/Image";
import { Button, Form, Col, Alert } from "react-bootstrap";
// TODO: Install react-router-dom package using:
// npm install react-router-dom @types/react-router-dom
import { useNavigate } from "react-router-dom";
import { socket } from "../../services/socket";

export const HomePage = () => {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState("");
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [show, setShow] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    // Listen for successful room join
    socket.on('roomUpdate', ({ roomName }: { roomName: string, players: any[] }) => {
      setIsJoining(false);
      navigate(`/room/${roomName}`);
    });

    return () => {
      socket.off('roomUpdate');
    };
  }, [navigate]);

  const validateInput = (inputSize: number) => {
    const letterNumber = /^[0-9a-zA-Z]+$/;
    if (inputSize < 4 || inputSize > 10) {
      setShowError(true);
      setShow(true);
      setErrorMessage("Length should be between 4 and 10 characters");
      return false;
    } else if (!letterNumber.test(roomName)) {
      setShowError(true);
      setShow(true);
      setErrorMessage("Room name should only include letters and numbers");
      return false;
    } else {
      setShowError(false);
      return true;
    }
  };

  const handleSubmit = () => {
    if (validateInput(roomName.length)) {
      setIsJoining(true);
      socket.emit('joinRoom', { roomName });
    }
  };

  function handleRoomNameChange(e: React.ChangeEvent<HTMLInputElement>): void {
    setRoomName(e.target.value);
    validateInput(e.target.value.length);
  }

  return (
    <Container fluid className="mainContainer">
      <Row className="justify-content-center logoRow">
        <h1>Guess The Word</h1>
      </Row>
      <Row className="justify-content-center inputRow">
        <Container>
          <div style={{ height: "3rem", width: "26rem", margin: "1rem auto" }}>
            {show && showError && (
              <Alert variant="danger" style={{ padding: "10px" }}>
                {errorMessage}
              </Alert>
            )}
          </div>
          <div>
            <Form.Group>
              <Col sm={{ span: 4, offset: 4 }}>
                <Form.Control
                  type="text"
                  placeholder="Enter Room Name"
                  className="mt-3"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleRoomNameChange(e)
                  }
                />
              </Col>
            </Form.Group>
            <Button
              onClick={handleSubmit}
              variant="primary"
              disabled={isJoining}
            >
              {isJoining ? 'Joining...' : 'Submit'}
            </Button>
          </div>
        </Container>
      </Row>
    </Container>
  );
};
