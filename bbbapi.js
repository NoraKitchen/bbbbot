'use strict';

// BBB API searching
// This object take SearchPoint object and return array of businesses
class BBBapi {

  constructor(name, option) {
      this.name = false;
      this.category = false;
      this.city = false;
      this.state = false;
      this.zip = false;
      this.userId = false;
  }
}
/*
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

    request.on('error', (error) => {console.log('problem with request: '+error.message)});
    request.end();
};
*/


module.exports = BBBapi;