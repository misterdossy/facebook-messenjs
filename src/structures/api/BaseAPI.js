const crypto = require('crypto');
const Message = require('../message/Message');
const Client = require('../client/Client');
const events = require('../events/Events');
const express = require('express');

const sendUnauthorized = (res) => res.status(403).send("Unauthorized.");

class BaseAPI {
    /**
     * @param {Client} client - Facebook Messenger chatbot client
     * @param {Client} route - Route for Facebook Messenger webhook
     * @param {Object} options - Options for BaseAPI
     * @property {Boolean} validation - If API should only receive calls from Facebook
     */
    constructor(client, route = "/", options = {
        validation: true
    }) {
        this.client = client;
        this.validation = options.validation;
        
        // Initialization of API
        this.app = express();
        this.app.use(express.json());

        this.app.get(route, (req, res) => {
            if (("hub.challenge" in req.query) && ("hub.verify_token" in req.query)) {
                if (req.query["hub.verify_token"] === client.verifyToken) {
                    res.send(req.query["hub.challenge"]);
                } else {
                    sendUnauthorized(res);
                }

                let verifyData = {
                    success: req.query["hub.verify_token"] === client.verifyToken,
                    date: new Date()
                };
                this.client.emit("webhookVerify", verifyData);
            } else {
                sendUnauthorized(res);
            }
        });

        this.app.post(route, (req, res) => {
            if (!("x-hub-signature" in req.headers)) {
                sendUnauthorized(res);
                return;
            }

            if (req.body) {
                if (this.validation) {
                    let hubSignature = req.headers["x-hub-signature"];
                    let expectedSignature = `sha1=${
                        crypto.createHmac('sha1', this.client.appSecret)
                            .update(JSON.stringify(req.body))
                            .digest("hex")
                    }`;
    
                    if (hubSignature !== expectedSignature) {
                        sendUnauthorized(res);
                        return;
                    }
                }

                if ("messaging" in req.body.entry[0]) {
                    let payload = req.body.entry[0].messaging[0];
                    if ("message" in payload) {
                        let message = new Message(this.client, payload);

                        /**
                         * Receive message event
                         * @event Client#messages
                         * @type {Message}
                         */
                        this.client.emit("messages", message);
                    } else if ("optin" in payload) {
                        let optinEvtData = JSON.parse(JSON.stringify(payload.optin));
                        optinEvtData.sender = this.client.profileManager.fetch(payload.sender.id, "profile");
                        optinEvtData.recipient = this.client.profileManager.fetch(payload.recipient.id, "profile");
                        optinEvtData.timestamp = payload.timestamp;

                        /**
                         * Receive optin event
                         * @event Client#messagingOptin
                         * @type {Message}
                         */
                        this.client.emit("messagingOptin", optinEvtData);
                    } else if ("account_linking" in payload) {
                        let acctLinkData = JSON.parse(JSON.stringify(payload.account_linking));
                        acctLinkData.sender = this.client.profileManager.fetch(payload.sender.id, "profile");
                        acctLinkData.recipient = this.client.profileManager.fetch(payload.recipient.id, "profile");
                        acctLinkData.timestamp = payload.timestamp;

                        /**
                         * Receive message account linking event
                         * @event Client#accountLinking
                         * @type {Message}
                         */
                        this.client.emit("accountLinking", acctLinkData);
                    } else if ("policy_enforcement" in payload) {
                        let policyEnforcementData = JSON.parse(JSON.stringify(payload.policy_enforcement));
                        policyEnforcementData.recipient = this.client.profileManager.fetch(payload.recipient.id, "profile");
                        policyEnforcementData.timestamp = payload.timestamp;

                        /**
                         * Receive policy enforcement event
                         * @event Client#policyEnforcement
                         * @type {Message}
                         */
                        this.client.emit("policyEnforcement", policyEnforcementData);
                    } else if ("delivery" in payload) {
                        let deliveryEvent = new events.DeliveryEvent(this.client, payload);

                        /**
                         * Receive message event
                         * @event Client#messageDelivery
                         * @type {ReadEvent}
                         */
                        this.client.emit("messageDelivery", deliveryEvent);
                    } else if ("postback" in payload) {
                        let postbackEvent = new events.PostbackEvent(this.client, payload);

                        /**
                         * Receive message event
                         * @event Client#messagingPostback
                         * @type {ReadEvent}
                         */
                         this.client.emit("messagingPostback", postbackEvent);
                    } else if ("referral" in payload) {
                        let referralData = JSON.parse(JSON.stringify(payload.referral));
                        referralData.sender = this.client.profileManager.fetch(payload.sender.id, "profile");
                        referralData.recipient = this.client.profileManager.fetch(payload.recipient.id, "profile");
                        referralData.timestamp = payload.timestamp;

                        /**
                         * Receive referral event
                         * @event Client#referral
                         * @type {Message}
                         */
                        this.client.emit("referral", referralData);
                    } else if ("reaction" in payload) {
                        let reactionEvent = new events.ReactionEvent(this.client, payload);

                        /**
                         * Receive message event
                         * @event Client#messageReaction
                         */
                        this.client.emit("messageReaction", reactionEvent);
                    } else if ("read" in payload) {
                        let readEvent = new events.ReadEvent(this.client, payload.read[0]);

                        /**
                         * Receive message event
                         * @event Client#messageRead
                         * @type {ReadEvent}
                         */
                        this.client.emit("messageRead", readEvent);
                    }
                }
            }

            res.send("Awts gege.");
        });
    }

    /**
     * @param {Number} port Port number of API
     * @param {Function} fn Function executed after activation of API
     */
    listen(port, fn) { this.app.listen(port, fn); }
}

module.exports = BaseAPI;