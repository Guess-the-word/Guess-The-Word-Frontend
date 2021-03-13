import React, { useState } from "react";
import "./HomePage.css";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Logo from "./simple_logo.svg";
import Image from "react-bootstrap/Image";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Col from "react-bootstrap/Col";
import Alert from "react-bootstrap/Alert";
import axios from "axios";
import { Redirect } from "react-router-dom";

export const HomePage = (props: any) => {
    const [roomName, setRoomName] = useState("");
    const [showError, setShowError] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [show, setShow] = useState(false);

    const validateInput = (inputSize: number) => {
        const letterNumber = /^[0-9a-zA-Z]+$/;
        if (inputSize < 4 || inputSize > 10) {
            setShowError(true);
            setShow(true);
            setErrorMessage("Length should be between 4 and 10 characters");
        } else if (!letterNumber.test(roomName)) {
            setShowError(true);
            setShow(true);
            setErrorMessage(
                "Room name should only include letters and numbers"
            );
        } else {
            setShowError(false);
        }
    };
    const submitRoomName = async (roomName: string) => {
        console.log(roomName);
        try {
            // const res = await axios.get("/room");
            // console.log(res);
            props.history.push({
                pathname: "/room",
                state: [roomName],
            });
        } catch (e) {
            console.log(e);
        }
    };

    function handleRoomNameChange(
        e: React.ChangeEvent<HTMLInputElement>
    ): void {
        setRoomName(e.target.value);
        validateInput(e.target.value.length);
    }

    return (
        <Container fluid className="mainContainer">
            <Row className="justify-content-center logoRow">
                <Image src={Logo} alt="service logo" className="logoImage" />
            </Row>
            <Row className="justify-content-center inputRow">
                <Container>
                    <div
                        style={{
                            height: "3rem",
                            width: "26rem",
                            margin: "1rem auto",
                        }}
                    >
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
                                    onChange={(
                                        e: React.ChangeEvent<HTMLInputElement>
                                    ) => handleRoomNameChange(e)}
                                />
                            </Col>
                        </Form.Group>
                        <Button
                            onClick={() => {
                                validateInput(roomName.length);
                                submitRoomName(roomName);
                            }}
                            variant="primary"
                        >
                            Submit
                        </Button>
                    </div>
                </Container>
            </Row>
        </Container>
    );
};
