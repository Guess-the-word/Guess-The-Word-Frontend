import React from "react";
import "./HomePage.css";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Logo from "./simple_logo.svg";
import Image from "react-bootstrap/Image";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Col from "react-bootstrap/Col";

export const HomePage = () => {
  return (
    <Container fluid className="mainContainer">
      <Row className="justify-content-center logoRow">
        <Image src={Logo} alt="service logo" className="logoImage" />
      </Row>
      <Row className="justify-content-center inputRow">
        <Container>
          <Form.Group>
            <Col sm={{ span: 4, offset: 4 }}>
              <Form.Control
                type="text"
                placeholder="Enter Room Name"
                className="mt-5"
              />
            </Col>
          </Form.Group>
          <Button variant="primary">Submit</Button>
        </Container>
      </Row>
    </Container>
  );
};
