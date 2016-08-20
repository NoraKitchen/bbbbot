'use strict';

const https = require('https'),
      request = require('request'),
      config = require('config');

// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN) ? (process.env.MESSENGER_PAGE_ACCESS_TOKEN) : config.get('pageAccessToken');


// Facebook class
class FBoperations {

  receivedDeliveryConfirmation(event) {
    let delivery = event.delivery;
    let messageIDs = delivery.mids;
    let watermark = delivery.watermark;

    if (messageIDs) messageIDs.forEach(function(messageID) { console.log("Received delivery confirmation for message ID: %s", messageID)});
    console.log("All message before %d were delivered.", watermark);
  }
  
  receivedMessageRead(event) {
    let watermark = event.read.watermark;
    let sequenceNumber = event.read.seq;
    console.log("Received message read event for watermark %d and sequence number %d", watermark, sequenceNumber);
  }

  // Welcome button for the first visit
  welcomeButton(){
    request({
        method: 'POST',
        uri: 'https://graph.facebook.com/v2.7/me/thread_settings?access_token='+PAGE_ACCESS_TOKEN,
        json: true,
        qs: {
            setting_type: 'call_to_actions',
            thread_state: 'new_thread',
            call_to_actions: [{ payload: 'GET_START' }]
            },
        }, (error, response, body) => {
            if (!error && response.statusCode == 200) {
              let recipientId = body.recipient_id;
              let messageId = body.message_id;
              if (messageId) { console.log("Successfully sent message with id %s", messageId);
              } else { console.log("Successfully called Send API"); }
              } else { console.error(response.error); }
    });
  };

  // Send message to Facebook API
  sendMessage(messageData) {
    request({
      uri: 'https://graph.facebook.com/v2.7/me/messages',
      qs: { access_token: PAGE_ACCESS_TOKEN },
      method: 'POST',
      json: messageData

      }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
          let recipientId = body.recipient_id;
          let messageId = body.message_id;

          if (messageId) { console.log("Successfully sent message with id %s to recipient %s", messageId, recipientId);
            } else { console.log("Successfully called Send API for recipient %s", recipientId);
          }
        } else { console.error(response.error);
    };});
  };

  // Start topin for conversation
  startConversation(recipientId, callback){
    let greetings;
    request({
      url: 'https://graph.facebook.com/v2.7/'+recipientId,
      qs: {access_token: PAGE_ACCESS_TOKEN},
      method: 'GET'
      }, function(error, response, body) {
        if (error) { console.log('Error sending message: ', error);
          } else if (response.body.error) { console.log('Error: ', response.body.error);
          } else {
            let name = JSON.parse(body);
            greetings = {
              recipient: { id: recipientId },
              message:   { text: "Hello "+ name.first_name+" "+ name.last_name + ", we can help you to find appropriate business in the northwest region"},
            };
          };
        callback(greetings);
        });
  }

  // Send search initial menu
  searchMenu (recipientId){
    let messageData = {
      recipient: { id: recipientId },
      message:   {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text: "How do you prefer to search by?",
              buttons:[
                { type: "postback", title: "Name of business", payload: "SEARCH_BY_NAME" },
                { type: "postback", title: "Category",         payload: "SEARCH_BY_CATEGORY"},
                { type: "web_url",  title: "OR visit our site", url: "https://www.bbb.org/northwest/"}
                      ]
    }}}};
    this.sendMessage(messageData);
  };

  // Send simple text messsage
  sendTextMessage(recipientId, messageText) {
    let messageData = {
      recipient: { id: recipientId },
      message:   { text: messageText, metadata: "TEXT" }
    };
    this.sendMessage(messageData);
  }

  ////// SHOW RESPONCE FROM BBB API
  showListOfBusiness(sp, bbbapi, callback) {

    bbbapi.createList(sp, function(data){
      let messageData = {};
      if(!data) { 
          messageData = {
            recipient: { id: sp.userId },
            message:   { text: " Sorry nothing. Try again please.", metadata: "TEXT" }
          };
        } else {
          messageData = {
            recipient: { id: sp.userId },
            message: { attachment: { type: "template", payload: { template_type: "generic", elements: data }}}
          };
          console.log("Send list of business to sender " + sp.userId);
        };
      callback(messageData);
    });

};
 




};

module.exports = new FBoperations;