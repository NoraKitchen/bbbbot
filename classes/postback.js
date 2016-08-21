

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
            fbo.searchMenu(senderID);
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