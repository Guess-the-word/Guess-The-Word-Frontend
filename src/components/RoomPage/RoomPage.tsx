import React, { useState } from "react";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Button from "react-bootstrap/Button";

import "./RoomPage.css";
export const RoomPage = (props: any) => {
    const { state } = props.location;
    console.log(state);
    return (
        <Container fluid className="mainContainer">
            <Row className="logoR">
                <div className="titleBar"></div>
            </Row>
            <Row>
                <Col className="videoSection">Video</Col>

                <Col>
                    <Row className="participantSection">Participants</Row>
                    <Row className="messageSection">Messages</Row>
                </Col>
            </Row>
        </Container>
    );
};

export default RoomPage;
