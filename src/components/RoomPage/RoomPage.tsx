import React, { useState } from "react";
import Container from "react-bootstrap/Container";
export const RoomPage = (props: any) => {
    const { state } = props.location;
    console.log(state);
    return (
        <Container fluid className="mainContainer">
            <h1> {state[0]}'s Room </h1>
        </Container>
    );
};

export default RoomPage;
