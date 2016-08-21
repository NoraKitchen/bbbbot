'use strict';

const https = require('https'),
      request = require('request'),
      config = require('config');

// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN) ? (process.env.MESSENGER_PAGE_ACCESS_TOKEN) : config.get('pageAccessToken');


// Facebook class
class FBoperations {

  receivedMessageEvent (event, searchPoint, callback){

    if (event.message)         {this.receivedMessage(event, searchPoint);
    } else if (event.postback) {this.receivedPostback(event, searchPoint);
    } else if (event.read)     {this.receivedMessageRead(event);
    } else if (event.delivery) {this.receivedDeliveryConfirmation(event);
    } else { console.log("Webhook received unknown messagingEvent: ", event);
    }
    callback(searchPoint)
  };

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
  showListOfBusiness(searchPoint, bbbapi, callback) {

    bbbapi.createList(searchPoint, function(data){
      let messageData = {};
      if(!data) { 
          messageData = {
            recipient: { id: searchPoint.userId },
            message:   { text: " Sorry nothing. Try again please.", metadata: "TEXT" }
          };
        } else {
          messageData = {
            recipient: { id: searchPoint.userId },
            message: { attachment: { type: "template", payload: { template_type: "generic", elements: data }}}
          };
          console.log("Send list of business to sender " + searchPoint.userId);
        };
      callback(messageData);
    });
  };

  receivedPostback(event, searchPoint) {

    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfPostback = event.timestamp;
    var payload = event.postback.payload;
    console.log("Received postback for user %d and page %d with payload '%s' at %d", senderID, recipientID, payload, timeOfPostback);

    switch (payload) {
      case 'GET_START':
            this.startConversation(senderID, function(greetings){
              this.sendMessage(greetings);
              this.searchMenu(senderID);
            })
            break;
      case 'SEARCH_BY_NAME':
            this.sendMessage(searchPoint.askName(senderID));
            break;
        case 'SEARCH_BY_CATEGORY':
            this.sendMessage(searchPoint.askCategory(senderID));
            break;
        case 'LOCATION_STATE':
            this.sendMessage(searchPoint.askState(senderID));
            break;
        case 'LOCATION_ZIP':
            this.sendMessage(searchPoint.askZip(senderID));
            break;
    }
    return searchPoint;
  };

  receivedMessage(event, searchPoint) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;
  var messageId = message.mid;
  var messageText = message.text;
  var quickReply = message.quick_reply;
  console.log("Received message for user %d and page %d at %d with message:",senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

    // QUICK REPLAY HAS RETURNED THE STATE
    if (quickReply) {
      console.log("Quick reply for message %s with payload %s", messageId, quickReply.payload);
      searchPoint.state = quickReply.payload;
      this.sendMessage(searchPoint.askCity(senderID));
      return;
    }

    // MESSAGE HAS RETURNED
    let mText = messageText.toLowerCase().trim();
    if (mText) {
    
      if(searchPoint.name == 'WAIT') {
        searchPoint.name = mText;
        searchPoint.category = false;
        this.sendMessage(searchPoint.askLocation(senderID));
      }
      if(searchPoint.category == 'WAIT'){
        searchPoint.category = mText;
        searchPoint.name = false;
        this.sendMessage(searchPoint.askLocation(senderID));
      }
      if(searchPoint.zip == 'WAIT') {
        searchPoint.zip = mText;
        searchPoint.city = false;
        searchPoint.state = false;
        this.showListOfBusiness(searchPoint, bbbapi, (data) => this.sendMessage(data));
      }
      if(searchPoint.city == 'WAIT') {
        searchPoint.city = mText;
        searchPoint.zip = false;
        this.showListOfBusiness(searchPoint, bbbapi, (data) => this.sendMessage(data));
      }

      switch (mText) {
        case 'menu':
          this.searchMenu(senderID);
          break;
        case 'hello':
        case 'hi':
          this.sendTextMessage(senderID, mText);
          break;
        case 'help':
          this.sendTextMessage(senderID, 'There should be help message');
          break;
      }
    }// message end

    return searchPoint;
  }







};

module.exports = new FBoperations;