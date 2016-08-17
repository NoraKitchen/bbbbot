'use strict';

// SEARCHING OBJECT CONSTUCTOR
// This search point is an object includes nessesary data from user
class SearchPoint {

  constructor(name, option) {
      this.name = false;
      this.category = false;
      this.city = false;
      this.state = false;
      this.zip = false;
      this.userId = false;
  }

  setName (item) { this.name = item; }
  setCategory (item) {this.category = item;}
  setCity (item) {this.city = item; }
  setState (item) {this.state = item; }
  setZip (item) { this.zip = item;}
  setUserId (item) { this.userId = item; }
  
  // ASK COMPANY NAME
  askName (recipientId) {
    this.setName(200);
    let messageData = {recipient: { id: recipientId }, message: { text: "Fill out name" }};
    return messageData;
  };

  // ASK CATEGORY
  askCategory (recipientId) {
    this.setCategory(300);
    let messageData = {recipient: { id: recipientId },message: { text: "Fill out category"}};
    return messageData
  }

  // ASK CITY
  askCity (recipientId) {
    this.setCity(700);
    let messageData = { recipient: { id: recipientId }, message: { text: "Add city" }};
    return messageData;
  };

  // ASK ZIP
  askZip (recipientId) {
    sp.setZip(600);
    let messageData = { recipient: { id: recipientId }, message: { text: "Add post code" }};
    return messageData;
  }

  // ASK STATE
  askState (recipientId) {
    this.setState(500);
    let messageData = {
      recipient: { id: recipientId },
      message: {
        text: "Please choose the state",
        metadata: "STATE",
        quick_replies: [
          {"content_type":"text", "title":"Alaska",     "payload":"AK"},
          {"content_type":"text", "title":"Washington", "payload":"WA"},
          {"content_type":"text", "title":"Oregon",     "payload":"OR"},
          {"content_type":"text", "title":"Idaho",       "payload":"ID"},
          {"content_type":"text", "title":"Montana",     "payload":"MT"},  
          {"content_type":"text", "title":"Wyoming",     "payload":"WY"}
        ]
      }
    };
    return messageData;
  };

  askLocation (recipientId) {
    let messageData = {
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: "template",
          payload: {
            template_type: "button",
            text:  "Please add a location",
              buttons:[
                { type: "postback", title: "City, State", payload: "LOCATION_STATE"},
                { type: "postback", title: "Post code", payload: "LOCATION_ZIP"}
                ]
    }}}};
    return messageData;
  };

}

module.exports = SearchPoint;