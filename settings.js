var cb = {

	apiUrl: "https://api3.codebasehq.com", //Note, this must be listed in the manifest

	settingsFormSubmit: function(){
		var $this = $(this);
		var username = $this.find("#username").val();
		var api_key = $this.find("#api_key").val();
		cb.setSiteInfoInLocalStorage(username, password);
		getProjectsList(username, password);
		return false;
	},

	getProjectsList: function(){
		// Returns an array of [Name, url] pairs for all projects in the user's account
		$.ajax({
			url: ab.apiURL + "/projects",
			accepts: "application/xml",
			contentType: "application/xml",
			username: username,
			password: apiKey,
			success: $.proxy(getProjectsCallback, null, username)
		});
	},

	getProjectsCallback: function(data, status, jqXHR, username){
		console.log("Codebase API response...");
		console.log(status);
		console.log(data);
		console.log(username);
	}
};

$("form").submit(cb.settingsFormSubmit);

console.log("Settings JS loaded.");
