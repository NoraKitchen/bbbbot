'use strict';
const https = require('https');


// Facebook class
class FBoperations {
  constructor() {};

  receivedDeliveryConfirmation(event) {
    var delivery = event.delivery;
    var messageIDs = delivery.mids;
    var watermark = delivery.watermark;

    if (messageIDs) messageIDs.forEach(function(messageID) { console.log("Received delivery confirmation for message ID: %s", messageID)});
    console.log("All message before %d were delivered.", watermark);
  }
  
  receivedMessageRead(event) {
    let watermark = event.read.watermark;
    let sequenceNumber = event.read.seq;
    console.log("Received message read event for watermark %d and sequence number %d", watermark, sequenceNumber);
  }
  

};

module.exports = new FBoperations;