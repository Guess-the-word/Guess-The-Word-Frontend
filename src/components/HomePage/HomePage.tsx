import React, { useState } from "react";
import "./HomePage.css";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Logo from "./simple_logo.svg";
import Image from "react-bootstrap/Image";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Col from "react-bootstrap/Col";
import Alert from 'react-bootstrap/Alert';

export const HomePage = () => {

  const [roomName, setRoomName] = useState("");
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [show, setShow] = useState(false);

  const fn = () => {
    var letterNumber = /^[0-9a-zA-Z]+$/;
    console.log(letterNumber.test(roomName));
    if((roomName.length < 4 || roomName.length > 10)) {
      setShowError(true);
      setShow(true);
      setErrorMessage("Length should be between 4 and 10 characters");
    }
    else if(!letterNumber.test(roomName)) {
      setShowError(true);
      setShow(true);
      setErrorMessage("Room name should only include letters and numbers");
    }
  } 

  function handleRoomNameChange(e: React.ChangeEvent<HTMLInputElement>):void{
    setRoomName(e.target.value);
  }

  return (
    
      <Container fluid className="mainContainer">
        <Row className="justify-content-center logoRow">
          <Image src={Logo} alt="service logo" className="logoImage" />
        </Row>
        <Row className="justify-content-center inputRow">
          <Container>
          {show && showError && 
          <Alert variant="danger" onClose={() => setShow(false)} dismissible>
            <p>
              {errorMessage}
            </p>
          </Alert>}
            <Form.Group>
              <Col sm={{ span: 4, offset: 4 }}>
                <Form.Control
                  type="text"
                  placeholder="Enter Room Name"
                  className="mt-5"
                  onChange = {(e: React.ChangeEvent<HTMLInputElement>) => handleRoomNameChange(e)}
                />
              </Col>
            </Form.Group>
            <Button onClick={fn} variant="primary">Submit</Button>
          </Container>
        </Row>
      </Container>
    
  );
};
