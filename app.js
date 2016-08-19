'use strict';

const 
    bodyParser = require('body-parser'),
    config = require('config'),
    crypto = require('crypto'),
    express = require('express'),
    https = require('https'),
    request = require('request');
  
let app = express(),
    SearchPoint = require('./classes/searchpoint'),
    bbbapi = require('./classes/bbbapi'),
    fbo = require('./classes/fbclass');

let Datastore = require('nedb'),
    db = new Datastore({ filename: 'data/users', autoload: true });
    db.loadDatabase(err => console.log(" DB error :" + err));

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

//WELCOME SCREEN BUTTON
fbo.welcomeButton(PAGE_ACCESS_TOKEN);

// SETUP WEBHOOK
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VALIDATION_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
    } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);          
    };
  }
);

/*All callbacks for Messenger are POST-ed. They will be sent to the same webhook. 
 * Be sure to subscribe your app to your page to receive callbacks for your page. 
 * https://developers.facebook.com/docs/messenger-platform/product-overview/setup#subscribe_app */
app.post('/webhook', function (req, res) {
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object == 'page') {
      data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;
      var senderID = pageEntry.messaging[0].sender.id;
      if (senderID != '1130241563714158'){
        db.find({ userId: senderID}, function (err, user) {
         if( user.length == 0) {
            let sp = new SearchPoint();
            sp.userId = senderID;
            db.insert(sp);
        }
        // Iterate over each messaging event
        pageEntry.messaging.forEach(function(messagingEvent) {
          if (messagingEvent.message)           {receivedMessage(messagingEvent);
            } else if (messagingEvent.postback) {receivedPostback(messagingEvent);
            } else if (messagingEvent.read)     {fbo.receivedMessageRead(messagingEvent);
            } else if (messagingEvent.delivery) {fbo.receivedDeliveryConfirmation(messagingEvent);
            } else { console.log("Webhook received unknown messagingEvent: ", messagingEvent);
          }
        });
        });// end of db.find
      };
    });
    
    res.sendStatus(200);
  }
});


/*
 * Verify that the callback came from Facebook. Using the App Secret from the App Dashboard, 
 * we can verify the signature that is sent with each callback in the x-hub-signature field, located in the header.
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
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
    var expectedHash = crypto.createHmac('sha1', APP_SECRET).update(buf).digest('hex');

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
  var messageId = message.mid;
  var messageText = message.text;
  var quickReply = message.quick_reply;
  console.log("Received message for user %d and page %d at %d with message:",senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  let sp = new SearchPoint();
  db.find({ userId: senderID}, function (err, user) {
   sp.reload(user[0]);

    // QUICK REPLAY HAS RETURNED THE STATE
    if (quickReply) {
      console.log("Quick reply for message %s with payload %s", messageId, quickReply.payload);
      sp.state = quickReply.payload;
      fbo.sendMessage(sp.askCity(senderID));
      return;
    }

    // MESSAGE HAS RETURNED
    let mText = messageText.toLowerCase().trim();
    if (mText) {
    
      if(sp.name == 'WAIT') {
        sp.name = mText;
        sp.category = false;
        fbo.sendMessage(sp.askLocation(senderID));
      }
      if(sp.category == 'WAIT'){
        sp.category = mText;
        sp.name = false;
        fbo.sendMessage(sp.askLocation(senderID));
      }
      if(sp.zip == 'WAIT') {
        sp.zip = mText;
        sp.city = false;
        sp.state = false;
        showListOfBusiness(sp);
      }
      if(sp.city == 'WAIT') {
        sp.city = mText;
        sp.zip = false;
        showListOfBusiness(sp);
      }
      switch (mText) {
        case 'menu':
          fbo.searchMenu(senderID);
          break;
        case 'hello':
        case 'hi':
          sendTextMessage(senderID, mText);
          break;
        case 'help':
          sendTextMessage(senderID, 'There should be help message');
          break;
      }
    }// message end
  })


    db.remove({ userId: senderID}, { multi: true });
    db.insert(sp);
  
}


// POSTBACK EVENT. This event is called when a postback is tapped on a Structured Message. 
// Read more https://developers.facebook.com/docs/messenger-platform/webhook-reference/postback-received

function receivedPostback(event) {

  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;
  var payload = event.postback.payload;
  let sp = new SearchPoint();
  console.log("Received postback for user %d and page %d with payload '%s' at %d", senderID, recipientID, payload, timeOfPostback);

  db.find({ userId: senderID}, function (err, user) {
     sp.reload(user[0]);
  
  ///// SEARCH BY ITEM
  if (payload) {
    switch (payload) {
      case 'GET_START':
          fbo.startConversation(senderID, function(greetings){
            fbo.sendMessage(greetings);
            fbo.searchMenu();
          })
          break;
      case 'SEARCH_BY_NAME':
          fbo.sendMessage(sp.askName(senderID));
          break;
      case 'SEARCH_BY_CATEGORY':
          fbo.sendMessage(sp.askCategory(senderID));
          break;
      case 'LOCATION_STATE':
          fbo.sendMessage(sp.askState(senderID));
          break;
      case 'LOCATION_ZIP':
          fbo.sendMessage(sp.askZip(senderID));
          break;
  }}

    db.remove({ userId: senderID}, { multi: true });
    db.insert(sp);
});

};


// SHOW RESPONCE FROM BBB API
function showListOfBusiness(sp) {

  let newElements = [];
  bbbapi.createList(sp, API_TOKEN, function(data){

    if(!data) {sendTextMessage(sp.userId, "Sorry, nothing")
      } else {
        let messageData = {
          recipient: { id: sp.userId },
          message: { attachment: { type: "template", payload: { template_type: "generic", elements: data }}}
        };  
        fbo.sendMessage(messageData);
        console.log("Send list of business to sender " + sp.userId);
  }});
  db.remove({ userId: sp.userId}, { multi: true });
};
 
//////////////////////////////////////////////////////////////////////////////////////////////////
///////////// FACEBOOK FUNCTIONS /////////////////////////////////////////////////////////////////
// DELIVERY CONFIRMATION EVENT. This event is sent to confirm the delivery of a message.
///// https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-delivered
//////////////////////////////////////////////////////////////////////////////////////////////////

// START CONVERSATION
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
        fbo.sendMessage(greetings);
      }
    });
}


// SEND A TEXT MESSAGE
function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: { id: recipientId },
    message:   { text: messageText, metadata: "TEXT" }
  };
  fbo.sendMessage(messageData);
}



//////////////////////////////////////////////////////////////////////
// START SERVER
app.listen(app.get('port'), function() {
  console.log('Facebook bot app is running on port', app.get('port'));
});


