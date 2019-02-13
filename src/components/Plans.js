import Header from "../Header";
import React, { Component } from 'react';
import { Container, Row, ProgressBar, Col, Card } from "react-bootstrap";

import './Plans.css'
import Circle from "./Circle";

const PlanDetails = [
    {
        price: 0,
        space: '1GB',
        stripePlan: null
    },
    {
        price: 4.49,
        space: '100GB',
        stripePlan: 'plan_EUaU5KuX0bbmMZ'
    },
    {
        price: 9.45,
        space: '1TB',
        stripePlan: 'plan_EUaULpk2iX6695'
    }
];


class Plans extends React.Component {

    constructor(props) {
        super(props);
    }
   

    render() {
    return (
    <Container fluid>


        <Container className="mt-3" style={{maxWidth: '784px'}}>
            <h2><strong>Storage Space</strong></h2>
            <p color="#404040" className="mt-3">Used storage space</p>
            <ProgressBar now={60} />


            <Row className="mt-3">
                <Col xs={12} md={6} sm={6}>
                    <Circle color="#007bff" /> Used storage space (8GB)
                </Col>
                
                <Col xs={12} md={6} sm={6}>
                    <Circle color="#e9ecef" /> Unused storage space (1GB)
                </Col>
            </Row>

            <hr className="mt-5" />

            <h2 className="mt-4">
                <strong>Storage Plans</strong>
            </h2>

            <Row className="mt-4">
                {PlanDetails.map(entry => <Col xs={12} md={4} sm={6}>
                    <Card onClick={(e) => { this.props.planHandler(entry); } }>
                        <Card.Header><h2>{entry.space}</h2></Card.Header>
                        <Card.Text>{entry.price == 0 ? 'Free' : '€' + entry.price + ' per month' }</Card.Text>
                    </Card>
                </Col>)}
            </Row>

            <hr />

            <p>Permanently Delete Account</p>

        </Container>


    </Container>);
    }
};

export default Plans;