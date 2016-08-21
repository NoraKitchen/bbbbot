// Get the user session. The session stores the fbid of the user the conversation belongs to, and the Wit context object built through the conversation
// After a successful search, session is wiped
// sessionId -> {fbid: facebookUserId, context: sessionState}

function findOrCreateSession(fbid, sessions) {
    var sessionId;
    // Let's see if we already have a session for the user fbid
    Object.keys(sessions).forEach(function (key) {
        if (sessions[key].fbid === fbid) {
            // Yep, got it!
            sessionId = key;
        }
    });
    if (!sessionId) {
        // No session found for user fbid, let's create a new one
        sessionId = new Date().toISOString();
        //setting to findByCategory manually here for testing
        // sessions[sessionId] = { fbid: fbid, context: {["uid"]: fbid, findByCategory: true} };
        sessions[sessionId] = { fbid: fbid, context: { ["uid"]: fbid } };
    }
    return sessionId;
};

module.exports = {
    findOrCreateSession: findOrCreateSession
}