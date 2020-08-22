import React from "react";
import "./HomePage.css";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Logo from "./simple_logo.svg";
import Image from "react-bootstrap/Image";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";

export const HomePage = () => {
  return (
    <Container fluid className="mainContainer">
      <Row className="justify-content-center logoRow">
        <Image src={Logo} alt="service logo" className="logoImage" />
      </Row>
      <Row className="justify-content-center inputRow">
        <Container className="justify-content-center containerCheck">
          <Form.Group>
            <Form.Control
              type="text"
              placeholder="Enter Room Name"
              className="roomInput"
            />
          </Form.Group>
          <Button variant="primary">Large button</Button>
        </Container>
      </Row>
    </Container>
  );
};
