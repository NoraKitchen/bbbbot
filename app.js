'use strict';

const 
    bodyParser = require('body-parser'),
    config = require('config'),
    crypto = require('crypto'),
    express = require('express'),
    https = require('https'),
    request = require('request');
  
let app = express(),
    SearchPoint = require('./searchpoint'),
    BBBapi = require('./bbbapi');

app.set('port', process.env.PORT || 5000);
app.use(bodyParser.json({ verify: verifyRequestSignature }));
app.use(express.static('public'));

// BBB api token 
const API_TOKEN = config.get('token');

// App Secret can be retrieved from the App Dashboard
const APP_SECRET = (process.env.MESSENGER_APP_SECRET) ? process.env.MESSENGER_APP_SECRET : config.get('appSecret');

// Arbitrary value used to validate a webhook
const VALIDATION_TOKEN = (process.env.MESSENGER_VALIDATION_TOKEN) ? (process.env.MESSENGER_VALIDATION_TOKEN) : config.get('validationToken');

// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN) ? (process.env.MESSENGER_PAGE_ACCESS_TOKEN) : config.get('pageAccessToken');

// URL where the app is running (include protocol). Used to point to scripts and assets located at this address. 
const SERVER_URL = (process.env.SERVER_URL) ? (process.env.SERVER_URL) : config.get('serverURL');

if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN && SERVER_URL)) {
  console.error("Missing config values");
  process.exit(1);
};


// SETUP WEBHOOK
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VALIDATION_TOKEN) {
      console.log("Validating webhook");
      res.status(200).send(req.query['hub.challenge']);
      } else {
      console.error("Failed validation. Make sure the validation tokens match.");
      res.sendStatus(403);          
  }  
});

/*All callbacks for Messenger are POST-ed. They will be sent to the same
 * webhook. Be sure to subscribe your app to your page to receive callbacks for your page. 
 * https://developers.facebook.com/docs/messenger-platform/product-overview/setup#subscribe_app
 */
app.post('/webhook', function (req, res) {
  var data = req.body;
  
  // Make sure this is a page subscription
  if (data.object == 'page') {
      data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      // Iterate over each messaging event
      pageEntry.messaging.forEach(function(messagingEvent) {
        if (messagingEvent.message)         {receivedMessage(messagingEvent);
        } else if (messagingEvent.delivery) {receivedDeliveryConfirmation(messagingEvent);
        } else if (messagingEvent.postback) {receivedPostback(messagingEvent);
        } else if (messagingEvent.read)     {receivedMessageRead(messagingEvent);
        } else {
          console.log("Webhook received unknown messagingEvent: ", messagingEvent);
        }
      });
    });
    res.sendStatus(200);
  }
});

//WELCOME SCREEN BUTTON
request({
    method: 'POST',
    uri: 'https://graph.facebook.com/v2.7/me/thread_settings?access_token='+PAGE_ACCESS_TOKEN,
    qs: {
        setting_type: 'call_to_actions',
        thread_state: 'new_thread',
            call_to_actions: [{ payload: 'GET_START' }]
        },
        json: true
    }, (error, response, body) => {
        if (!error && response.statusCode == 200) {
          var recipientId = body.recipient_id;
          var messageId = body.message_id;

          if (messageId) { console.log("Successfully sent message with id %s", messageId);
          } else { console.log("Successfully called Send API"); }
          } else { console.error(response.error); }
  });

////////////////////////////// NEW SEARCH POINT
var sp = new SearchPoint();

//////////////////////////// START CONVERSATION
function startConversation(recipientId){
  var name;
  request({
    url: 'https://graph.facebook.com/v2.7/'+recipientId,
    qs: {access_token: PAGE_ACCESS_TOKEN},
    method: 'GET'
  }, function(error, response, body) {
      if (error) { console.log('Error sending message: ', error);
      }else if (response.body.error) { console.log('Error: ', response.body.error);
            } else {
              name = JSON.parse(body);
              var greetings = {
                recipient: { id: recipientId },
                message:   {
                  attachment: {
                    type: "template",
                    payload: {
                      template_type: "button",
                      text: "Hello "+ name.first_name+" "+ name.last_name + ", we can help you to find appropriate business in the northwest region. How do you prefer to search by?",
                        buttons:[
                          { type: "postback", title: "Name of business", payload: "SEARCH_BY_NAME" },
                          { type: "postback", title: "Category",         payload: "SEARCH_BY_CATEGORY"},
                          { type: "web_url",  title: "OR visit our site", url: "https://www.bbb.org/northwest/"}
                          ]
                    }
                  }
                }
              };  
        callSendAPI(greetings);
      }
    });
}

/*
 * Verify that the callback came from Facebook. Using the App Secret from 
 * the App Dashboard, we can verify the signature that is sent with each 
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an error.
    console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', APP_SECRET)
                        .update(buf)
                        .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

/* Message Event
 *
 * This event is called when a message is sent to your page. The 'message' 
 * object format can vary depending on the kind of message that was received.
 * Read more at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-received
 */
function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message for user %d and page %d at %d with message:",senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var isEcho = message.is_echo;
  var messageId = message.mid;
  var appId = message.app_id;
  var metadata = message.metadata;

  // You may get a text or attachment but not both
  var messageText = message.text;
  var messageAttachments = message.attachments;
  var quickReply = message.quick_reply;

  if (isEcho) {
    // Just logging message echoes to console
    console.log("Received echo for message %s and app %d with metadata %s", messageId, appId, metadata);
    return;
  } else if (quickReply) {
    var quickReplyPayload = quickReply.payload;
    console.log("Quick reply for message %s with payload %s", messageId, quickReplyPayload);

// WHAEN WE ASK A STATE AND RESPONSE IS ONE OF THEM
    switch (quickReply.payload) {
      case 'AK': 
      case 'WA': 
      case 'OR': 
      case 'ID':               
      case 'MT':
      case 'WY':
        sp.setState(quickReply.payload);
        callSendAPI(sp.askCity(senderID));
        break;        
    }
    return;
  }

  if (messageText) {

    if(sp.name == 200) {
      sp.setName(messageText.trim());
      sp.setCategory(false);
      callSendAPI(sp.askLocation(senderID));
    }
    if(sp.category == 300){
      sp.category = messageText.trim();
      sp.name = false;
      callSendAPI(sp.askLocation(senderID));
    }
    if(sp.zip == 600) {
      sp.zip = parseInt(messageText.trim());
      sp.city = false;
      sp.state = false;
      showListOfBusiness(sp);
    }
    if(sp.city == 700) {
      sp.city = messageText.trim();
      sp.zip = false;
      showListOfBusiness(sp);
    }
  
    switch (messageText) {

      case 'menu':
        startConversation(senderID);
        break;

      case 'hello':
      case 'hi':
        sendTextMessage(senderID, messageText);
        break;
      
      case 'help':
        sendTextMessage(senderID, 'There should be help message');

      // default:
      //   sendTextMessage(senderID, messageText);
    }
  } else if (messageAttachments) {
    sendTextMessage(senderID, "Message with attachment received");
  }
}


/*Delivery Confirmation Event
 *
 * This event is sent to confirm the delivery of a message. Read more about 
 * these fields at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-delivered
 */
function receivedDeliveryConfirmation(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var delivery = event.delivery;
  var messageIDs = delivery.mids;
  var watermark = delivery.watermark;
  var sequenceNumber = delivery.seq;

  if (messageIDs) {
    messageIDs.forEach(function(messageID) {
      console.log("Received delivery confirmation for message ID: %s", messageID);
    });
  }
  console.log("All message before %d were delivered.", watermark);
}


/////// POSTBACK EVENT
/*
 * This event is called when a postback is tapped on a Structured Message. 
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/postback-received
 * 
 */
function receivedPostback(event) {

  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;
  var payload = event.postback.payload;

  console.log("Received postback for user %d and page %d with payload '%s' at %d", senderID, recipientID, payload, timeOfPostback);

 ///// SEARCH BY ITEM
  if (payload) {
    switch (payload) {
      case 'GET_START':
          sp.userId = senderID;
          startConversation(senderID);
          break;
      case 'SEARCH_BY_NAME':
          callSendAPI(sp.askName(senderID));
          break;
      case 'SEARCH_BY_CATEGORY':
          callSendAPI(sp.askCategory(senderID));
          break;
      case 'LOCATION_STATE':
          callSendAPI(sp.askState(senderID));
          break;
      case 'LOCATION_ZIP':
          callSendAPI(sp.askZip(senderID));
          break;
      default:
        sendTextMessage(senderID, "Postback called");
    }
  }
};


// SHOW RESPONCE FROM BBB API
function showListOfBusiness(sp) {
  let breq = new BBBapi();
  let newElements = breq.createList(sp, API_TOKEN);
  console.log(newElements);

  // var count = list.length; // count of elements should be more 0 and less 10 items

  // if (count > 10) count = 10;
  // if (count == 0)  { sendTextMessage (recipientId, "Sorry, we didn't find anything. Try again");
  // } else  { sendList (count) };

  // function sendList (newCount) {
  //   var newElements =[];
  //   for(var i=0; i < newCount; i++) {
  //   var curr = list[i];
  //   var obj = new Object();

  //     obj.title = curr.OrganizationName;
  //     obj.subtitle = curr.Address +" ,"+curr.City+" ,"+curr.StateProvince;
  //     obj.buttons = [];
  //     var secObj = new Object();
  //     secObj.type = "web_url";
  //     secObj.url = curr.ReportURL;
  //     secObj.title = "More information";
  //     obj.buttons.push(secObj);
  //     newElements.push(obj);
  //   }

  var messageData = {
    recipient: { id: sp.userId },
    message: { attachment: { type: "template", payload: { template_type: "generic", elements: newElements }}}
  };  
  callSendAPI(messageData);
  
  console.log("Send list of business with" + count + "number to sender "+recipientId);
};


/*Message Read Event
 *
 * This event is called when a previously-sent message has been read.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-read
 */
function receivedMessageRead(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var watermark = event.read.watermark;
  var sequenceNumber = event.read.seq;
  console.log("Received message read event for watermark %d and sequence number %d", watermark, sequenceNumber);
}

//////////// Send a text message using the Send API.

function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: { id: recipientId },
    message:   { text: messageText, metadata: "TEXT" }
  };
  callSendAPI(messageData);
}

/// Call the Send API. The message data goes in the body. 
/// If successful, we'll get the message id in a response 
function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.7/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

        if (messageId) {
          console.log("Successfully sent message with id %s to recipient %s", messageId, recipientId);
        } else {
          console.log("Successfully called Send API for recipient %s", recipientId);
        }
    } else {
        console.error(response.error);
    }
  });  
}

////////////////////////////////////////////////////////////////////////////////////////////
// BBB.org API
function makeLink (sp){
    var reqLink = '';
    if(sp.name) reqLink +='&PrimaryOrganizationName='+sp.name;
    if(sp.city) reqLink += '&City='+sp.city;
    if(sp.state) reqLink+= '&StateProvince='+sp.state;
    if (sp.category) reqLink += "&PrimaryCategory="+sp.category;
    if(sp.zip) reqLink += '&PostalCode='+sp.zip;

  findBusiness(reqLink, function (somedata) {

    if(somedata =="NoData") {
      sendTextMessage(sp.userId,"Sorry no data for this request")
    } else {
      showListOfBusiness(sp.userId, somedata);
    }
  });
};

function findBusiness(reqLink, callback) {

    var options = {
        host: 'api.bbb.org',
        port: 443,
        path: '/api/orgs/search?PageSize=10'+reqLink,
        method: 'GET',
        headers: {
        'User-Agent': 'Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US; rv:1.8.1.13) Gecko/20080311 Firefox/2.0.0.13',
        'Authorization': API_TOKEN
        }
    };
    
    var request = https.request(options, function(response){
        console.log('Status: ' + response.statusCode);
        response.setEncoding('utf8');
        var body = "";
        response.on('data', (chunk) => body+=chunk);

        response.on("end", function () {
            var nodes = JSON.parse(body);
            if(nodes.TotalResults)  console.log("Total Results: " + nodes.TotalResults);
            if(nodes.SearchResults) callback(nodes.SearchResults);
        });
    });

    request.on('error', function(error) {
        console.log('problem with request: ' + error.message);
        });
    request.end();
};



////////////////////////////////////////////////////////////////////////
app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

module.exports = app;

