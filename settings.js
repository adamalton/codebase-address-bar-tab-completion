var cb = {

	apiURL: "https://api3.codebasehq.com", //Note, this must be listed in the manifest
	siteLocalStorageKey: 'cb-abc-site',
	usernameChromeStorageKey: 'codebase-username',

	initPage: function(){
		// If the user has already got a Codebase site map stored, then change the display of a couple of things
		if(localStorage.getItem(cb.siteLocalStorageKey)){
			$("#help, #re_build").removeClass("hidden");
		}
		// Set up everything else
		$("form").each(cb.loadFormState).change(cb.storeFormState).submit(cb.settingsFormSubmit).find("#username").keypress(cb.storeFormState);
	},

	loadFormState: function(){
		// The Chrome extension's "browser_action" popup dialogue is a bit annoying in that if you
		// focus another window it disappears, and when you re-open it it doesn't keep its state
		// from last time.  So we store the previous-ly entered `username` value to help make this
		// less painful.
		var $this = $(this);
		chrome.storage.sync.get(cb.usernameChromeStorageKey, function(obj){
			var val = obj[cb.usernameChromeStorageKey] || null;
			if(val){
				$this.find("#username").val(val);
			}

		});
	},

	storeFormState: function(){
		// See loadFormState for why this exists
		var obj = {};
		// Allow this function to be called either on the form or on the username field directly
		var $this = $(this);
		var $username = $this.is("#username") ? $this : $this.find("#username");
		obj[cb.usernameChromeStorageKey] = $username.val();
		chrome.storage.sync.set(obj);
	},

	settingsFormSubmit: function(){
		log.log("Submit caught");
		log.clear();
		cb.clearFormErrors.call(this);
		log.log("Validating form...");
		var $this = $(this);
		if(!cb.validateForm.call(this)){
			return false;
		}
		log.log("Validation passed");
		cb.storeFormState.call(this);
		var username = $this.find("#username").val();
		var api_key = $this.find("#api_key").val();
		cb.getProjectsList(username, api_key);
		return false;
	},

	validateForm: function(){
		var $this = $(this);
		var ok = true;
		var $username = $this.find("#username");
		var $api_key = $this.find("#api_key");
		if(!$username.val().match(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/)){
			cb.addFormError($username, "Username should be in the format company-name/your-username");
			ok = false;
		}
		if(!$api_key.val().match(/^[a-zA-Z0-9_-]+$/)){
			cb.addFormError($api_key, "API key looks weird.");
			ok = false;
		}
		return ok;
	},

	addFormError: function($el, msg){
		$('<div/>', {'class': 'error'}).text(msg).insertAfter($el);
	},

	clearFormErrors: function(){
		$(this).find(".error").remove();
	},

	getProjectsList: function(username, api_key){
		// Returns an array of [Name, url] pairs for all projects in the user's account
		log.log("Preparing Codebase API request...");
		$.ajax({
			url: cb.apiURL + "/projects",
			accepts: "application/xml",
			contentType: "application/xml",
			username: username,
			password: api_key,
			success: $.proxy(cb.getProjectsCallback, null, username),
			error: $.proxy(cb.getProjectsCallback, null, username)
		});
		log.log("Fetching project information from Codebase...");
	},

	getProjectsCallback: function(username, data, status, jqXHR){
		if(status == "success"){
			log.log("Got successful response from Codebase API.");
			var company = username.split("/")[0];
			var site = cb.buildCodebaseSite(company, data);
			localStorage.setItem(cb.siteLocalStorageKey, JSONX.stringify(site));
			log.success("Done!");
			log.success("You can now use the 'cb' shortcut in the address bar to get tab-completed URLs for codebase!");
		}else{
			log.error("Sorry, something went wrong.");
			log.error("Maybe your Codebase credentials were incorrect?");
		}
	},



	buildCodebaseSite: function(company, projects_dom){
		log.log("Building codebase URL list...");
		var site = {
			name: "Codebase",
			baseURL: "https://" + company + ".codebasehq.com",
			paths: [
				{
					url: "/Logout",
					title: "Logout"
				},
				{
					url: "/notifications",
					title: "Notifications"
				},
				{
					url: "/settings/profile",
					title: "My Profile"
				},
				{
					url: "/settings/password",
					title: "Change My Password"
				},
				{				
					url: "/support",
					title: "Help &amp; Support"
				},
				{
					url_parts: ["/search?q=", /.+/],
					title: "Search for {0}"
				}
			]
		};
		site.paths.concat(cb.buildProjectPaths(projects_dom));
		log.log("site:");
		log.log(JSONX.stringify(site));

		return site;
	},

	buildProjectPaths: function(projects_dom){
		var paths = [];
		var $dom = $(projects_dom);
		$dom.find("project").each(function(){
			var $project = $(this);
			if($project.find("status").eq(0).text() !== "active"){
				return;
			}
			var name = $project.find("name").eq(0).text();
			var slug = $project.find("permalink").eq(0).text();
			paths.concat([
				{
					url: "/projects/" + slug + "/overview",
					title: name + " Overview"
				},
				{
					url: "/projects/" + slug + "/tickets",
					title: name + " Tickets"
				},
				{
					url: "/projects/" + slug + "/tickets?report=open",
					title: name + " Open Tickets"
				},
				{
					url: "/projects/" + slug + "/tickets/new",
					title: name + " New Ticket"
				},
				{
					url_parts: ["/projects/" + slug + "/tickets/", /\d+/],
					title: name + " Tickets"
				},
				{
					url: "/projects/" + slug + "/repositories",
					title: name + " Repositories"
				},
				{
					url: "/projects/" + slug + "/watching",
					title: name + " Notification Settings"
				},
				{
					url: "/projects/" + slug + "/assignments",
					title: name + " User Assignments"
				},
				{
					url: "/projects/" + slug + "/objects",
					title: name + " Organisational Objects"
				}
			]);
			
		});
		log.log(paths);
		return paths;
	}
};

var log = {
	_log: $("#log"),

	log: function(msg, css_class){
		$('<div/>', {'class': css_class || ''}).text(msg).appendTo(log._log);
		log._log[0].scrollTop = log._log[0].scrollHeight; // Scroll to the bottom
		if(typeof console !== "undefined"){
			console.log(msg);
		}
	},

	success: function(msg){
		log.log(msg, 'success');
	},

	error: function(msg){
		log.log(msg, 'error');
	},

	clear: function(){
		log._log.html('');
	}
};

cb.initPage();
