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
  fbo = require('./classes/fbclass'),
  bbbapi = require('./classes/bbbapi'),
  sessions = require('./classes/sessions'),
  witActions = require('./classes/wit_app/wit-actions');

let Wit = null;
try {
  // if running from repo
  Wit = require('../').Wit;
} catch (e) {
  Wit = require('node-wit').Wit;
}

let currentSessions = {};

// let Datastore = require('nedb'),
//     db = new Datastore({ filename: 'data/users', autoload: true });
//     db.loadDatabase(err => console.log(" DB error :" + err));

app.set('port', process.env.PORT || 8080);
app.use(bodyParser.json({ verify: verifyRequestSignature }));
app.use(express.static('public'));




// App Secret can be retrieved from the App Dashboard
const APP_SECRET = (process.env.MESSENGER_APP_SECRET) ? process.env.MESSENGER_APP_SECRET : config.get('appSecret');

// Arbitrary value used to validate a webhook
const VALIDATION_TOKEN = (process.env.MESSENGER_VALIDATION_TOKEN) ? (process.env.MESSENGER_VALIDATION_TOKEN) : config.get('validationToken');

// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN) ? (process.env.MESSENGER_PAGE_ACCESS_TOKEN) : config.get('pageAccessToken');

// URL where the app is running (include protocol). Used to point to scripts and assets located at this address. 
const SERVER_URL = (process.env.SERVER_URL) ? (process.env.SERVER_URL) : config.get('serverURL');

const WIT_TOKEN = config.get("witToken");

if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN && SERVER_URL)) {
  console.error("Missing config values");
  process.exit(1);
};

// //WELCOME SCREEN BUTTON
// fbo.welcomeButton(PAGE_ACCESS_TOKEN);

// SETUP WEBHOOK
app.get('/webhook', function (req, res) {
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
    data.entry.forEach(function (pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;
      var senderID = pageEntry.messaging[0].sender.id;

      // if (senderID != pageID){
      //what is this pageID about?
      // };
      var sessionID = sessions.findOrCreateSession(senderID, currentSessions);

      // Iterate over each messaging event
      pageEntry.messaging.forEach(function (messagingEvent) {
        // fbo.receivedMessageEvent(messagingEvent, currentSessions[sessionID], bbbapi, (updatedContext) => currentSessions[sessionID.context = updatedContext])
        fbo.receivedMessageEvent(messagingEvent, currentSessions[sessionID], bbbapi, function (updatedContext) {
          console.log("sending updated context to wit:");
          console.log(updatedContext);
          wit.runActions(senderID, updatedContext.userInput, updatedContext).then(function (witUpdatedContext) {
            console.log("Wit returned context:")
            console.log(witUpdatedContext);
            currentSessions[sessionID].context = witUpdatedContext;

            if (currentSessions[sessionID].context.endSession) {
              //search returned no results, ending session to restart search
              console.log("restarting session")
              delete currentSessions[sessionID];
            }
          });
        })


      });
    });


    // if (senderID != pageID){
    //   db.find({ userId: senderID}, function (err, user) {
    //     let sp = new SearchPoint();
    //     if( user.length == 0) {
    //       sp.userId = senderID;
    //       db.insert(sp);
    //       } else { sp.reload(user[0]);
    //     };

    //   // Iterate over each messaging event
    //   pageEntry.messaging.forEach(function(messagingEvent) {
    //     fbo.receivedMessageEvent(messagingEvent, sp, bbbapi, (updatedSearchPoint) => db.update({ userId: senderID}, updatedSearchPoint, {}))
    //   }); // end of loop
    //   }); // end of find
    // }; //end of if


    // }); // end of loop

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

var wit = new Wit({ accessToken: WIT_TOKEN, actions: witActions.actions });

/////////////////////////////////////////////////////////////////////
// START SERVER
app.listen(app.get('port'), function () {
  console.log('Facebook bot app is running on port', app.get('port'));
});


